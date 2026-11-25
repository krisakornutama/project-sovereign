import fs from 'fs';
let h = fs.readFileSync('search.html', 'utf8');
const before = h.length;
h = h.replace(/\.replace\(\/&quot;\/g, '\\\\?"\)\.replace\(\/&nbsp;\/g, ' '\)/g, ".replace(/&quot;/g, '\"').replace(/&nbsp;/g, ' ')");
fs.writeFileSync('search.html', h);
console.log('delta', before - h.length, 'bytes; remaining &quot; in search.html:', (h.match(/&quot;/g) || []).length);
