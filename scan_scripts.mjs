import fs from 'fs';
import https from 'https';
import vm from 'vm';
import { Buffer } from 'buffer';

const PAGES = [
  'guardmini.html',
  'books.html',
  'search.html',
  'water.html',
];

const SERVED_URL = 'https://sovereignoriginshop.dpdns.org/guardmini.html';

// Robust inline <script> scanner
function scanForScriptBlocks(html) {
  const blocks = [];
  let i = 0;
  while (true) {
    const tagIdx = html.indexOf('<script', i);
    if (tagIdx === -1) break;
    const tagEnd = html.indexOf('>', tagIdx);
    if (tagEnd === -1) break;
    const attrsRaw = html.slice(tagIdx + 7, tagEnd).trim();
    let scriptType = 'inline';
    const typeMatch = attrsRaw.match(/type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (typeMatch) {
      scriptType = typeMatch[1] || typeMatch[2] || typeMatch[3] || 'inline';
    }
    const bodyStart = tagEnd + 1;
    const bodyEndIdx = html.indexOf('</script>', bodyStart);
    if (bodyEndIdx === -1) break;
    const body = html.slice(bodyStart, bodyEndIdx);
    blocks.push({ scriptType, body });
    i = bodyEndIdx + 9;
  }
  return blocks;
}

function countEntities(body) {
  let ampCount = 0;
  let ltCount = 0;
  let gtCount = 0;
  let quotCount = 0;
  let aposCount = 0;
  let rawAmpCount = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '&') {
      ampCount++;
      let isEntity = false;
      if (body.startsWith('&amp;', i) || body.startsWith('&lt;', i) ||
          body.startsWith('&gt;', i) || body.startsWith('&quot;', i) ||
          body.startsWith('&#39;', i) || body.startsWith('&#039;', i)) {
        isEntity = true;
      } else if (body[i+1] === '#') {
        const rest = body.slice(i+2);
        if (/^\d+;/.test(rest)) isEntity = true;
        else if (/^[xX][0-9a-fA-F]+;/.test(rest)) isEntity = true;
      }
      if (!isEntity) rawAmpCount++;
    } else if (ch === '<') ltCount++;
    else if (ch === '>') gtCount++;
    else if (ch === '"') quotCount++;
    else if (ch === "'") aposCount++;
  }
  return { ampCount, ltCount, gtCount, quotCount, aposCount, rawAmpCount };
}

function parseBlock(body, filename, blockIndex) {
  if (body.trim() === '') return 'EMPTY';
  try {
    new vm.Script(body, `${filename}#block${blockIndex}`);
    return 'PARSE_OK';
  } catch (e) {
    return `THREW: ${e.message.split('\n')[0]}`;
  }
}

function runScan(filename, html) {
  const blocks = scanForScriptBlocks(html);
  return {
    filename,
    totalBlocks: blocks.length,
    blocks: blocks.map((b, idx) => {
      const counts = countEntities(b.body);
      return {
        blockIndex: idx,
        scriptType: b.scriptType,
        bodyByteLength: Buffer.byteLength(b.body, 'utf8'),
        ...counts,
        preview: b.body.slice(0, 120),
        parseResult: parseBlock(b.body, filename, idx),
      };
    }),
  };
}

async function fetchServed() {
  return new Promise((resolve, reject) => {
    const tr = new URL(SERVED_URL);
    const req = https.get(tr, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
  });
}

async function main() {
  const results = [];
  for (const fn of PAGES) {
    try {
      const html = fs.readFileSync(fn, 'utf8');
      results.push(runScan(fn, html));
    } catch (e) {
      results.push({ filename: fn, error: e.message });
    }
  }
  try {
    const servedHtml = await fetchServed();
    results.push(runScan('guardmini.html (SERVED)', servedHtml));
  } catch (e) {
    results.push({ filename: 'guardmini.html (SERVED)', error: `FETCH FAILED: ${e.message}` });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
