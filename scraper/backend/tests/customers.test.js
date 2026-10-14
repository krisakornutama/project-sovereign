// Must come first: points this file at its own database so parallel test
// processes cannot wipe each other's fixtures.
import './testDb.js';

import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import Stripe from 'stripe';
import { createApp } from '../src/app.js';
import { clearStore, getCredits, resetCredits, FREE_TIER_CREDITS } from '../src/store.js';
import { clearPayments, listPayments } from '../src/billing.js';
import { tokenForScope } from '../src/customerToken.js';

process.env.CUSTOMER_TOKEN_SECRET = 'customers-test-secret-0123456789abcdef-long-enough';

// The fixture server is on 127.0.0.1, which the SSRF guard blocks on purpose.
const app = createApp({ allowPrivateTargets: true });

// Customers are now identified by a signed token, not a bare id. Minting the
// token here keeps these tests focused on *scoping* rather than token signing
// (which hardening.test.js covers on its own).
const ALICE = '11111111111141118111111111111111';
const BOB = '22222222222242228222222222222222';
const ALICE_TOKEN = tokenForScope(ALICE);
const BOB_TOKEN = tokenForScope(BOB);

let fixture;
let fixtureUrl;

before(async () => {
  fixture = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Scoped Fixture</title></head><body><h1>Hi</h1><p>one two three four five</p></body></html>');
  });
  await new Promise((r) => fixture.listen(0, r));
  fixtureUrl = `http://127.0.0.1:${fixture.address().port}/page`;
});

after(() => new Promise((r) => fixture.close(r)));

beforeEach(() => {
  clearStore();
  resetCredits();
  clearPayments();
});

const asAlice = (req) => req.set('x-customer-token', ALICE_TOKEN);
const asBob = (req) => req.set('x-customer-token', BOB_TOKEN);

describe('customer scoping', () => {
  test('a request without a token is rejected', async () => {
    const res = await request(app).get('/api/billing/credits');
    assert.equal(res.status, 401, 'no identity must not fall into a shared bucket');
    const stats = await request(app).get('/api/stats');
    assert.equal(stats.status, 401);
    const list = await request(app).get('/api/contents');
    assert.equal(list.status, 401);
  });

  test('new customer receives the free tier', async () => {
    const res = await asAlice(request(app).get('/api/billing/credits'));
    assert.equal(res.status, 200);
    assert.equal(res.body.balance, FREE_TIER_CREDITS);
  });

  test('free tier is capped per IP (3 grants per IP)', async () => {
    // Distinct customers from one IP: only the first 3 earn the free tier.
    const tokens = ['a', 'b', 'c', 'd', 'e'].map((c) => tokenForScope(`${c.repeat(32).slice(0, 32)}`));
    const balances = [];
    for (const t of tokens) {
      const r = await request(app).get('/api/billing/credits').set('x-customer-token', t);
      balances.push(r.body.balance);
    }
    assert.deepEqual(balances, [3, 3, 3, 0, 0], 'IP must not mint unlimited free credit');
  });

  test('returning to the same customer keeps their balance', async () => {
    await asAlice(request(app).get('/api/billing/credits'));
    await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const again = await asAlice(request(app).get('/api/billing/credits'));
    assert.equal(again.body.balance, FREE_TIER_CREDITS - 1);
  });

  test('two customers hold separate credit pools', async () => {
    const a = await asAlice(request(app).get('/api/billing/credits'));
    assert.equal(a.body.balance, FREE_TIER_CREDITS);
    const b = await asBob(request(app).get('/api/billing/credits'));
    assert.equal(b.body.balance, FREE_TIER_CREDITS, 'bob must not see alice balance');
    await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(getCredits(ALICE), FREE_TIER_CREDITS - 1);
    assert.equal(getCredits(BOB), FREE_TIER_CREDITS, 'bob untouched by alice scrape');
  });

  test('scrapes are visible only to their owner', async () => {
    const created = await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(created.status, 201);
    const aliceList = await asAlice(request(app).get('/api/contents'));
    assert.equal(aliceList.body.length, 1);
    const bobList = await asBob(request(app).get('/api/contents'));
    assert.equal(bobList.body.length, 0, 'bob must not see alice content');
  });

  test('cannot delete another customer content (404)', async () => {
    const created = await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const byBob = await asBob(request(app).delete(`/api/contents/${created.body.id}`));
    assert.equal(byBob.status, 404);
    const stillThere = await asAlice(request(app).get(`/api/contents/${created.body.id}`));
    assert.equal(stillThere.status, 200, 'alice keeps her content');
  });

  test('GET by id of another customer is 404', async () => {
    const created = await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const peek = await asBob(request(app).get(`/api/contents/${created.body.id}`));
    assert.equal(peek.status, 404);
  });

  test('stats are scoped per customer', async () => {
    await asAlice(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const a = await asAlice(request(app).get('/api/stats'));
    assert.equal(a.body.total, 1);
    const b = await asBob(request(app).get('/api/stats'));
    assert.equal(b.body.total, 0);
  });

  test('empty pool returns 402 without consuming anything', async () => {
    await asBob(request(app).get('/api/billing/credits')); // consumes bob's free grant
    await asBob(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    await asBob(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    await asBob(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    const blocked = await asBob(request(app).post('/api/scrape')).send({ url: fixtureUrl });
    assert.equal(blocked.status, 402);
    assert.equal(getCredits(BOB), 0);
    const list = await asBob(request(app).get('/api/contents'));
    assert.equal(list.body.length, FREE_TIER_CREDITS, 'only paid-for scrapes are stored');
  });
});

describe('checkout attributes the purchase to a customer', () => {
  test('checkout passes the customer id to Stripe, webhook credits that customer', async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_dummy';
    const { createCheckoutSession, verifyWebhookEvent, recordPayment, getStripe } = await import('../src/billing.js');

    // Stub the client billing.js actually caches, not a fresh instance.
    const stub = getStripe();
    const seen = {};
    stub.checkout.sessions.create = async (params) => {
      seen.params = params;
      return { id: 'cs_attr_1', url: 'https://checkout.stripe.test/x' };
    };

    const original = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_attr';

    await createCheckoutSession({
      amount: 9900,
      successUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/no',
      customerScope: ALICE
    });
    assert.equal(seen.params.client_reference_id, ALICE, 'client_reference_id must carry the customer');
    assert.equal(seen.params.line_items[0].price_data.currency, 'thb');

    const payload = JSON.stringify({
      id: 'evt_attr',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_attr_1',
          amount_total: 9900,
          currency: 'thb',
          payment_status: 'paid',
          client_reference_id: ALICE
        }
      }
    });
    const header = stub.webhooks.generateTestHeaderString({ payload, secret: 'whsec_attr' });
    const event = verifyWebhookEvent(payload, header);
    recordPayment(event);

    assert.equal(getCredits(ALICE), 1000, 'Starter pack credits the buyer, not the pool');
    assert.equal(getCredits(BOB), 0, 'nobody else is credited');
    assert.equal(listPayments()[0].customer, ALICE, 'receipt records who paid');

    process.env.STRIPE_WEBHOOK_SECRET = original;
    delete process.env.STRIPE_SECRET_KEY;
  });
});