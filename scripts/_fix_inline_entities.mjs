import fs from 'fs';

function fixFile(file, edits) {
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  for (const e of edits) {
    if (e.regex) {
      h = h.replace(e.regex, e.replacement);
    } else {
      if (h.indexOf(e.before) === -1) {
        console.warn('WARN', file, 'expected snippet not found — skipping one edit');
      } else {
        h = h.split(e.before).join(e.after);
      }
    }
  }
  fs.writeFileSync(file, h);
  console.log('wrote', file, 'delta', before.length - h.length, 'bytes; remaining &amp;:', (h.match(/&amp;/g) || []).length);
}

// --- books.html: already stripped JSON-LD block; fix helper regex + map, fix && ---
fixFile('books.html', [
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);

// --- me.html: strip inline JSON-LD block from body (generator will regenerate into head) ---
fixFile('me.html', [
  {
    regex: /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi,
    replacement: ''
  },
]);

// --- guardmini.html: fix loadEvidence esc helper regex + map ---
fixFile('guardmini.html', [
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);

// --- livestock.html: fix P&amp;L comment and helper if present ---
fixFile('livestock.html', [
  {
    regex: /P&amp;L/g,
    replacement: 'P&L'
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);

// --- projects.html: fix mailto body entity and helper if present ---
fixFile('projects.html', [
  {
    regex: /&amp;body=/g,
    replacement: '&body='
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
]);

// --- shop.html: fix mailto body entity and helper if present ---
fixFile('shop.html', [
  {
    regex: /&amp;body=/g,
    replacement: '&body='
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
]);

// --- water.html: fix helper regex + map and &amp;&amp; ---
fixFile('water.html', [
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);

// --- index.html: break literal <script token in JS string ---
fixFile('index.html', [
  {
    regex: /'<script src="nav\.js" defer>'/g,
    replacement: "'<scr' + 'ipt src=\"nav.js\" defer>'"
  },
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);

// --- search.html: break literal <script> in Thai comment, fix stripTags helper regex + map, fix &amp;&amp; ---
fixFile('search.html', [
  {
    regex: /ตัด\s*<script>\/<style>\s*ก่อน/g,
    replacement: 'ตัด <scr' + 'ipt>/<style> ก่อน'
  },
  {
    regex: /\(\[&amp;<>\"'\]/g,
    replacement: '(/[&<>"\'/g'
  },
  {
    regex: /\{\s*&amp;\s*:\s*&amp;\s*,\s*<\s*:\s*&lt;\s*,\s*>\s*:\s*&gt;\s*,\s*\"\s*:\s*&quot;\s*,\s*'"\s*:\s*&#39;\s*\}/gi,
    replacement: "{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}"
  },
  {
    regex: /&amp;&amp;/g,
    replacement: '&&'
  },
]);
