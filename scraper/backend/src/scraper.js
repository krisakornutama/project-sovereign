import * as cheerio from 'cheerio';
import { assertPublicUrl } from './ssrfGuard.js';

// Upper bound on HTML handed to the parser. The content-length header is
// checked first (cheap reject); the slice is belt-and-braces for lying
// headers or chunked bodies.
export const MAX_HTML_BYTES = 2_000_000;

// Same protocol-only rule as before: it validates *shape* for callers such as
// the billing redirect validator. It is deliberately NOT a safety check for
// scraping — use assertPublicUrl() before fetching anything.
export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function scrapeUrl(url, fetchFn = fetch, opts = {}) {
  const clean = String(url).trim();
  const u = new URL(clean);
  const domain = u.hostname;

  // Refuse private/internal targets before a single byte goes out. Without
  // this the visitor can aim the server at cloud metadata, the Railway
  // network, or a localhost admin port and read the reply back through the
  // parsed title/description.
  //
  // `skipSsrfCheck` exists for the unit tests, which inject a fake fetch and
  // must not depend on live DNS. It is never set on the request path.
  if (!opts.skipSsrfCheck) {
    await assertPublicUrl(clean);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res;
  try {
    res = await fetchFn(clean, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'SovereignScraper/1.0 (+micro-saas)' }
    });
  } catch (err) {
    throw Object.assign(new Error(`fetch failed: ${err.message}`), { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw Object.assign(new Error(`upstream responded ${res.status}`), { status: 502 });
  }
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
    throw Object.assign(new Error('upstream response too large'), { status: 502 });
  }
  const html = (await res.text()).slice(0, MAX_HTML_BYTES);
  const $ = cheerio.load(html);

  const title = ($('title').first().text() || '').trim().slice(0, 300);
  const description =
    ($('meta[name="description"]').attr('content') || '').trim().slice(0, 500);
  const h1Count = $('h1').length;
  const bodyText = ($('body').text() || '').replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

  return { url: clean, domain, title, description, h1Count, wordCount, status: 'ok' };
}
