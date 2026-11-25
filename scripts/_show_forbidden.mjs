import fs from 'fs';

const files = ['guardmini.html','water.html','books.html','projects.html','shop.html','search.html','index.html','livestock.html'];
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
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
  const badBlocks = blocks.filter(b => /&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/i.test(b.js));
  if (badBlocks.length) {
    console.log('===', f, 'badBlocks', badBlocks.length);
    badBlocks.forEach((b, idx) => {
      const m = [...b.js.matchAll(/&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/gi)];
      console.log(' block', idx, 'matches', m.length);
      m.slice(0, 8).forEach(x => console.log('   ', x[0], JSON.stringify(b.js.slice(x.index - 25, x.index + 25))));
    });
  } else {
    console.log('OK', f, 'blocks', blocks.length);
  }
}
