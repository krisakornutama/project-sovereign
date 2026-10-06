#!/usr/bin/env node
/* Site contract gate — static, zero dependencies, no browser, finishes in
   well under a second, so it can run on every push *and* every pull request.

   scripts/audit.js already owns dead internal links + anchors (part 1) and the
   Thai copy gate (part 1.5). This file owns the three things audit.js never
   looks at, because they are files and head tags rather than link targets:

     1. sitemap completeness   every *.html is listed, no stale entries, and
                               robots.txt points at the very sitemap being read
     2. OG / meta coverage     share + SEO tags on every page, with canonical
                               and og:url agreeing with the page's own URL
     3. IndexNow key           exactly one 32-hex key file at the site root,
                               whose content is the filename minus .txt

   Run both gates for full coverage:
     node scripts/audit.js           (dead links + anchors + copy gate)
     node scripts/check-site.mjs     (this file)

   Exit 0 = clean · exit 1 = at least one FAIL. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function report(ok, label, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

/* Markup without <script>/<style>: search.html embeds a <meta name="description">
   pattern inside its own JS, which must not count as a real tag (same rule
   audit.js applies when scanning links). */
const markup = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

/** Value of <meta attr="name" content="…">, or null when the tag is absent. */
function metaValue(html, attr, name) {
  const tag = html.match(new RegExp(`<meta\\b[^>]*\\b${attr}="${name}"[^>]*>`, 'i'));
  if (!tag) return null;
  const content = tag[0].match(/\bcontent="([^"]*)"/i);
  return content ? content[1].trim() : null;
}

function linkHref(html, rel) {
  const tag = html.match(new RegExp(`<link\\b[^>]*\\brel="${rel}"[^>]*>`, 'i'));
  if (!tag) return null;
  const href = tag[0].match(/\bhref="([^"]*)"/i);
  return href ? href[1].trim() : null;
}

/* ───────── site base URL comes from robots.txt, not from a hard-coded constant ───────── */
const robots = fs.existsSync(path.join(ROOT, 'robots.txt')) ? read('robots.txt') : null;
const sitemapRef = robots && (robots.match(/^Sitemap:\s*(\S+)/mi) || [])[1];
report(!!sitemapRef, 'robots.txt declares a Sitemap', sitemapRef || 'no "Sitemap:" line');
const BASE = sitemapRef ? sitemapRef.replace(/\/sitemap\.xml$/, '') : '';
const pageUrl = (page) => `${BASE}/${page === 'index.html' ? '' : page}`;

/* ───────── 1. sitemap completeness ───────── */
if (fs.existsSync(path.join(ROOT, 'sitemap.xml'))) {
  const sitemap = read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  const files = locs.map((loc) => {
    if (BASE && loc.startsWith(`${BASE}/`)) {
      const rest = loc.slice(BASE.length + 1);
      return rest === '' ? 'index.html' : rest.endsWith('/') ? `${rest}index.html` : rest;
    }
    return null;
  });

  const listed = new Set(files.filter(Boolean));
  const missing = pages.filter((p) => !listed.has(p));
  report(missing.length === 0, `sitemap lists all ${pages.length} pages`,
    missing.length ? `missing: ${missing.join(', ')}` : '');

  const stale = locs.filter((_, i) => !files[i] || !fs.existsSync(path.join(ROOT, files[i])));
  report(stale.length === 0, 'sitemap has no stale or out-of-base entries',
    stale.length ? `unusable: ${stale.join(', ')}` : '');

  const dupes = files.filter((f, i) => f && files.indexOf(f) !== i);
  report(dupes.length === 0, 'sitemap has no duplicate entries',
    dupes.length ? `duplicated: ${[...new Set(dupes)].join(', ')}` : '');

  report(sitemapRef === `${BASE}/sitemap.xml` && !!robots && robots.includes(sitemapRef),
    'robots.txt points at this sitemap', sitemapRef || '');
} else {
  report(false, 'sitemap.xml exists');
}

/* ───────── 2. OG / meta coverage ───────── */
const REQUIRED_OG = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image'];
const problems = new Map(); // page -> [reasons]

for (const page of pages) {
  const head = markup(read(page));
  const why = [];

  const title = (head.match(/<title>([^<]*)<\/title>/i) || [])[1];
  if (!title || !title.trim()) why.push('missing <title>');

  const descriptions = [...head.matchAll(/<meta\b[^>]*\bname="description"[^>]*>/gi)];
  if (descriptions.length === 0) why.push('missing meta description');
  else if (descriptions.length > 1) why.push(`${descriptions.length} meta descriptions`);

  const canonical = linkHref(head, 'canonical');
  if (!canonical) why.push('missing canonical');
  else if (canonical !== pageUrl(page)) why.push(`canonical ${canonical} ≠ ${pageUrl(page)}`);

  for (const prop of REQUIRED_OG) {
    if (!metaValue(head, 'property', prop)) why.push(`missing ${prop}`);
  }
  if (!metaValue(head, 'name', 'twitter:card')) why.push('missing twitter:card');

  const image = metaValue(head, 'property', 'og:image');
  if (image && BASE && image.startsWith(`${BASE}/`)) {
    const file = image.slice(BASE.length + 1);
    if (!fs.existsSync(path.join(ROOT, file))) why.push(`og:image points at missing ${file}`);
  }

  const ogUrl = metaValue(head, 'property', 'og:url');
  if (ogUrl && canonical && ogUrl !== canonical) why.push(`og:url ${ogUrl} ≠ canonical`);

  if (why.length) problems.set(page, why);
}

const covered = pages.length - problems.size;
report(problems.size === 0, `OG/meta coverage on all ${pages.length} pages`,
  problems.size ? `${covered}/${pages.length} — see detail below` : '');
for (const [page, why] of problems) console.log(`       ${page}: ${why.join(' · ')}`);

/* ───────── 3. IndexNow key consistency ───────── */
const keyFiles = fs.readdirSync(ROOT).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
report(keyFiles.length === 1, 'exactly one lowercase 32-hex IndexNow key file at the root',
  keyFiles.length ? `found ${keyFiles.length}: ${keyFiles.join(', ')}` : 'none found');

if (keyFiles.length === 1) {
  const key = keyFiles[0].slice(0, -4);
  const content = read(keyFiles[0]).trim();
  report(content === key, 'IndexNow key file content equals its filename',
    content === key ? key : `content "${content}" ≠ filename "${key}"`);
}

console.log(failures === 0 ? 'SITE CONTRACT CLEAN' : `SITE CONTRACT FAILED: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
