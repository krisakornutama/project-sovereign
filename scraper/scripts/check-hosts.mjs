#!/usr/bin/env node
// Host health guard for the deployed shop.
//
// The failure that started this whole investigation was NOT "host is down".
// It was: the root document returned 200 while every asset under /assets/
// returned 403 — a page that renders blank for a real visitor and looks
// healthy to any check that only looks at "/". This guard asserts the
// pairing instead, so that state can never pass silently again.
//
// Read-only: HTTP GET/HEAD only. No writes, no secrets.
// Exit 0 only if every assertion passes.

const HOSTS = {
  canonical: 'https://harvest-ledger.pages.dev',
  api: 'https://api.sovereignoriginshop.dpdns.org',
};

// The custom domain was detached from the Pages project, so the apex is the
// canonical address. It is still watched: if someone re-attaches it we want
// to know whether it works end to end, not just whether "/" answers 200.
const ATTACHED_CANDIDATES = ['https://app.sovereignoriginshop.dpdns.org'];

let passed = 0;
let failed = 0;
const ok = (m) => { passed++; console.log(`  \u001b[32mPASS\u001b[0m  ${m}`); };
const bad = (m, d) => { failed++; console.log(`  \u001b[31mFAIL\u001b[0m  ${m}`); if (d) console.log(`        -> ${d}`); };
const eq = (label, expected, actual) =>
  expected === actual ? ok(`${label} (${actual})`) : bad(label, `expected=${expected} actual=${actual}`);

const code = async (url) => {
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
    return String(r.status);
  } catch (e) {
    return `ERR(${e.name})`;
  }
};

// Pull the bundle path out of the served HTML so the asset check follows
// whatever the deployment actually references, not a hardcoded filename.
async function bundleRef(base) {
  try {
    const r = await fetch(`${base}/`, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch { return null; }
}

// The core assertion: a served page is only "usable" if the asset it tells
// the browser to load is also reachable.
async function assertUsablePair(label, base) {
  const root = await code(`${base}/`);
  if (root !== '200') {
    console.log(`  \u001b[90mSKIP\u001b[0m  ${label}: not serving ("/" -> ${root})`);
    return { served: false, root };
  }
  const ref = await bundleRef(base);
  if (!ref) { bad(`${label}: served "/" but no bundle reference found`); return { served: true, root }; }
  const asset = await code(`${base}${ref}`);
  if (asset !== '200') {
    bad(`${label}: BLANK PAGE RISK — "/" is 200 but ${ref} is ${asset}`,
        'root document loads, assets do not — visitors see an empty page');
  } else {
    ok(`${label}: "/" and ${ref} both 200`);
  }
  return { served: true, root, asset };
}

console.log('=== canonical storefront ===');
await assertUsablePair('harvest-ledger.pages.dev', HOSTS.canonical);

console.log('\n=== backend ===');
eq('api /health', '200', await code(`${HOSTS.api}/health`));
eq('api /api/billing/credits', '200', await code(`${HOSTS.api}/api/billing/credits`));

console.log('\n=== custom domain (only checked when it is actually serving) ===');
for (const base of ATTACHED_CANDIDATES) {
  await assertUsablePair(base.replace('https://', ''), base);
}

console.log('\n======================================================');
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed === 0) { console.log('all hosts serve a real page with working assets'); process.exit(0); }
console.log('a host is serving a document whose assets are blocked — fix the blocking rule before advertising that URL');
process.exit(1);