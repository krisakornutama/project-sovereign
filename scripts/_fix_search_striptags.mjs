import fs from 'fs';
let h = fs.readFileSync('search.html', 'utf8');
const before = h.length;
h = h.replace(
  /function stripTags\(s\)\{\s*return s\.replace\(\/<[^>]*>\/g,\s*' '\)\s*\.\s*replace\(\/&amp;\/g,\s*'&'\)\s*\.\s*replace\(\/&lt;\/g,\s*'<'\)\s*\.\s*replace\(\/&gt;\/g,\s*'>'\)\s*\.\s*replace\(\/&quot;\/g,\s*'?"?'\)\s*\.\s*replace\(\/&nbsp;\/g,\s*' '\)\s*;?\s*\}/g,
  "function stripTags(s){ return s.replace(/<[^>]*>/g, ' ').replace(/&/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '\"').replace(/&nbsp;/g, ' '); }"
);
fs.writeFileSync('search.html', h);
console.log('delta', before - h.length, 'bytes; remaining &amp;:', (h.match(/&amp;/g) || []).length, 'remaining &quot;:', (h.match(/&quot;/g) || []).length);
