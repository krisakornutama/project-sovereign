import fs from 'fs';

const h = fs.readFileSync('books.html', 'utf8');
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
  blocks.push({ attrs: om[1], js: body.slice(start, c) });
  i = end;
}
blocks.forEach((b, idx) => {
  const isJsonLd = b.attrs.includes('application/ld+json');
  const bad = /&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/i.test(b.js);
  console.log('books block', idx, isJsonLd ? 'JSON-LD' : 'inline', 'len', b.js.length, 'forbidden=', bad);
  if (bad) {
    const m = [...b.js.matchAll(/&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/gi)];
    m.slice(0, 10).forEach(x => {
      console.log('   ', x.index, x[0], JSON.stringify(b.js.slice(x.index - 25, x.index + 25)));
    });
  }
});
