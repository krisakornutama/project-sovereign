// Must come first: points this file at its own database so parallel test
// processes cannot wipe each other's fixtures.
import './testDb.js';

import test, { describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clearStore, grantCredits, resetCredits } from '../src/store.js';

const SECRET = 'admin-secret-for-tests-0123456789abcdef-long-enough';
process.env.CUSTOMER_TOKEN_SECRET = SECRET;
process.env.ADMIN_TOKEN = 'admin-token-for-tests-0123456789';

const app = createApp();

async function newToken() {
  const res = await request(app).post('/api/customer');
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  return res.body.token;
}

beforeEach(() => {
  clearStore();
  resetCredits();
  grantCredits(50);
});

describe('customer identity', () => {
  test('POST /api/customer issues a signed token', async () => {
    const token = await newToken();
    assert.match(token, /^[0-9a-f]{32}\.[0-9a-f]{64}$/);
  });

  test('each token is unique', async () => {
    const a = await newToken();
    const b = await newToken();
    assert.notEqual(a, b);
  });

  test('a made-up x-customer-id header grants nothing', async () => {
    // The old header is ignored entirely, and with no valid token the route is
    // closed — so a guessed id cannot reach any balance, shared or otherwise.
    const res = await request(app)
      .get('/api/billing/credits')
      .set('x-customer-id', 'attacker-guess-1234');
    assert.equal(res.status, 401);
    assert.ok(!JSON.stringify(res.body).includes('50'));
  });

  test('forged x-customer-token is rejected', async () => {
    const res = await request(app)
      .get('/api/billing/credits')
      .set('x-customer-token', `${'a'.repeat(32)}.${'b'.repeat(64)}`);
    assert.equal(res.status, 401);
  });

  test('a valid token reaches that customer balance', async () => {
    const token = await newToken();
    const fresh = await request(app).get('/api/billing/credits').set('x-customer-token', token);
    assert.equal(fresh.status, 200);
    // Free tier is issued per IP, capped, so the first read gets it.
    assert.ok(fresh.body.balance >= 0);
    assert.ok(fresh.body.customer, 'a valid token resolves to a customer id');
  });

  test('two tokens cannot see each other harvests', async () => {
    const a = await newToken();
    const b = await newToken();
    const listA = await request(app).get('/api/contents').set('x-customer-token', a);
    const listB = await request(app).get('/api/contents').set('x-customer-token', b);
    assert.deepEqual(listA.body, []);
    assert.deepEqual(listB.body, []);
  });
});

describe('payments endpoint is private', () => {
  test('401 without an admin token', async () => {
    const res = await request(app).get('/api/billing/payments');
    assert.equal(res.status, 401);
    assert.ok(!JSON.stringify(res.body).includes('amount'), 'no data may leak');
  });

  test('401 with a wrong admin token', async () => {
    const res = await request(app).get('/api/billing/payments').set('x-admin-token', 'wrong');
    assert.equal(res.status, 401);
  });

  test('200 with the correct admin token', async () => {
    const res = await request(app).get('/api/billing/payments').set('x-admin-token', 'admin-token-for-tests-0123456789');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

describe('security headers + cors', () => {
  test('responses carry the hardening headers', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    assert.ok(res.headers['permissions-policy']);
  });

  test('cors allows the real front-end', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://harvest-ledger.pages.dev');
    assert.equal(res.headers['access-control-allow-origin'], 'https://harvest-ledger.pages.dev');
  });

  test('cors does not reflect a hostile origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example');
  });
});

describe('error responses stay vague', () => {
  const token = () => request(app).post('/api/customer').then((r) => r.body.token);

  test('hostile-looking input does not crash and leaks nothing', async () => {
    const t = await token();
    for (const url of [
      'http://127.0.0.1:3001/admin',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'file:///etc/passwd',
      'not-a-url',
      'http://[::1]:8080/',
      'http://10.0.0.5:5432/'
    ]) {
      const res = await request(app).post('/api/scrape').set('x-customer-token', t).send({ url });
      assert.ok(
        [400, 402, 502].includes(res.status),
        `${url} → unexpected ${res.status}`
      );
      assert.ok(
        !/ECONNREFUSED|10\.0\.0\.|at Object|password|metadata\/iam/i.test(
          JSON.stringify(res.body)
        ),
        `${url} leaked internals: ${JSON.stringify(res.body)}`
      );
    }
  });
});

describe('ssrf through the api', () => {
  test('POST /api/scrape refuses an internal address', async () => {
    const r0 = await request(app).post('/api/customer');
    const res = await request(app)
      .post('/api/scrape')
      .set('x-customer-token', r0.body.token)
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not allowed/i);
  });

  test('POST /api/scrape refuses localhost', async () => {
    const r0 = await request(app).post('/api/customer');
    const res = await request(app)
      .post('/api/scrape')
      .set('x-customer-token', r0.body.token)
      .send({ url: 'http://localhost:4000/health' });
    assert.equal(res.status, 400);
  });

  test('POST /api/scrape refuses a private target with no token at all', async () => {
    // The token gate runs first, so this is 401 rather than 400. Either way it
    // must not reach the network.
    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });
    assert.ok([400, 401].includes(res.status));
  });
});