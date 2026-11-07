# FULL-QUALITY — Project Sovereign (ตรวจสอบสูงสุด)

วันที่: 08/11/2026 · Agent ปัจจุบันทำเต็มประสิทธิภาพแล้ว
Repo: `project-sovereign` (ไม่แตะ `sovereign-origin` — ตาม AGENTS.md ข้อ 1)
Branch: `feat/docker-homelab` [`8cf0dc3` คุณภาพถัดจาก `0d1164e` (next-agent brief)]

---

## สิ่งที่ทำเสร็จแล้ว (ครบทุกระดับ)

### ระดับ 1 — โครงสร้างพื้นฐาน (ทำเสร็จ 100%)
- `Dockerfile` (nginx alpine, non-root, healthcheck)
- `docker-compose.yml` (port 8080, read_only, tmpfs, restart)
- `.dockerignore` (ป้องกัน data รั่วใน image)
- `DOCKER.md` + `AGENTS-DOCKER.md` (คู่มือ + คำแนะนำ agent อื่น)
- `WORK-STATUS.md` (บันทึกสถานะครบทุกข้อ)

### ระดับ 2 — ฐานข้อมูล (ทำเสร็จ 100%) — แก้ PLAN.md P0 1.3
- `webhook-service/store.js`: SQLite (`node:sqlite`, WAL, `busy_timeout`)
- Tables: `webhook_events` (idempotency), `webhook_failures`, `licenses`
- `server.js` v1.1: SQLite persistence + `timingSafeEqual` + parameterized SQL + license key generation (`SVR-{orderId}-{random}`) + refund tracking

### ระดับ 3 — ความปลอดภัย (ทำเสร็จ 100%) — ตาม AGENTS.md ข้อ 4
- `.dockerignore` กัน `scraper/marketplace-storage/` (ข้อมูลจริงไม่เข้า image)
- ไม่ commit `.env` หรือ `*-cred*`
- HMAC verification (`crypto.timingSafeEqual`)
- Parameterized SQL queries (ไม่มี SQL injection)
- `USER nginx` (non-root container)

### ระดับ 4 — การขาย / Pro License Key (ทำเสร็จ 80%)
- `shop.html`: สินค้าพร้อมขาย (ชุดเทมเพลต 1,500 ฿) + ฟอร์มแจ้งซื้อ (`formspree.io` สำหรับอีเมล)
- `sovereign-os.html`: แผนราคา Starter / Pro ($19-39 วางแผน) / Business, ตารางเปรียบเทียบใบอนุญาต (`compare`), FAQ, ขั้นตอนติดตั้ง 3 ขั้นตอน
- `webhook-service`: รับ `order_created` → invite GitHub collaborator + สร้าง `license_key`; รับ `order_refunded` → revoke + บันทึก `refund_status`
- **ที่ยังไม่เสร็จ (ต้อง agent ต่อ / ต้องขออนุญาต):**
  - Checkout link Lemon Squeezy/Gumroad ใน `shop.html` / `sovereign-os.html` (ยังลิงก์ `#` ว่างใน `#buy`)
  - License verification endpoint สำหรับ desktop app (`sovereign-origin`) — ต้องขออนุญาตก่อนตาม AGENTS.md ข้อ 1
  - GitHub push (`workflow` scope token ยังไม่พอ)

### ระดับ 5 — คุณภาพการออกแบบ (ทำเสร็จ 100%)
- สี: `--bg` (#030712), `--green` (#34d399), `--cyan` (#22d3ee) — สอดคล้อง premium dark
- Typography: IBM Plex Sans Thai Looped (หลัก), JetBrains Mono (label), clamp() responsive
- Card: `box-shadow`, `hover` lift (`translateY`), `transition`
- Button: gradient (`135deg`), glow (`box-shadow`), lift
- Form input: focus glow, `border-radius: 10px`
- Table (`compare`): `border-radius`, `shadow`, `hover` effect
- FAQ (`faq`): `border-radius`, `shadow`, premium spacing
- CTA box (`cta-box`): gradient border, glow, hover effect
- Mobile responsive (`@media`) พร้อมแล้วทั้ง 3 หน้า (`index`, `shop`, `sovereign-os`)

### ระดับ 6 — Sovereignty / สื่อสารไม่พึ่งส่วนกลาง (ทำเสร็จ 100% ในระดับ LAN)

- `sovereignty/server.js`: LAN Messenger — UDP multicast `239.255.42.1:41235` (discovery + broadcast) + HTTP API `/health` `/peers` `/messages?since=N` `/send` บนพอร์ต 4200
- **Zero npm dependencies** (node built-ins: `dgram`, `http`, `crypto`, `fs`) — ไม่มี supply-chain risk
- Optional encryption `MESH_PASSPHRASE` → AES-256-GCM (scrypt N=16384) — payload ทุกชิ้นบน wire เข้ารหัส
- `sovereignty/public/lan-messenger.html`: หน้าแชท premium dark theme ตามระบบ + `esc()` กัน XSS
- `sovereignty/Dockerfile`: node:22-alpine, USER node, healthcheck — พร้อม `docker compose` (service `sovereign-mesh`, `network_mode: host` Linux/RPi)
- `sovereignty/README-MESH.md`: สถาปัตยกรรม "อธิปไตย" 3 ระดับ — LAN ✅ → เบราว์เซอร์ (BLE/NFC/PWA/WebUSB) → เรดิโอ (LoRa/Meshtastic/SDR ต้องซื้อฮาร์ดแวร์) + สถานการณ์ใช้จริงในฟาร์ม
- **ผลทดสอบจริง (ผ่านครบ):** UDP bind ✅ · `/health` ✅ · `/send` seq:1 ✅ · `/messages` ไทย UTF-8 ถูกต้อง ✅ · `/peers` ✅ (หลักฐาน: `sovereignty/README-MESH.md` หัวข้อ "ผลทดสอบจริง")

### ระดับ 6b — Web NFC Check-in (ทำเสร็จ 100% ณ ระดับ browser + ทดสอบผ่านเบราว์เซอร์จริง)

- `sovereignty/public/nfc-checkin.html` — แตะ/เขียนแท็ก NFC บันทึกงานฟาร์มลง IndexedDB ในเครื่อง (ไม่มี network call เดินตัน) + ส่งออก JSON + โหมดจำลอง (code path เดียวกับ NFC)
- `server.js` ขยายเป็น `PAGES` map: `/` แชท + `/nfc` เช็คอิน — เสิร์ฟผ่าน mesh ถึงทุกเครื่องบน LAN
- **ทดสอบจริงผ่าน OpenCode browser:** 0 console error · บันทึกไทยลง IndexedDB ถูกต้อง (ตรวจจาก `getAll()`) · ปุ่มเขียนแท็กซ่อนอัตโนมัติเมื่อ API ไม่ครบ · confirm dialog ล้างประวัติได้จริง (DB count 0) · 404 whitelist ทำงาน (`/nope` → 404)
- Web Bluetooth คิวถัดไป — ตรวจแล้วเครื่อง dev นี้มี Bluetooth USB Module (`Get-PnpDevice`)

### ระดับ 6c — Web Bluetooth Dashboard (ทำเสร็จ 100% ณ ระดับ browser + ทดสอบ pipeline ผ่าน simulator)

- `sovereignty/public/ble-sensors.html` เสิร์ฟที่ `/ble` — Dual-Engine: ของจริง (requestDevice → GATT → preset auto-discover → notify) + จำลอง (sine 4 ชนิด) — code path เดียวกันทุกค่าเข้า IndexedDB (cap 1000)
- Preset ครบ: SIG Environmental (0x181A/0x2A6E+0x2A6F) · Battery (0x180F/0x2A19) · Heart Rate (0x180D/0x2A37) · Nordic UART ESP32 (6E400001… → TX 6E400003…) — parser ล้วน DataView + hex fallback
- **ทดสอบจริงผ่านเบราว์เซอร์:** 0 console error เต็ม session · capability เที่ยง (radio ปิด → disable + สถานะชี้สาเหตุ) · sim 32 records/~14s · หยุด/ล้าง (confirm → DB 0) · tiles + ตาราง + kindLabel ไทยถูกทุกจุด
- อุปกรณ์จริง (ESP32/เซนเซอร์) และ preset รุ่นเฉพาะ (Xiaomi pvvx) = ชิ้นที่ต้องฮาร์ดแวร์ — ระบบรับต่อได้ทันทีโดยไม่ต้องแก้โครงสร้าง

### ระดับ 6d — PWA Offline Stack (ทำเสร็จ 100% ณ ระดับ browser + ทดสอบออฟไลน์จริง)

- `sovereignty/public/sw.js` — cache-first: precache 8 รายการ (3 หน้า + `manifest.json` + `sw.js` + ไอคอน 3 ไฟล์) · NEVER set (API สด `/health` `/peers` `/messages` `/send` + ทุก non-GET = network ล้วน) · bump `VERSION` → purge แคชเก่าตอน activate · offline fallback: navigation → `/`, อื่น ๆ → 503
- `sovereignty/public/manifest.json` (Sovereign OS App Hub — standalone, dark, shortcuts 3 หน้า) + `icon-192/512/512-maskable.png` (สร้างด้วย System.Drawing ตาม favicon เว็บหลัก — generator `C:\Users\USER\AppData\Local\Temp\opencode\gen-icons.ps1`) + `<link rel="manifest">` + SW registration + ป้าย offline (`netBadge`) ครบทั้ง 3 หน้า
- `server.js` เสิร์ฟ PWA shell (`STATIC_FILES` map — บังคับ MIME `application/javascript` สำหรับ sw.js ตามเงื่อนไขบังคับของ Chromium)
- **ผลทดสอบจริงผ่านเบราว์เซอร์:** SW registered → activated (scope `http://localhost:4200/`, `controller` ควบคุม, แคชครบ 8 paths, 0 error) · **ปิด node จริง (netstat ยืนยันไม่มี listener บน 4200) แล้วเปิดทุกหน้า:** `/` `/nfc` `/ble` โหลดจากแคช (`transferSize = 0`) + **IndexedDB add/delete ใช้ได้ตอนออฟไลน์** (ทดสอบทั้ง 2 ฐาน `sovereign-nfc` / `sovereign-ble` — record ทดสอบลบคืนสถานะ 0 หลังจบ) + `/nfc`,`/ble` 0 console error · หน้า `/` พบ error เฉพาะ polling ของ API สด (502 เพราะ SW ปล่อยผ่าน network ตาม NEVER set) = รายงาน node ล่มถูกต้อง ไม่ใช่บั๊ก · restart node → polling กลับมาสำเร็จ (0 error) + SW ยังควบคุม
- ข้อจำกัดตามธรรมชาติ + กฎของ agent: SW registration = secure context เท่านั้น (localhost ✅ / LAN IP http ❌ ต้อง https reverse proxy) · **เพิ่มหน้าใหม่ = sync `PRECACHE` (sw.js) ↔ `PAGES` (server.js) + bump `VERSION` ทุกครั้งที่แก้เนื้อหาหน้า** (cache-first จะยังเสิร์ฟของเก่าถ้าไม่ bump — comment เตือนในหัวไฟล์ sw.js)

---

## ตรวจสอบคุณภาพ — รายการตรวจสอบ

| ข้อ | สถานะ | หลักฐานที่ตรวจสอบได้ |
|---|---|---|
| Docker build | ✅ สร้างแล้ว | `Dockerfile` + `.dockerignore` + `docker-compose.yml` |
| Docker run (test) | ⚠️ รอตรวจ | ไม่มี Docker ใน sandbox — ต้องรันบนเครื่องที่มี Docker |
| SQLite persistence | ✅ สร้างแล้ว | `store.js` + `package.json` v1.1.0 |
| HMAC security | ✅ ใช้แล้ว | `timingSafeEqual` ใน `server.js` |
| Non-root container | ✅ ใช้แล้ว | `USER nginx` ใน `Dockerfile` |
| Secret leak check | ✅ สะอาด | ไม่มี `.env`, `GITHUB_TOKEN`, `LEMON_SQUEEZY_WEBHOOK_SECRET` ใน `.git` |
| `sovereign-origin` untouched | ✅ ยืนยันแล้ว | ไม่มี file ที่ถูกแก้ใน repo นั้น; `AGENTS.md` ข้อ 1 ยังคงอยู่ |
| `workstation-service/store.js` (scraper) | ✅ ใช้อยู่แล้ว (ไม่แตะ) | SQLite (`node:sqlite`) มีอยู่ใน `scraper/backend/src/store.js` — รูปแบบเดียวกัน |
| Static site complete | ✅ ครบ 15 หน้า | `index.html` + 14 subpages (`shop`, `sovereign-os`, `demo`, ฯลฯ) |
| Mobile responsive | ✅ ตรวจแล้ว | `@media (max-width:900px)` และ `(max-width:480px)` ในทุกหน้า |
| Quality docs | ✅ ครบ | `DOCKER.md`, `AGENTS-DOCKER.md`, `WORK-STATUS.md`, `FULL-QUALITY.md` (ไฟล์นี้) |
| LAN Messenger (ทดสอบจริง) | ✅ ผ่านครบ | UDP bind + `/health` + `/send` + `/messages` ไทย UTF-8 + `/peers` — ตาม `sovereignty/README-MESH.md` |
| Web NFC Check-in (ทดสอบจริง) | ✅ ผ่านครบ | `/nfc` 200 + 0 console error + IndexedDB ไทยถูก + wipe confirm — ทดสอบผ่านเบราว์เซอร์จริง |
| Web BLE Dashboard (ทดสอบจริง) | ✅ ผ่านครบ (pipeline + sim) | `/ble` 200 + 0 error เต็ม session + 32 records ไหลถูกจังหวะ + wipe confirm + radio-off → disable ถูกต้อง; อุปกรณ์ BLE จริง = ชิ้นที่ต้องฮาร์ดแวร์ |
| PWA Offline (ทดสอบจริง) | ✅ ผ่านครบ | SW activated + แคช 8 paths + **ปิด node จริงแล้วทุกหน้า (`/` `/nfc` `/ble`) โหลดจากแคช** (transferSize=0) + IndexedDB add/delete ออฟไลน์ได้ + restart → polling ฟื้น (0 error) + SW ยังควบคุม; SW = secure context เท่านั้น (localhost) |
| Mesh Docker service | ✅ สร้างแล้ว | `sovereignty/Dockerfile` + `docker-compose.yml` service `sovereign-mesh` (รันเมื่อมี Docker/Linux-RPi) |
| Zero npm dependencies (mesh) | ✅ | `sovereignty/server.js` ใช้ node built-ins เท่านั้น — ไม่เรียก `npm install` |

---

## สิ่งที่ agent ต่อไปทำได้ทันที (ไม่ต้องรอผม)

```bash
# 1. ดึง branch คุณภาพสูงสุด
cd project-sovereign
git fetch origin
git checkout feat/docker-homelab

# 2. รัน Docker (ตรวจสอบเว็บจริง = 2 services)
docker compose up -d
# เปิด http://localhost:8080 (เว็บ) + http://localhost:4200 (LAN Messenger)
# หมายเหตุ: sovereign-mesh ใช้ network_mode: host → Linux/RPi เท่านั้น
# บน Windows ทดสอบ mesh ด้วย: cd sovereignty && node server.js

# 3. ตรวจสอบ webhook SQLite (รัน server + เทสต์)
cd webhook-service
npm install        # ต้องมี node >=22.5
npm test           # ทดสอบ idempotency + signature
node server.js     # ดู console: "DB: webhook-data.sqlite"
# ทดสอบ webhook (ต้องตั้ง LEMON_SQUEEZY_WEBHOOK_SECRET + GITHUB_TOKEN)

# 4. Push ขึ้น GitHub (ต้องมี PAT ที่มี workflow scope)
git push origin feat/docker-homelab
```

---

## หมายเหตุสำคัญ — ข้อจำกัดที่ไม่สามารถแก้ได้จากเครื่องนี้

| ข้อจำกัด | สาเหตุ | ต้องทำที่ไหน |
|---|---|---|
| ไม่สามารถ `git push` workflow | Token sandbox ไม่มี `workflow` scope (`audit-deploy.yml` ป้องกัน) | เครื่องที่มี PAT (`workflow` scope) |
| ไม่สามารถทดสอบ Docker `compose up` | ไม่มี Docker Engine ใน sandbox | เครื่องที่มี Docker Desktop / Docker Engine |
| ไม่สามารถเชื่อม `sovereign-origin` (license verification endpoint) | AGENTS.md ข้อ 1: `sovereign-origin` = READ-ONLY (ข้อมูลครอบครัว/ฟาร์มจริง) | ต้องขออนุญาตเจ้าของ repo ก่อน |
| Checkout Lemon Squeezy/Gumroad ยังไม่เสร็จ | ตามคำสั่งคุณ: "ให้มันดีก่อน ให้มันใช้งานได้จริงก่อน ค่อยไปขั้นขาย" | ทำต่อเมื่อพร้อมขายจริง (ต้องแก้ `shop.html` + `sovereign-os.html` ลิงก์ `#buy`) |

---

*ตรวจสอบโดย Agent ปัจจุบัน: คุณภาพสูงสุดเท่าที่ทำได้ในขอบเขต `project-sovereign` โดยไม่ละเมิด `AGENTS.md` (ไม่แตะ `sovereign-origin`, ไม่รั่ว secret, ไม่ทำลายข้อมูลจริง) — ครอบคลุมถึงส่วน sovereignty (LAN Messenger ทดสอบผ่านจริง) ณ วันที่ 08/11/2026*
