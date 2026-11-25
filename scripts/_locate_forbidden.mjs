import fs from 'fs';

const files = ['livestock.html','projects.html','shop.html','water.html','guardmini.html','books.html','me.html','index.html','search.html'];

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
    const js = body.slice(start, c);
    blocks.push({ attrs: om[1], js });
    i = end;
  }
  blocks.forEach((b, idx) => {
    if (b.js.length > 0 && /&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/i.test(b.js)) {
      const matches = [...b.js.matchAll(/&amp;|&lt;|&gt;|&quot;|&#0*39;|&#39;|&#x27;/gi)];
      console.log('===', f, 'block', idx, 'forbidden matches:', matches.length);
      matches.slice(0, 20).forEach(m => {
        console.log('   ', m.index, m[0], JSON.stringify(b.js.slice(m.index - 30, m.index + 30)));
      });
    }
    // bounded literal token search
    if (b.js.includes('</script') || b.js.includes('<script')) {
      let p = 0;
      let guard = 0;
      while (p < b.js.length && guard++ < 5000) {
        const a = b.js.indexOf('<script', p);
        const b2 = b.js.indexOf('</script', p);
        if (a < 0 && b2 < 0) break;
        const nx = (a < 0 ? Infinity : a) <= (b2 < 0 ? Infinity : b2) ? a : b2;
        const tok = (a === nx ? '<script' : '</script');
        console.log('===', f, 'block', idx, 'LITERAL', tok, 'at js-local offset', nx, JSON.stringify(b.js.slice(nx - 30, nx + 40)));
        p = nx + 1;
      }
    }
  });
}
