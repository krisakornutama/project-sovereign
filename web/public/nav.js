/* nav.js — ปุ่ม ☰ เปิด/ปิด drawer หมวดหน้าเว็บฝั่งซ้ายบนจอเล็ก (ไม่มี dependency)
   ปิดด้วย: กดปุ่มซ้ำ · Esc · แตะนอก drawer (scrim) · เลือกลิงก์
   บนมือถือ ตอน drawer ปิด rail ถูกซ่อนจากโปรแกรมอ่านหน้าจอด้วย (aria-hidden)
   top: ลงทะเบียน service worker (โหมดออฟไลน์) + แนะไฟล์ manifest ให้ทุกหน้าโดยแก้ที่เดียว */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }
  try { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {}); } catch (e) {}
})();

(function () {
  'use strict';
  var toggle = document.querySelector('.rail-toggle');
  var rail = document.getElementById('siteRail');
  if (!toggle || !rail) return;

  var mobileMq = window.matchMedia('(max-width: 900px)');

  function setOpen(open) {
    document.body.classList.toggle('rail-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (mobileMq.matches) {
      if (!open && rail.contains(document.activeElement)) document.activeElement.blur();
      rail.setAttribute('aria-hidden', String(!open));
    }
  }

  var scrim = document.createElement('div');
  scrim.className = 'rail-scrim';
  scrim.addEventListener('click', function () { setOpen(false); });
  document.body.appendChild(scrim);

  toggle.setAttribute('aria-controls', 'siteRail');
  setOpen(false);

  toggle.addEventListener('click', function () {
    setOpen(!document.body.classList.contains('rail-open'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('rail-open')) setOpen(false);
  });
  rail.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });
})();
