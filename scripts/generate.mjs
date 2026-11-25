import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = process.argv[2] || '.';
const PAGES_FILE = join(ROOT, 'meta', 'pages.json');
const NAV_FILE = join(ROOT, 'meta', 'nav.json');
const SHARED_CSS_FILE = join(ROOT, 'css', 'shared.css');
const PER_PAGE_CSS_DIR = join(ROOT, 'css', 'per-page');

const PAGES = JSON.parse(readFileSync(PAGES_FILE, 'utf8'));
const NAV = JSON.parse(readFileSync(NAV_FILE, 'utf8'));
const SHARED_CSS = readFileSync(SHARED_CSS_FILE, 'utf8');

const files = readdirSync(ROOT).filter(f => f.endsWith('.html'));

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeBodyContent(html) {
  // Escape & in text content (not in tag/attribute)
  // Replace & that is not followed by #\d+ or \w+; with &amp;
  return html.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|\w+;)/g, '&amp;');
}

// Collect inline <script> blocks *in document order*, mirroring the browser
// rule: a <script> ends at the first "</script" (case-insensitive) followed by
// optional whitespace and ">". We do NOT pass JS through escapeBodyContent.
//
// If a block's JS body already contains a literal "<script" or "</script>"
// substring, the source file is not safely representable as one inline <script>
// and we fail loudly rather than silently mis-splitting it.
const SCRIPT_OPEN_RE = /<script\b([^>]*)>/i;
const SCRIPT_CLOSE_RE = /<\/script\s*>/i;

function extractScriptBlocks(body, file) {
  const blocks = [];
  let i = 0;
  while (i < body.length) {
    const openIdx = body.indexOf('<script', i);
    if (openIdx === -1) break;
    const openMatch = body.slice(openIdx).match(SCRIPT_OPEN_RE);
    if (!openMatch) { i = openIdx + 7; continue; }
    const attrs = openMatch[1];
    const tagEnd = openIdx + openMatch[0].length;
    const bodyStart = tagEnd;

    const closeIdx = body.indexOf('</script', bodyStart);
    if (closeIdx === -1) {
      throw new Error(`Malformed <script> with no </script> in ${file}`);
    }
    const afterClose = body.slice(closeIdx);
    const closeTagMatch = afterClose.match(SCRIPT_CLOSE_RE);
    if (!closeTagMatch) {
      throw new Error(`Malformed </script> token in ${file}`);
    }
    const tagCloseEnd = closeIdx + closeTagMatch[0].length;

    const js = body.slice(bodyStart, closeIdx);
    if (js.includes('</script') || js.includes('<script')) {
      throw new Error(
        `Inline <script> in ${file} contains a literal "<script" or "</script>" token in its JS body ` +
        `(first such token at byte offset ${closeIdx} within the body). Browsers already treat that as ` +
        `the end of the block, so this source cannot be safely represented as one inline <script>. ` +
        `Clean the JS source instead of working around it in the generator.`
      );
    }
    blocks.push({ attrs, js });
    i = tagCloseEnd;
  }
  return blocks;
}

// Shroud inline scripts with unique markers so escapeBodyContent never sees them,
// then restore them in marker order afterwards. Markers are built from file name,
// wall-clock ms, and block index so collisions across runs/pages are not a concern.
function shroudAndRestore(body, blocks, file) {
  const markerPrefix = '\u0000SB_' + file + '_' + Date.now() + '_';
  // If a prior run left stale markers, wipe them so they cannot shift indices.
  body = body.split(/\u0000SB_[^_]*_[0-9_]+_/).join('');

  let out = body;
  for (let idx = 0; idx < blocks.length; idx++) {
    const marker = markerPrefix + idx + '_';
    const openMatch = SCRIPT_OPEN_RE.exec(out);
    if (!openMatch) break;
    const start = openMatch.index;
    const closeIdx = out.indexOf('</script', start);
    if (closeIdx === -1) break;
    const afterClose = out.slice(closeIdx);
    const closeTagMatch = afterClose.match(SCRIPT_CLOSE_RE);
    if (!closeTagMatch) break;
    const end = closeIdx + closeTagMatch[0].length;
    out = out.slice(0, start) + marker + out.slice(end);
    SCRIPT_OPEN_RE.lastIndex = 0;
  }

  for (let idx = 0; idx < blocks.length; idx++) {
    const marker = markerPrefix + idx + '_';
    const pos = out.indexOf(marker);
    if (pos === -1) {
      throw new Error(`Internal: marker for script block #${idx} missing in ${file}`);
    }
    const block = blocks[idx];
    out = out.slice(0, pos)
      + '<script' + block.attrs + '>' + block.js + '</script>'
      + out.slice(pos + marker.length);
  }
  return out;
}

// Forbidden HTML entities that must never reach restored JS verbatim (they break
// JS syntax). Real "&" in JS (e.g. boolean && or URI query &) is fine — we only
// reject escaped forms.
function hasForbiddenEntities(text) {
  return /&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/i.test(text);
}

function tryParseJs(js, file, label) {
  if (!js || !js.trim()) return null;
  try {
    new vm.Script(js, `${file} :: ${label}`);
    return null;
  } catch (e) {
    return e.message.split('\n')[0];
  }
}

function generateNav(activeHref) {
  const sections = {};
  for (const item of NAV.default) {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  }

  let html = `<button class="rail-toggle" type="button" aria-label="เปิดเมนูหมวดหน้าเว็บ">☰</button>\n<aside class="rail" id="siteRail">\n  <a class="spine" href="index.html" aria-label="กลับหน้าภาพรวม (PROJECT SOVEREIGN)"><span class="spine-t">PROJECT SOVEREIGN</span></a>`;

  for (const [sectionName, items] of Object.entries(sections)) {
    html += `\n  <p class="seclab">${sectionName}</p>`;
    for (const item of items) {
      const active = item.href === activeHref ? ' aria-current="page"' : '';
      html += `\n  <a href="${escapeHtml(item.href)}"${active}>${escapeHtml(item.label)}</a>`;
    }
  }
  html += '\n</aside>';
  return html;
}

function generateHead(meta, perPageCss) {
  const ogImage = meta.ogImage || PAGES.defaultOgImage;
  const twitterImage = meta.twitterImage || PAGES.defaultTwitterImage;

  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const author = meta.author ? escapeHtml(meta.author) : null;
  const ogType = escapeHtml(meta.ogType || 'website');
  const ogLocale = escapeHtml(meta.ogLocale || 'th_TH');

  let html = `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<meta name="description" content="${desc}">`;
  if (author) html += `\n<meta name="author" content="${author}">`;
  html += `\n<meta name="theme-color" content="#030712">\n<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="%23030712"/><rect x="4" y="3" width="8" height="10" rx="1" fill="%23F2D8D8"/><rect x="4" y="3" width="1.2" height="10" fill="%23B3352C"/></svg>')}"\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+Thai+Looped:wght@400;500;600;700&display=swap" rel="stylesheet">\n<link rel="canonical" href="${meta.canonical}">\n<meta property="og:type" content="${ogType}">\n<meta property="og:site_name" content="Project Sovereign">\n<meta property="og:locale" content="${ogLocale}">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">\n<meta property="og:url" content="${meta.canonical}">\n<meta property="og:image" content="${ogImage}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`;
  if (meta.hasTwitterCard) {
    html += `\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${title}">\n<meta name="twitter:description" content="${desc}">\n<meta name="twitter:image" content="${twitterImage}">`;
  }
  html += `\n<style>\n/* shared.css */\n${SHARED_CSS}\n/* per-page CSS */\n${perPageCss}\n</style>`;
  return html;
}

function generateJsonLd(jsonLd) {
  if (!jsonLd) return '';
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

let generated = 0;
for (const file of files) {
  const meta = PAGES.pages[file];
  if (!meta) {
    console.log(`- ${file}: no metadata (skipped)`);
    continue;
  }

  const original = readFileSync(join(ROOT, file), 'utf8');

  // extract body content (strip head + style)
  let body = original
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/^\s*<!doctype html>\s*<html[^>]*>/i, '')
    .replace(/<\/html>\s*$/i, '')
    .trim();

  // รักษา inline <script> ให้เป็น JS ดั้งเดิม — ยก script content ออกจาก body ก่อนเรียก escapeBodyContent
  // แล้วค่อย restore กลับมาที่ placeholder หลัง escape (js content ตัวเดิม ไม่ผ่าน escape)
  let scriptBlocks;
  try {
    scriptBlocks = extractScriptBlocks(body, file);
  } catch (e) {
    console.error(`FAIL ${file}: cannot extract inline scripts safely — ${e.message}`);
    process.exitCode = 1;
    continue;
  }

  body = shroudAndRestore(body, scriptBlocks, file);

  // Escape & in text content (not in tag/attribute) — ครั้งนี้ body ไม่มี inline script content แล้ว
  body = escapeBodyContent(body);

  // JSON-LD: ตัดบล็อก <script type="application/ld+json"> เก่าออกก่อน เพื่อไม่ให้ stack ซ้ำทุก generation pass
  const jsonLdHtml = generateJsonLd(meta.jsonLd);
  if (jsonLdHtml) {
    body = body.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
    body = jsonLdHtml + '\n' + body;
  }

  // ── Entity + parse guard ──────────────────────────────────────────────
  for (let idx = 0; idx < scriptBlocks.length; idx++) {
    const js = scriptBlocks[idx].js;
    if (hasForbiddenEntities(js)) {
      console.error(
        `FAIL ${file}: inline <script> block #${idx} contains forbidden HTML entities in its JS source. ` +
        `This is carry-over corruption from a prior bad generation or a bad source edit. ` +
        `Fix the JS in that block, then regenerate. Offending snippet:\n${js.slice(0, 400)}`
      );
      process.exitCode = 1;
    }
    const parseErr = tryParseJs(js, file, `inline script #${idx}`);
    if (parseErr) {
      console.error(
        `FAIL ${file}: inline <script> block #${idx} does not parse as JS: ${parseErr}. Snippet:\n${js.slice(0, 400)}`
      );
      process.exitCode = 1;
    }
  }

  if (jsonLdHtml) {
    const jsonLdMatch = jsonLdHtml.match(/<script\b[^>]*>([\s\S]*)<\/script>/i);
    if (jsonLdMatch) {
      const payload = jsonLdMatch[1];
      if (hasForbiddenEntities(payload)) {
        console.error(
          `FAIL ${file}: generated JSON-LD contains forbidden HTML entities. ` +
          `JSON.stringify should never produce them; this means meta.jsonLd was edited with escaped text. ` +
          `Offending snippet:\n${payload.slice(0, 400)}`
        );
        process.exitCode = 1;
      }
      try {
        JSON.parse(payload);
      } catch (e) {
        console.error(
          `FAIL ${file}: generated JSON-LD is not valid JSON: ${e.message}. Snippet:\n${payload.slice(0, 400)}`
        );
        process.exitCode = 1;
      }
    }
  }

  const nav = NAV.noNav.includes(file) ? '' : generateNav(file);
  const perPageCssFile = join(PER_PAGE_CSS_DIR, file.replace('.html', '.css'));
  const perPageCss = readFileSync(perPageCssFile, 'utf8');
  const head = generateHead(meta, perPageCss);

  const html = `<!doctype html>\n<html lang="${meta.lang || 'th'}">\n<head>\n${head}\n</head>\n<body>\n${nav}\n<div class="wrap">\n${body}\n</div>\n</body>\n</html>`;

  writeFileSync(join(ROOT, file), html, 'utf8');
  console.log(`✓ ${file}: generated (${html.length} bytes, ${nav ? 'with nav' : 'no nav'}, ${meta.jsonLd ? 'with jsonLd' : 'no jsonLd'})`);
  generated++;
}

console.log(`\nDone: generated ${generated} file(s)`);
