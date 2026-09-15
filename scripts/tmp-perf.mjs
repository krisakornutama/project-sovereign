/* ชั่วคราว — วัดขนาด/เวลาที่โหลดจริงต่อหน้า (ค่าเริ่มต้น: production) · ลบทิ้งหลังใช้
   ใช้: node scripts/tmp-perf.mjs [baseUrl] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'https://krisakornutama.github.io/project-sovereign').replace(/\/$/, '');
const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html')).sort();

const browser = await chromium.launch();
const rows = [];
for (const page of pages) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); // cache แยกต่อ context
    const p = await ctx.newPage();
    let fontBytes = 0, fontReq = 0, cssBytes = 0;
    p.on('response', async (r) => {
      const u = r.url();
      try {
        if (u.includes('fonts.gstatic.com')) { fontReq++; fontBytes += (await r.body()).length; }
        else if (u.includes('fonts.googleapis.com')) cssBytes += (await r.body()).length;
      } catch { /* body หมดอายุ */ }
    });
    await p.goto(`${base}/${page}?cb=${Date.now()}${i}`, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(500);
    const t = await p.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcp = (performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint') || {}).startTime || 0;
      return { load: nav.loadEventEnd || 0, fcp };
    });
    samples.push({ fontReq, fontBytes, cssBytes, load: t.load, fcp: t.fcp });
    await ctx.close();
  }
  const med = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[1];
  rows.push({ page, fontReq: med('fontReq'), fontKB: +(med('fontBytes') / 1024).toFixed(1), cssKB: +(med('cssBytes') / 1024).toFixed(2), fcp: Math.round(med('fcp')), load: Math.round(med('load')) });
}
const sum = (k) => +rows.reduce((n, r) => n + r[k], 0).toFixed(1);
console.log(`=== ${base} ===`);
for (const r of rows) console.log(`${r.page.padEnd(16)} fontReq=${String(r.fontReq).padStart(2)} fontKB=${String(r.fontKB).padStart(6)} cssKB=${String(r.cssKB).padStart(5)} fcp=${String(r.fcp).padStart(4)}ms load=${String(r.load).padStart(5)}ms`);
console.log(`รวม: fontReq=${sum('fontReq')} fontKB=${sum('fontKB')} cssKB=${sum('cssKB')} · median ต่อหน้า fcp=${Math.round(rows.reduce((n, r) => n + r.fcp, 0) / rows.length)}ms load=${Math.round(rows.reduce((n, r) => n + r.load, 0) / rows.length)}ms`);
fs.writeFileSync(path.join(SITE, `perf-${base.includes('github') ? 'prod' : 'local'}-${Date.now()}.json`), JSON.stringify(rows, null, 1));
await browser.close();
