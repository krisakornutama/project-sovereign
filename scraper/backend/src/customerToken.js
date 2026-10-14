// customerToken.js — unforgeable customer identity.
//
// Previously the customer id came straight from the `x-customer-id` header,
// so anyone could claim to be anyone (verified live against the old deploy:
// sending an arbitrary id returned that customer's credit balance).
//
// A token is `<id>.<sig>`:
//   id  = 32 hex chars  = 128 bits of randomness (UUIDv4)
//   sig = 64 hex chars  = HMAC-SHA256 over the id, keyed by the server secret
//
// The signature means a guessed or stolen id cannot be used without the
// server's secret, and the id cannot be swapped for another customer's.
// The signature is deterministic, so the same token validates on every call
// and the customer keeps their credits across restarts.
//
// If no secret is configured we refuse to issue tokens rather than fall back
// to the forgeable behaviour — fail closed.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ID_BYTES = 16; // 32 hex chars
const SECRET_ENV = 'CUSTOMER_TOKEN_SECRET';

function secret() {
  const s = process.env[SECRET_ENV];
  if (typeof s === 'string' && s.trim().length >= 32) return s.trim();
  return null;
}

export function hasTokenSecret() {
  return secret() !== null;
}

function sign(id, key) {
  return createHmac('sha256', key).update(id).digest('hex');
}

export function issueCustomerToken() {
  const key = secret();
  if (!key) {
    throw Object.assign(new Error('Customer identity not configured'), { status: 503 });
  }
  const id = randomBytes(ID_BYTES).toString('hex');
  return `${id}.${sign(id, key)}`;
}

const TOKEN_RE = /^([0-9a-f]{32})\.([0-9a-f]{64})$/;

/** Returns the customer id, or undefined when the token is missing/invalid. */
export function readCustomerToken(token) {
  const key = secret();
  if (!key) return undefined;
  if (typeof token !== 'string' || !token.trim()) return undefined;
  const m = TOKEN_RE.exec(token.trim());
  if (!m) return undefined;

  const [, id, sig] = m;
  const expected = sign(id, key);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  // Constant-time compare so a valid signature cannot be found byte by byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  return id;
}

/** Mint a token for a scope we already trust (e.g. a Stripe webhook). */
export function tokenForScope(id) {
  const key = secret();
  if (!key) return null;
  return `${id}.${sign(id, key)}`;
}