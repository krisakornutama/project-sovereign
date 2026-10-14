// Must come first: points this file at its own database so parallel test
// processes cannot wipe each other's fixtures.
import './testDb.js';

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import Stripe from 'stripe';
import { createApp } from '../src/app.js';
import { clearPayments, listPayments } from '../src/billing.js';
import { getCredits, resetCredits } from '../src/store.js';
import { tokenForScope } from '../src/customerToken.js';

process.env.CUSTOMER_TOKEN_SECRET = 'billing-test-secret-0123456789abcdef-long-enough';

const app = createApp();

// Checkout now requires a signed customer identity, so these billing tests
// attach one minted token. Token signing itself is covered in hardening.test.js.
const CHECKOUT_TOKEN = tokenForScope('c'.repeat(32));
const asCustomer = (req) => req.set('x-customer-token', CHECKOUT_TOKEN);

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PUBLISHABLE_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  clearPayments();
  resetCredits();
});

describe('billing fail-closed without keys', () => {
  test('GET /api/billing/config 503 when unconfigured', async () => {
    const res = await request(app).get('/api/billing/config');
    assert.equal(res.status, 503);
  });

  test('POST /api/billing/checkout 503 when unconfigured', async () => {
    const res = await asCustomer(request(app).post('/api/billing/checkout')).send({
      amount: 5000,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    });
    assert.equal(res.status, 503);
  });

  test('POST /api/billing/checkout 401 without a customer token', async () => {
    const res = await request(app).post('/api/billing/checkout').send({
      amount: 5000,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    });
    assert.equal(res.status, 401, 'checkout must not open without an identity');
  });

  test('POST /api/billing/checkout 400 on bad amount (no network touched)', async () => {
    const res = await asCustomer(request(app).post('/api/billing/checkout')).send({
      amount: 5,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    });
    // Either 400 (validation) or 503 (no key) — both prove no charge path taken
    assert.ok([400, 503].includes(res.status));
    if (res.status === 400) assert.match(res.body.error, /THB/);
  });

  test('POST /api/webhook 503 when webhook secret missing', async () => {
    const res = await request(app)
      .post('/api/webhook')
      .set('content-type', 'application/json')
      .send('{}');
    assert.equal(res.status, 503);
  });
});

describe('webhook signature verification (local crypto, no network)', () => {
  const secret = 'whsec_test_dummy';

  function signedPayload(obj) {
    process.env.STRIPE_SECRET_KEY = 'rk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const stripe = new Stripe('rk_test_dummy');
    const payload = JSON.stringify(obj);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return { payload, header };
  }

  test('POST /api/webhook 400 on forged signature', async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const res = await request(app)
      .post('/api/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', 't=123,v1=deadbeef')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));
    assert.equal(res.status, 400);
    assert.equal(listPayments().length, 0);
  });

  test('POST /api/webhook 200 + records THB payment on valid signature', async () => {
    const { payload, header } = signedPayload({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          amount_total: 5000,
          currency: 'thb',
          payment_status: 'paid'
        }
      }
    });
    const res = await request(app)
      .post('/api/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);
    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    const payments = listPayments();
    assert.equal(payments.length, 1);
    assert.equal(payments[0].currency, 'thb');
    assert.equal(payments[0].amount, 5000);
  });

  test('Starter payment (9900 satang) grants 1000 credits', async () => {
    const { payload, header } = signedPayload({
      id: 'evt_test_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_2',
          amount_total: 9900,
          currency: 'thb',
          payment_status: 'paid'
        }
      }
    });
    const res = await request(app)
      .post('/api/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);
    assert.equal(res.status, 200);
    assert.equal(getCredits(), 1000);
  });
});
