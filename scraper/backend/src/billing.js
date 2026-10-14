import Stripe from 'stripe';
import { DatabaseSync } from 'node:sqlite';
import { grantCredits } from './store.js';
import { isValidHttpUrl } from './scraper.js';

// Server-forced currency. Client input can never change this.
export const BILLING_CURRENCY = 'thb';
export const MIN_AMOUNT_SATANG = 100; // ฿1
export const MAX_AMOUNT_SATANG = 10_000_000; // ฿100,000

// Payments used to live in an array, so the purchase history vanished on every
// restart — and GET /api/billing/payments (admin) had nothing to show. Now on
// disk, using the same file as the store.
const DB_PATH = process.env.SCRAPER_DB_PATH || 'scraper-data.sqlite';
const db = new DatabaseSync(DB_PATH);
// Same busy_timeout as store.js: the test files run as separate processes and
// would otherwise collide with "database is locked".
db.exec('PRAGMA busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id        TEXT PRIMARY KEY,
    amount    INTEGER NOT NULL,
    currency  TEXT NOT NULL,
    status    TEXT,
    customer  TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(createdAt DESC);
`);

const qPayments = {
  insert: db.prepare(`
    INSERT INTO payments (id, amount, currency, status, customer, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `),
  recent: db.prepare('SELECT * FROM payments ORDER BY createdAt DESC LIMIT ?'),
  clear: db.prepare('DELETE FROM payments')
};

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

export function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || '';
}

function getSecretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
}

let cachedKey = null;
let cachedClient = null;

export function getStripe() {
  const key = getSecretKey();
  if (!key) return null;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new Stripe(key);
    cachedKey = key;
  }
  return cachedClient;
}

export function validateCheckoutInput({ amount, successUrl, cancelUrl } = {}) {
  if (
    !Number.isInteger(amount) ||
    amount < MIN_AMOUNT_SATANG ||
    amount > MAX_AMOUNT_SATANG
  ) {
    return `Invalid amount. Must be an integer ${MIN_AMOUNT_SATANG}-${MAX_AMOUNT_SATANG} satang (THB).`;
  }
  if (!isValidHttpUrl(successUrl)) return 'Invalid successUrl. Must be http(s) URL.';
  if (!isValidHttpUrl(cancelUrl)) return 'Invalid cancelUrl. Must be http(s) URL.';
  return null;
}

export async function createCheckoutSession({ amount, successUrl, cancelUrl, customerScope }) {
  const stripe = getStripe();
  if (!stripe) throw fail(503, 'Billing not configured');
  try {
    return await stripe.checkout.sessions.create({
      mode: 'payment',
      // Stripe echoes this back in the webhook so credits land on the buyer
      // who actually paid, instead of a shared pool.
      client_reference_id: customerScope || undefined,
      line_items: [
        {
          price_data: {
            currency: BILLING_CURRENCY,
            product_data: { name: 'Sovereign Scraper credit' },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  } catch (err) {
    throw fail(502, `Billing provider error: ${err.message}`);
  }
}

// rawBody must be the untouched Buffer from express.raw().
export function verifyWebhookEvent(rawBody, signature) {
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) throw fail(503, 'Billing webhook not configured');
  if (!signature) throw fail(400, 'Missing stripe-signature header');
  const stripe = getStripe();
  if (!stripe) throw fail(503, 'Billing not configured');
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw fail(400, 'Invalid webhook signature');
  }
}

export function recordPayment(event) {
  if (event?.type === 'checkout.session.completed') {
    const s = event.data?.object || {};
    const amount = s.amount_total ?? 0;
    const customer = s.client_reference_id || undefined;

    // Stripe retries a webhook when it times out, so the same event can arrive
    // more than once. The receipt row is keyed by session id and uses
    // ON CONFLICT DO NOTHING, so credit only when this delivery was the one
    // that actually inserted it. Without this a retry silently doubles the
    // customer's credits.
    const inserted = qPayments.insert.run(
      s.id || 'unknown',
      amount,
      (s.currency || BILLING_CURRENCY).toLowerCase(),
      s.payment_status || 'unknown',
      customer ?? null,
      new Date().toISOString()
    );

    // Pack quotas: Starter ฿99 → 1,000 harvests, Pro ฿299 → 10,000.
    const quota = amount === 9900 ? 1000 : amount === 29900 ? 10000 : Math.floor(amount / 10);
    if (inserted.changes > 0 && quota > 0) grantCredits(quota, customer);
  }
}

export function listPayments(limit = 100) {
  return qPayments.recent.all(Math.min(Math.max(limit | 0 || 100, 1), 500));
}

export function clearPayments() {
  qPayments.clear.run();
}
