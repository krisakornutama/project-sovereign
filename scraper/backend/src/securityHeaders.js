// securityHeaders.js — response headers + a CORS allowlist.
//
// The live API answered with `Access-Control-Allow-Origin: *` and no security
// headers at all, so any site could call it from a visitor's browser.
//
// CORS defaults to the two real front-ends. Add more with
// CORS_EXTRA_ORIGINS=https://a.example,https://b.example — never "*" in
// production: the customer token lives in the browser, and a wildcard origin
// would let a hostile page ride along with it.

const DEFAULT_ORIGINS = [
  'https://harvest-ledger.pages.dev',
  'https://app.sovereignoriginshop.dpdns.org',
  'https://sovereignoriginshop.dpdns.org',
];

function allowedOrigins() {
  const extra = String(process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

export function corsOptions() {
  const allow = new Set(allowedOrigins());
  return {
    origin(origin, cb) {
      // No Origin header = same-origin, curl, or a server-to-server call.
      if (!origin) return cb(null, true);
      cb(null, allow.has(origin));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-customer-token', 'stripe-signature'],
    exposedHeaders: [],
    maxAge: 600,
  };
}

export function securityHeaders() {
  return function applyHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    // The API is called cross-origin from the front-ends, so the browser
    // needs to see this header for the response to be readable.
    res.removeHeader('X-Powered-By');
    next();
  };
}

/**
 * Errors go to the log, not to the caller. The old handler echoed
 * `err.message`, which surfaced details like
 * `fetch failed: connect ECONNREFUSED 10.0.0.5:5432` — free reconnaissance
 * for anyone probing the deployment.
 */
export function publicError(err, _req, res, _next) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[error]', err.stack || err.message);
  else console.warn(`[${status}] ${err.message}`);
  const body = status >= 500 ? { error: 'Something went wrong. Please try again.' } : { error: err.message };
  res.status(status).json(body);
}