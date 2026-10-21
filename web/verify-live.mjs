// ตรวจเว็บจริงหลัง CI deploy — ห้ามรายงานสำเร็จโดยไม่รันไฟล์นี้ (บทเรียนเรื่อง deploy เคยพาน)
const BASE = 'https://sovereignoriginshop.dpdns.org';

const checks = [
  { label: 'หน้าแรก = เว็บใหม่ Astro (มี astro-island + dark theme)', path: '/', expect: async (r, t) => r.status === 200 && t.includes('astro-island') && t.includes('dark-950') },
  { label: "หน้าแรกมี island GlassStats/ShaderBG", path: '/', expect: async (r, t) => t.includes('GlassStats') && t.includes('ShaderBG') },
  { label: '/projects/ หน้าใหม่ 200', path: '/projects/', expect: async (r) => r.status === 200 },
  { label: 'หน้าเก่า /books.html ยังอยู่', path: '/books.html', expect: async (r) => r.status === 200 },
  { label: 'หน้าเก่า /demo.html ยังอยู่', path: '/demo.html', expect: async (r) => r.status === 200 },
  { label: 'LEAK: /scraper/README.md ต้อง 404', path: '/scraper/README.md', expect: async (r) => r.status === 404 },
  { label: 'LEAK: /package-lock.json ต้อง 404', path: '/package-lock.json', expect: async (r) => r.status === 404 },
  { label: 'LEAK: /web/package.json ต้อง 404', path: '/web/package.json', expect: async (r) => r.status === 404 },
  { label: 'LEAK: /scraper/marketplace/cli.mjs ต้อง 404', path: '/scraper/marketplace/cli.mjs', expect: async (r) => r.status === 404 },
};

let fail = 0;
for (const c of checks) {
  try {
    const res = await fetch(BASE + c.path, { redirect: 'manual' });
    const text = c.path === '/' ? await res.text() : '';
    const ok = await c.expect(res, text);
    console.log(ok ? 'PASS' : 'FAIL', '|', c.label, '| status', res.status);
    if (!ok) fail++;
  } catch (e) {
    console.log('ERR ', '|', c.label, '|', String(e).slice(0, 120));
    fail++;
  }
}
console.log(fail === 0 ? '\nALL GREEN — deploy สะอาด' : `\n${fail} ข้อ FAIL — deploy มีปัญหา`);
process.exit(fail === 0 ? 0 : 1);
