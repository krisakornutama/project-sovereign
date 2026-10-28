// ตรวจเว็บจริงหลัง CI deploy — ห้ามรายงานสำเร็จโดยไม่รันไฟล์นี้ (บทเรียนเรื่อง deploy หลุดโค้ดขึ้นเว็บ)
const BASE = 'https://sovereignoriginshop.dpdns.org';

const checks = [
  { label: 'หน้าแรก = เว็บใหม่ Astro (astro-island + dark-950)', path: '/', expect: async (r, t) => r.status === 200 && t.includes('astro-island') && t.includes('dark-950') },
  { label: 'หน้าแรกมี island GlassStats/ShaderBG', path: '/', expect: async (r, t) => t.includes('GlassStats') && t.includes('ShaderBG') },
  { label: '/projects.html หน้าใหม่ 200', path: '/projects.html', expect: async (r) => r.status === 200 },
  ...['books', 'water', 'search', 'en', 'farm', 'fishery', 'livestock', 'guardmini', 'iot', 'education', 'me', 'demo', 'pos', 'media', 'backup'].map((p) => ({
    label: `/${p}.html 200`, path: `/${p}.html`, expect: async (r) => r.status === 200,
  })),
  { label: 'LEAK: /scraper/README.md ต้อง 404', path: '/scraper/README.md', expect: async (r) => r.status === 404 },
  { label: 'package-lock.json ยังอยู่ตามเดิม (tree คงของ; workflow v2 ค่อยกรอง)', path: '/package-lock.json', expect: async (r) => r.status === 200 },
  { label: 'LEAK: /web/package.json ต้อง 404', path: '/web/package.json', expect: async (r) => r.status === 404 },
  { label: 'LEAK: /scraper/marketplace/cli.mjs ต้อง 404', path: '/scraper/marketplace/cli.mjs', expect: async (r) => r.status === 404 },
  { label: '/sw.js service worker 200 (โหมดออฟไลน์)', path: '/sw.js', expect: async (r, t) => r.status === 200 && t.includes('sovereign-offline') },
  { label: '/manifest.webmanifest 200 (PWA)', path: '/manifest.webmanifest', expect: async (r, t) => r.status === 200 && t.includes('"start_url"') },
  { label: 'nav.js มีส่วนลงทะเบียน SW ครบทุกหน้า', path: '/nav.js', expect: async (r, t) => r.status === 200 && t.includes('serviceWorker.register') },
];

let fail = 0;
for (const c of checks) {
  try {
    const res = await fetch(BASE + c.path, { redirect: 'manual' });
    const text = await res.text();
    const ok = await c.expect(res, text);
    console.log(ok ? 'PASS' : 'FAIL', '|', c.label, '| status', res.status);
    if (!ok) fail++;
  } catch (e) {
    console.log('ERR ', '|', c.label, '|', String(e).slice(0, 120));
    fail++;
  }
}
console.log(fail === 0 ? '\nALL GREEN — deploy สะอาด' : '\n' + fail + ' ข้อ FAIL — deploy มีปัญหา');
process.exit(fail === 0 ? 0 : 1);
