/* sw.js — โหมดออฟไลน์ของเว็บ Sovereign (ห้ามแตะโลจิกหน้าเว็บ เฉพาะแคช)
   หลักการ:
   - หน้าเว็บ (.html) = network-first (ออนไลน์ได้ของใหม่, ออฟไลน์ใช้แคชครั้งล่าสุด)
   - ไฟล์ที่ชื่อถูกแฮช (_astro/*) + รูป/ฟอนต์/css/js = cache-first (เร็ว + ออฟไลน์แน่)
   - ข้อมูล runtime อื่น (evidence.json ฯลฯ) = network-first ตกลงแคช
   - ตัดสิน "สำเร็จ" ที่ตอบ 2xx เท่านั้น — คำตอบอื่น (404/502 จาก proxy กลางฯ) ต้องตกลงแคช ไม่งั้นออฟไลน์พัง
   - install ตั้งล่วงหน้าเฉพาะไฟล์ชื่อคงที่ — เจอ 404 ที่รายการไหนก็ข้าม (ไม่ทำ install พังทั้ง sw)
   - bump VERSION เมื่อเปลี่ยนรายการเริ่มต้นใหญ่ ๆ (เก่าจะถูกลบเมื่อ activate) */
const VERSION = 'sovereign-offline-v4';
const PAGES_CACHE = VERSION + '-pages';
const RUNTIME_CACHE = VERSION + '-runtime';

const PRECACHE = [
  '/', '/index.html',
  '/projects.html', '/demo.html', '/shop.html', '/guardmini.html', '/farm.html',
  '/iot.html', '/education.html', '/me.html', '/books.html', '/water.html',
  '/search.html', '/en.html', '/livestock.html', '/fishery.html',
  '/pos.html', '/media.html', '/backup.html',
  '/nav.css', '/nav.js', '/favicon.svg', '/grid.svg',
  '/assets/books/222303.jpg', '/assets/books/236334.jpg', '/assets/books/236380.jpg',
  '/assets/books/365428.jpg', '/assets/books/370262.jpg', '/assets/books/374776.jpg',
  '/assets/books/375078.jpg', '/assets/books/401289.jpg',
  '/evidence/evidence.json'
];

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>ออฟไลน์ — Sovereign</title><body style="font-family:sans-serif;padding:3rem;line-height:1.8;background:#0b1220;color:#e5f2ee">' +
    '<h1 style="font-size:1.4rem">ยังไม่มีหน้านี้ในเครื่อง</h1>' +
    '<p>หน้านี้ยังไม่เคยเปิดบนอินเทอร์เน็ตเลย เปิดเมื่อมีเน็ตครั้งแรก หลังจากนั้นจะใช้งานออฟไลน์ได้ครบทุกหน้า</p>' +
    '</body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(PAGES_CACHE);
    await Promise.all(PRECACHE.map(async function (u) {
      try {
        const resp = await fetch(u, { cache: 'reload' });
        if (resp && (resp.ok || resp.type === 'opaque')) await cache.put(u, resp);
      } catch (e) { /* แคชได้เท่าไหร่ก็เริ่มได้เท่านั้น — ไม่รื้อ install ทั้งสวอน */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) !== 0; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

async function navHandler(req) {
  let fresh = null;
  try { fresh = await fetch(req); } catch (e) { fresh = null; }
  const cache = await caches.open(PAGES_CACHE);
  if (fresh && fresh.ok) {
    cache.put(req, fresh.clone()).catch(function () {});
    return fresh;
  }
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const url = new URL(req.url);
  if (url.pathname === '/' || url.pathname === '') {
    const idx = await cache.match('/index.html', { ignoreSearch: true });
    if (idx) return idx;
  }
  if (fresh && fresh.status !== 502) return fresh;   // 502 จาก gateway กลาง (ไม่ใช่เว็บจริง) = ถือว่าล้ม → หน้าออฟไลน์
  return offlinePage();
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, fresh.clone()).catch(function () {});
      return fresh;
    }
    return Response.error();
  } catch (err) { return Response.error(); }
}

async function dataHandler(req) {
  let fresh = null;
  try { fresh = await fetch(req); } catch (e) { fresh = null; }
  if (fresh && fresh.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, fresh.clone()).catch(function () {});
    return fresh;
  }
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  return fresh || Response.error();
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;                       // อื่น ๆ ผ่านไปตามเครือข่ายปกติ
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {              // โดเมนอื่น: เฉพาะฟอนต์ google ยันแคช
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(req.url)) event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(navHandler(req));
    return;
  }
  if (url.pathname.indexOf('/_astro/') !== -1 ||
      /\.(css|js|mjs|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(dataHandler(req));
});
