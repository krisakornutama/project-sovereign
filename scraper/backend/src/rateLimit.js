// In-memory sliding-window rate limiter with a hard bound on tracked keys.
// Without maxKeys, every unique IP leaves a permanent Map entry (leak).
// Under extreme key pressure the oldest bucket is dropped first — its
// counter resets, which is the safe trade-off vs unbounded growth.
export function createRateLimiter({ windowMs = 60_000, max = 120, maxKeys = 5000 } = {}) {
  const hits = new Map();

  function prune(now) {
    for (const [k, v] of hits) {
      if (v.length === 0 || now - v[v.length - 1] >= windowMs) hits.delete(k);
      if (hits.size < maxKeys) break;
    }
    if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
  }

  function middleware(req, _res, next) {
    const now = Date.now();
    if (hits.size >= maxKeys) prune(now);
    const key = req.ip || 'anon';
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (arr.length > max) {
      return next(Object.assign(new Error('Too many requests'), { status: 429 }));
    }
    next();
  }

  middleware._hits = hits;
  return middleware;
}
