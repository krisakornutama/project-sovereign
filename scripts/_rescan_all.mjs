import fs from 'fs';

const ROOT = '.';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

for (const file of files) {
  const h = fs.readFileSync(file, 'utf8');
  const body = h
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/^\s*<!doctype html>\s*<html[^>]*>/i, '')
    .replace(/<\/html>\s*$/i, '')
    .trim();
  const blocks = [];
  let i = 0;
  while (i < body.length) {
    const o = body.indexOf('<script', i);
    if (o === -1) break;
    const om = body.slice(o).match(/<script\b([^>]*)>/i);
    if (!om) { i = o + 7; continue; }
    const start = o + om[0].length;
    const c = body.indexOf('</script', start);
    if (c === -1) break;
    const cm = body.slice(c).match(/<\/script\s*>/i);
    if (!cm) break;
    const end = c + cm[0].length;
    const js = body.slice(start, c);
    blocks.push({ attrs: om[1], js });
    i = end;
  }

  let bad = false;
  blocks.forEach((b, idx) => {
    const isJsonLd = b.attrs.includes('application/ld+json');
    const forbidden = /&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/i.test(b.js);
    let literalPos = -1;
    let literalTok = '';
    if (b.js.includes('</script') || b.js.includes('<script')) {
      let p = 0; let g = 0;
      while (p < b.js.length && g++ < 200) {
        const a = b.js.indexOf('<script', p);
        const bb = b.js.indexOf('</script', p);
        if (a < 0 && bb < 0) break;
        const nx = (a < 0 ? Infinity : a) <= (bb < 0 ? Infinity : bb) ? a : bb;
        literalPos = nx;
        literalTok = (a === nx ? '<script' : '</script');
        p = nx + 1;
      }
    }
    if (forbidden || (literalPos >= 0 && isJsonLd === false)) {
      bad = true;
      console.log('FAIL', file, 'block', idx, isJsonLd ? 'JSON-LD' : 'inline', 'forbidden=', forbidden, 'literal=', literalTok, literalPos >= 0 ? '@' + literalPos : '');
      if (forbidden) {
        const m = [...b.js.matchAll(/&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/gi)];
        m.slice(0, 4).forEach(x => console.log('    ', x[0], JSON.stringify(b.js.slice(x.index - 15, x.index + 15))));
      }
      if (literalPos >= 0) {
        console.log('    literal', literalTok, 'at', literalPos, JSON.stringify(b.js.slice(literalPos - 20, literalPos + 30)));
      }
    }
  });
  if (!bad) console.log('OK', file, 'blocks', blocks.length);
}
