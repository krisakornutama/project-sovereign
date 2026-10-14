import express from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'node:crypto';
import { isValidHttpUrl, scrapeUrl } from './scraper.js';
import { issueCustomerToken, readCustomerToken } from './customerToken.js';
import {
  listContents,
  getContent,
  createContent,
  removeContent,
  getStats,
  getCredits,
  spendCredit,
  ensureCustomer,
  FREE_TIER_CREDITS
} from './store.js';
import {
  getPublishableKey,
  validateCheckoutInput,
  createCheckoutSession,
  verifyWebhookEvent,
  recordPayment,
  listPayments
} from './billing.js';
import { createRateLimiter } from './rateLimit.js';
import { corsOptions, securityHeaders, publicError } from './securityHeaders.js';

// The browser holds a signed token from POST /api/customer and sends it on
// every request, so credits, harvests and stats stay private per customer.
// The id is HMAC-signed server-side: a guessed or edited id is rejected, so a
// visitor cannot claim someone else's balance by sending a made-up header.
function tokenOf(req) {
  const raw = req.headers['x-customer-token'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return readCustomerToken(value);
}

// Every data route requires a valid token. Without one, scopeOf() used to fall
// back to a single shared bucket — so a caller with no identity at all could
// read and spend that bucket's credits, and anyone could append to it. Missing
// or forged identity is now a 401 instead of a silent downgrade.
function requireCustomer() {
  return function gate(req, _res, next) {
    const scope = tokenOf(req);
    if (!scope) {
      return next(Object.assign(new Error('Missing or invalid customer token'), { status: 401 }));
    }
    req.customerScope = scope;
    next();
  };
}

export function createApp({ allowPrivateTargets = false } = {}) {
  const app = express();

  app.use(cors(corsOptions()));
  app.use(securityHeaders());

  // Bounded sliding-window rate limit: 120 req/min per IP.
  app.use(createRateLimiter());

  // Stripe webhook MUST read the untouched raw body for signature
  // verification, so it is registered before the JSON parser below.
  app.post(
    '/api/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res, next) => {
      try {
        const event = verifyWebhookEvent(req.body, req.headers['stripe-signature']);
        recordPayment(event);
        res.json({ received: true });
      } catch (err) {
        next(err);
      }
    }
  );
  app.use(express.json({ limit: '256kb' }));

  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
  });

  // Hand the browser a signed customer identity. Idempotent: the browser only
  // calls this once, on first load, and stores the token.
  app.post('/api/customer', (_req, res, next) => {
    try {
      res.status(201).json({ token: issueCustomerToken() });
    } catch (err) {
      next(err);
    }
  });

  // Purchase history is sensitive: it exposes who bought, how much, and when.
  // It was world-readable before. Admin access only, via a shared secret.
  app.get('/api/billing/payments', (req, res, next) => {
    try {
      const expected = process.env.ADMIN_TOKEN;
      if (!expected) return res.status(503).json({ error: 'Admin access not configured' });
      const got = String(req.headers['x-admin-token'] || '');
      const a = Buffer.from(got);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json(listPayments().slice(0, 100));
    } catch (err) {
      next(err);
    }
  });

  // Guards every route that touches per-customer data.
const asCustomer = requireCustomer();

app.post('/api/scrape', asCustomer, async (req, res, next) => {
    try {
      const scope = req.customerScope;
      const { url } = req.body || {};
      if (!isValidHttpUrl(url)) {
        return res.status(400).json({ error: 'Invalid url. Must be http(s) URL.' });
      }
      ensureCustomer(scope, req.ip);
      if (!spendCredit(scope)) {
        return res.status(402).json({ error: 'Out of credits. Top up to keep harvesting.' });
      }
      const scraped = await scrapeUrl(url, fetch, { skipSsrfCheck: allowPrivateTargets });
      const doc = createContent(scraped, scope);
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/contents', asCustomer, (req, res) => {
    res.json(listContents({ q: req.query.q, limit: req.query.limit, scope: req.customerScope }));
  });

  app.get('/api/contents/:id', asCustomer, (req, res) => {
    const doc = getContent(req.params.id, req.customerScope);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  app.delete('/api/contents/:id', asCustomer, (req, res) => {
    const ok = removeContent(req.params.id, req.customerScope);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  app.get('/api/stats', asCustomer, (req, res) => {
    res.json(getStats(req.customerScope));
  });

  app.get('/api/billing/config', (_req, res) => {
    const publishableKey = getPublishableKey();
    if (!publishableKey) return res.status(503).json({ error: 'Billing not configured' });
    res.json({ publishableKey });
  });

  app.post('/api/billing/checkout', asCustomer, async (req, res, next) => {
    try {
      const { amount, successUrl, cancelUrl } = req.body || {};
      const invalid = validateCheckoutInput({ amount, successUrl, cancelUrl });
      if (invalid) return res.status(400).json({ error: invalid });
      const session = await createCheckoutSession({
        amount,
        successUrl,
        cancelUrl,
        customerScope: req.customerScope
      });
      res.status(201).json({ id: session.id, url: session.url });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/billing/credits', asCustomer, (req, res) => {
    const scope = req.customerScope;
    const before = getCredits(scope);
    const { credits, freeTierApplied } = ensureCustomer(scope, req.ip);
    res.json({
      balance: credits,
      customer: scope,
      freeTier: freeTierApplied ? { credits: FREE_TIER_CREDITS, remaining: credits } : null,
      previousBalance: before
    });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(publicError);

  return app;
}
