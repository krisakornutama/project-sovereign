// Must come first: points this file at its own database so parallel test
// processes cannot wipe each other's fixtures.
import './testDb.js';

import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clearStore, grantCredits, resetCredits, getCredits, FREE_TIER_CREDITS } from '../src/store.js';
import { tokenForScope } from '../src/customerToken.js';

process.env.CUSTOMER_TOKEN_SECRET = 'api-test-secret-0123456789abcdef-long-enough';

// The fixture server is on 127.0.0.1, which the SSRF guard blocks on purpose.
// Tests opt out explicitly; the deployed app never sets this flag.
const app = createApp({ allowPrivateTargets: true });

// Every data route now needs a signed identity. These tests care about the
// scraper contract, not about token signing (hardening.test.js covers that),
// so one shared customer is minted once and attached to each request.
const SCOPE = 'a'.repeat(32);
const TOKEN = tokenForScope(SCOPE);
const auth = (req) => req.set('x-customer-token', TOKEN);

let fixtureServer;
let fixtureUrl;

before(async () => {
  fixtureServer = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><html><head>
        <title>Sovereign Test Page</title>
        <meta name="description" content="Fixture description for scraper test.">
        </head><body><h1>Hello</h1><h1>World</h1>
        <p>This is a deterministic fixture with several words for counting.</p>
        </body></html>`);
    } else {
      res.writeHead(404);
      res.end('nope');
    }
  });
  await new Promise((resolve) => fixtureServer.listen(0, resolve));
  const port = fixtureServer.address().port;
  fixtureUrl = `http://127.0.0.1:${port}/page`;
});

after(() => new Promise((resolve) => fixtureServer.close(resolve)));

beforeEach(() => {
  clearStore();
  resetCredits();
  // Credit the scope this file authenticates as, so the balance assertions
  // below read the same pool the requests touch.
  grantCredits(100, SCOPE);
});

describe('health', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});

describe('scrape validation', () => {
  test('POST /api/scrape 400 when url missing', async () => {
    const res = await auth(request(app).post('/api/scrape')).send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid url/);
  });

  test('POST /api/scrape 400 on invalid protocol', async () => {
    const res = await auth(request(app).post('/api/scrape')).send({ url: 'ftp://x.com' });
    assert.equal(res.status, 400);
  });
});

describe('scraper CRUD + stats', () => {
  test('POST /api/scrape stores deterministic fixture', async () => {
    const res = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.title, 'Sovereign Test Page');
    assert.equal(res.body.description, 'Fixture description for scraper test.');
    assert.equal(res.body.h1Count, 2);
    assert.ok(res.body.wordCount >= 8);
  });

  test('GET /api/contents lists created item', async () => {
    const created = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const res = await auth(request(app).get('/api/contents'));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, created.body.id);
  });

  test('GET /api/contents?q filters', async () => {
    await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const hit = await auth(request(app).get('/api/contents?q=sovereign'));
    assert.equal(hit.body.length, 1);
    const miss = await auth(request(app).get('/api/contents?q=zzz-no-match'));
    assert.equal(miss.body.length, 0);
  });

  test('GET /api/contents/:id + 404', async () => {
    const created = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const ok = await auth(request(app).get(`/api/contents/${created.body.id}`));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.title, 'Sovereign Test Page');
    const nf = await auth(request(app).get(''));
    assert.equal(nf.status, 404);
  });

  test('GET /api/stats reflects store', async () => {
    await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const res = await auth(request(app).get('/api/stats'));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.today, 1);
    assert.ok(res.body.avgWordCount >= 8);
    assert.equal(res.body.topDomains[0].domain, '127.0.0.1');
  });

  test('DELETE /api/contents/:id removes', async () => {
    const created = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const del = await auth(request(app).delete(`/api/contents/${created.body.id}`));
    assert.equal(del.status, 200);
    assert.equal(del.body.ok, true);
    const again = await auth(request(app).delete(`/api/contents/${created.body.id}`));
    assert.equal(again.status, 404);
  });

  test('unknown route 404s', async () => {
    const res = await request(app).get('/nope');
    assert.equal(res.status, 404);
  });
});

describe('credits', () => {
  test('GET /api/billing/credits reflects balance', async () => {
    const res = await auth(request(app).get('/api/billing/credits'));
    assert.equal(res.status, 200);
    assert.equal(res.body.balance, 100);
  });

  test('POST /api/scrape spends 1 credit', async () => {
    await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(getCredits(SCOPE), 99);
  });

  test('POST /api/scrape 402 when out of credits', async () => {
    // Drop the seeded balance so only the free tier is available, then burn it.
    resetCredits();
    for (let i = 0; i < FREE_TIER_CREDITS; i++) {
      const ok = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
      assert.equal(ok.status, 201, `free harvest ${i + 1} should succeed`);
    }
    const res = await auth(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(res.status, 402);
    assert.match(res.body.error, /credit/i);
  });

  test('POST /api/scrape 400 is checked before credits are spent', async () => {
    const before = getCredits(SCOPE);
    const res = await auth(request(app).post('/api/scrape')).send({ url: 'ftp://x.com' });
    assert.equal(res.status, 400);
    assert.equal(getCredits(SCOPE), before, 'invalid url must not burn a credit');
  });
});
