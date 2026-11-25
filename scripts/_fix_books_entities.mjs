import fs from 'fs';

let h = fs.readFileSync('books.html', 'utf8');
const before = h;

// 1) Fix entity-corrupted BookDetails URLs inside JS data.
h = h.replace(/action=BookDetails&amp;book_id=/g, 'action=BookDetails&book_id=');

// 2) Fix on-page HTML-escape helper so its SOURCE uses real characters,
//    not HTML entities (the helper still escapes for rendered text; only the
//    JS source text changes).
h = h.replace(
  /\(\[&amp;<>\"'\]/g,
  '(/[&<>"\']/g'
);
h = h.replace(
  /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\""\s*:\s*&quot;\s*,\s*"'"\s*:\s*&#39;\s*\}/gi,
  "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
);

// 3) Fix boolean &amp;&amp; corruption inside JS (gAuthor &amp;&amp;, gYear &amp;&amp;, ox == null &amp;&amp;).
h = h.replace(/&amp;&amp;/g, '&&');

fs.writeFileSync('books.html', h);

console.log('written; delta bytes:', before.length - h.length);
console.log('remaining action=BookDetails&amp;book_id:', (h.match(/action=BookDetails&amp;book_id/g) || []).length);
console.log('remaining &amp; in JS source (rough):', (h.match(/&amp;/g) || []).length);
