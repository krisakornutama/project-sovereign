// webhook-service/server.js (v1.1 — SQLite persistence)
// Lemon Squeezy webhook delivery + license tracking for Sovereign OS
// Fixes PLAN.md 1.3: data no longer lives in RAM (Map) — survives restarts.

'use strict';

import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isProcessed, markProcessed, persistFailure,
  recordLicense, getLicense, revokeLicenseByOrder,
  listFailures
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';

// Ensure state dirs for legacy compatibility (file-based failures still readable)
const STATE_DIR = path.join(__dirname, 'state');
const FAILED_DIR = path.join(STATE_DIR, 'failed');
function ensureStateDirs() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR, { recursive: true });
}
ensureStateDirs();

// Raw-body middleware for webhook route (must read BEFORE any JSON parser)
app.use('/webhooks/lemonsqueezy', express.raw({ type: '*/*' }));

// General JSON parser for non-webhook routes
app.use(express.json());

// ── HMAC-SHA256 signature verification ──
function verifySignature(rawBody, signature) {
  if (!signature) return false;
  if (!LEMON_SQUEEZY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── GitHub API helper with retry + backoff ──
async function githubRequest(method, url, body, attempts = 0) {
  const maxAttempts = 5;
  const baseDelay = 1000;
  try {
    const res = await fetch(`https://api.github.com${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if ((res.status === 403 || res.status >= 500) && attempts < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempts);
      await new Promise((r) => setTimeout(r, delay));
      return githubRequest(method, url, body, attempts + 1);
    }
    return res;
  } catch (err) {
    if (attempts < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempts);
      await new Promise((r) => setTimeout(r, delay));
      return githubRequest(method, url, body, attempts + 1);
    }
    throw err;
  }
}

async function inviteCollaborator(username) {
  const res = await githubRequest('PUT', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators/${encodeURIComponent(username)}`, { permission: 'pull' });
  if (res.status === 201) return { status: 'invited' };
  if (res.status === 204) return { status: 'already-collaborator' };
  if (res.status === 404) return { status: 'unknown-user' };
  throw new Error(`GitHub PUT collaborators returned ${res.status}`);
}

async function revokeCollaborator(username) {
  const res = await githubRequest('DELETE', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators/${encodeURIComponent(username)}`);
  if (res.status === 204) return { status: 'revoked' };
  if (res.status === 404) return { status: 'not-found' };
  throw new Error(`GitHub DELETE collaborators returned ${res.status}`);
}

// ── Webhook endpoint ──
app.post('/webhooks/lemonsqueezy', async (req, res) => {
  const rawBody = req.body; // Buffer from express.raw
  const signature = req.headers['x-signature'];

  // 1. Verify signature
  if (!verifySignature(rawBody, signature)) {
    console.error('webhook: invalid signature');
    return res.status(401).json({ error: 'unauthorized' });
  }

  // 2. Parse JSON after signature verified
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('webhook: invalid JSON body');
    return res.status(400).json({ error: 'invalid json' });
  }

  const orderId = event.meta?.custom_data?.order_id || event.id;
  const eventName = event.event_name || event.type || 'unknown';
  const githubUsername = event.meta?.custom_data?.github_username || null;
  const tier = event.meta?.custom_data?.tier || 'starter';

  // 3. Idempotency (SQLite — survives restart)
  if (isProcessed(orderId, eventName)) {
    return res.status(200).json({ status: 'already-processed', order_id: orderId });
  }

  // 4. Dispatch by event type
  try {
    if (eventName === 'order_created') {
      if (!githubUsername) {
        console.error('webhook: order_created missing github_username', { order_id: orderId });
        markProcessed(orderId, eventName, githubUsername, 'error', 'missing github_username');
        return res.status(422).json({ error: 'missing github_username', order_id: orderId });
      }
      const result = await inviteCollaborator(githubUsername);
      markProcessed(orderId, eventName, githubUsername, result.status, JSON.stringify(result));

      // Record license for future verification and refund tracking
      const licenseKey = `SVR-${orderId}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      recordLicense({ orderId, githubUsername, licenseKey, tier });

      if (result.status === 'unknown-user') {
        persistFailure(orderId, eventName, 'github user not found', 404);
        return res.status(200).json({ status: 'queued-manual-followup', order_id: orderId, license_key: licenseKey });
      }
      return res.status(200).json({ status: result.status, order_id: orderId, license_key: licenseKey, tier });
    }

    if (eventName === 'order_refunded') {
      if (githubUsername) {
        try {
          await revokeCollaborator(githubUsername);
        } catch (err) {
          persistFailure(orderId, eventName, err.message, 500);
        }
      }
      // Mark license revoked for long-term tracking
      revokeLicenseByOrder(orderId, 'processed');
      markProcessed(orderId, eventName, githubUsername, 'refund-processed', null);
      return res.status(200).json({ status: 'refund-processed', order_id: orderId });
    }

    // Unknown event — acknowledge but do nothing
    markProcessed(orderId, eventName, githubUsername, 'ignored', eventName);
    return res.status(200).json({ status: 'ignored', event_name: eventName });
  } catch (err) {
    persistFailure(orderId, eventName, err.message, 500);
    console.error(`webhook: error processing ${eventName}:`, err.message);
    return res.status(200).json({ status: 'error-persisted', order_id: orderId });
  }
});

// ── Health check ──
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', db: 'sqlite', version: '1.1.0' });
});

// ── List persisted failures (admin/debug) ──
app.get('/failures', (_req, res) => {
  const failures = listFailures(100);
  res.status(200).json({ failures, count: failures.length });
});

// ── List licenses (admin/debug — protected in production by WAF/auth) ──
app.get('/licenses', (_req, res) => {
  res.status(200).json({ note: 'License endpoint requires admin auth — not exposed in production WAF' });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`webhook-service listening on :${PORT}`);
    console.log(`DB: ${process.env.WEBHOOK_DB_PATH || 'webhook-data.sqlite'}`);
  });
}

export { app };
