const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'sovereign.customerToken';

// The identity is a server-signed token, not a browser-minted UUID. A UUID
// was forgeable: anyone could send an arbitrary id and read that customer's
// credit balance. The server signs it, so only ids it issued are accepted.
//
// The token is cached in-module so it stays stable for the whole page session
// even when localStorage is unavailable (private mode). A fresh token per call
// would mean the buyer's balance read and the checkout's client_reference_id
// point at different customers, so a paid order would stamp credits onto an
// identity nobody can read back.
let memoryToken = null;
let inflight = null;

export async function customerToken() {
  if (memoryToken) return memoryToken;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    /* storage disabled — fall through to the network */
  }

  // Deduplicate: several widgets can ask on the same first paint.
  inflight ||= fetch(`${BASE}/api/customer`, { method: 'POST' })
    .then(handle)
    .then((data) => {
      if (!data?.token) throw new Error('Could not establish a session.');
      memoryToken = data.token;
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {
        /* keep it in memory for this page instead */
      }
      return data.token;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

function friendlyMessage(status, fallback) {
  switch (status) {
    case 400: return 'Invalid request — check the URL and try again.';
    case 402: return 'Out of credits. Buy a pack below or wait for free tier reset.';
    case 404: return 'Not found.';
    case 429: return 'Too many requests — slow down a bit.';
    case 502: return 'Could not reach that site. Try a different URL.';
    case 503: return 'Billing not configured. Contact the operator.';
    default: return fallback || `Request failed (${status})`;
  }
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(friendlyMessage(res.status, data.error));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function scoped(method, path, body) {
  const token = await customerToken();
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      'x-customer-token': token,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  }).then(handle);
}

export const api = {
  health: () => fetch(`${BASE}/health`).then(handle),
  stats: () => scoped('GET', '/api/stats'),
  list: (q = '') =>
    scoped('GET', `/api/contents${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  scrape: (url) => scoped('POST', '/api/scrape', { url }),
  remove: (id) => scoped('DELETE', `/api/contents/${id}`),
  credits: () => scoped('GET', '/api/billing/credits'),
  checkout: (amount, successUrl, cancelUrl) =>
    scoped('POST', '/api/billing/checkout', { amount, successUrl, cancelUrl })
};