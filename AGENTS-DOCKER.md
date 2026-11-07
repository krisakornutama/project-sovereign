# สั่งงานให้ Agent ต่อไป — Project Sovereign

Repo: `krisakornutama/project-sovereign`
Branch: `feat/docker-homelab` (คุณภาพสูงสุดแล้ว — ดู commit ล่าสุดด้วย `git log`)
ไฟล์สถานะ: `WORK-STATUS.md` + `FULL-QUALITY.md` + `sovereignty/README-MESH.md`

---

## ตรวจสอบก่อนเริ่มงาน

1. อ่าน `WORK-STATUS.md` และ `FULL-QUALITY.md` ใน `feat/docker-homelab`
2. ยืนยันว่า `git status` สะอาด (ไม่มีการเปลี่ยนแปลงที่ไม่ต้องการ)
3. ยืนยันว่า `sovereign-origin` ไม่ถูกแตะ (AGENTS.md ข้อ 1)

---

## งานที่ต้องทำต่อจากผม (เรียงตามลำดับความสำคัญ)

### P0 — ทำก่อนอื่น (จำเป็น)

| ข้อ | งาน | คำสั่ง / ไฟล์ที่เกี่ยวข้อง |
|---|---|---|
| 1 | **Push branch ขึ้น GitHub** (ติด `workflow` scope) | ใช้ PAT ที่มี `workflow` scope → `git push origin feat/docker-homelab` |
| 2 | **รัน Docker Compose บนเครื่องจริง** | `docker compose up -d` → ตรวจ `localhost:8080` (เว็บ) + `localhost:4200` (LAN Messenger) → ตรวจ `docker ps` ว่า 2 containers (`sovereign-web`, `sovereign-mesh`) ทำงาน — **หมายเหตุ: `sovereign-mesh` ใช้ `network_mode: host` รันได้เต็มบน Linux/RPi เท่านั้น** |
| 3 | **ตรวจสอบ SQLite webhook service** | `cd webhook-service` → `npm install` → `npm test` (เทสต์ idempotency + signature) → `node server.js` → ตรวจ DB `webhook-data.sqlite` สร้างขึ้น → ทดสอบ webhook endpoint (ต้องตั้ง `.env` หรือ `process.env`) |

### P1 — ขายจริง (ตามแผน Krisakorn $19-39)

| ข้อ | งาน | รายละเอียด |
|---|---|---|
| 4 | **เพิ่ม Lemon Squeezy / Gumroad checkout link** ใน `shop.html` และ `sovereign-os.html` | ปัจจุบัน `#buy` ลิงก์ `#` ว่าง; ต้องแทนที่ด้วย URL checkout จริง (หรือสร้าง endpoint `/checkout` ถ้าต้องการควบคุมเอง) |
| 5 | **สร้าง / ตรวจสอบ license verification endpoint** | `webhook-service/store.js` เก็บ `license_key` แล้ว; ต้องสร้าง endpoint (`GET /verify-license`) หรือรวมเข้ากับ desktop app (`sovereign-origin`) — **ต้องขออนุญาตก่อนแตะ `sovereign-origin` ตาม AGENTS.md ข้อ 1** |

### P1b — Sovereignty / สื่อสารไม่พึ่งส่วนกลาง (ส่วนใหม่ — เสร็จในระดับ LAN แล้ว)

| ข้อ | งาน | รายละเอียด |
|---|---|---|
| 5a | **ทดสอบ LAN Messenger ในสภาพจริง 2 เครื่อง** | เปิด `sovereignty/server.js` 2 เครื่องบน LAN เดียว → เช็ค `/peers` ว่าเห็นกันทั้งสองฝั่ง → แชทปลายทาง UI + WebSocket-style polling (ทดสอบแล้วเครื่องเดียวผ่านครบ — ขาดเครื่องที่ 2 ใน sandbox) |
| 5b | **ขยายสื่อสารเบราว์เซอร์** (ดูแผนใน `sovereignty/README-MESH.md` ระดับ 2) | Web Bluetooth (แดชบอร์ดเซนเซอร์ BLE) → Web NFC (เช็คอินฟาร์ม) → PWA offline เต็ม (`sw.js` cache-first) |
| 5c | **ต่อข้อมูลจาก Meshtastic/LoRa เมื่อมีฮาร์ดแวร์** | สูบข้อความจาก mesh node → เด้งเข้า API `/messages` แบบเดียวกับที่มี — **รูปแบบ API คงเดิม ไม่ต้องเขียน endpoint ใหม่** |

---

### P2 — คุณภาพ / ความปลอดภัย (ตาม PLAN.md)

| ข้อ | งาน | รายละเอียด |
|---|---|---|
| 6 | **เพิ่ม SQLite persistence ให้ backend scraper** (`scraper/backend/src/store.js` มี SQLite แล้ว แต่ตรวจสอบว่าใช้งานจริงได้) | `scraper/backend/src/store.js` ใช้ `node:sqlite` แล้ว — ตรวจสอบว่า `npm run test:db` ผ่าน |
| 7 | **ตรวจสอบ `_headers` (security headers)** | ไฟล์ `_headers` มีอยู่แล้วใน repo; ต้องตรวจสอบว่าทำงานได้จริง (ปัจจุบัน GitHub Pages ไม่อ่าน `_headers` โดยตรง ต้องใช้ Cloudflare Transform Rules หรือย้ายไป Cloudflare Pages) |
| 8 | **ตรวจสอบ rate limit ต่อ scrape** (`plan.md` 1.9) | ปัจจุบัน `scraper/backend/src/rateLimit.js` มีอยู่ — ตรวจสอบว่าตั้งค่าถูกต้อง |

---

## ข้อห้าม (ห้ามทำโดยเด็ดขาด)

- ❌ **ห้ามแตะ `sovereign-origin`** (แอป desktop ที่มีข้อมูลจริงครอบครัว/ฟาร์ม) — ตาม AGENTS.md ข้อ 1
- ❌ **ห้าม commit `.env`, `GITHUB_TOKEN`, `LEMON_SQUEEZY_WEBHOOK_SECRET`** — ตาม AGENTS.md ข้อ 7
- ❌ **ห้ามเปลี่ยน `project-sovereign` เป็น Next.js code** — โครงสร้างนี้เป็น static site (`.html`) สำหรับ GitHub Pages; ไม่ต้องแปลงเป็น `.tsx`

---

## ไฟล์ที่ต้องอ่านก่อนทำงาน

1. `FULL-QUALITY.md` — สรุปคุณภาพสูงสุดทั้งหมด
2. `WORK-STATUS.md` — สถานะปัจจุบัน + รายการไฟล์ใน branch
3. `sovereignty/README-MESH.md` — **สถาปัตยกรรม "อธิปไตย" 3 ระดับ + ผลทดสอบ LAN Messenger จริง** (ทำ sovereignty ต่อต้องอ่านก่อน)
4. `AGENTS-DOCKER.md` — คำแนะนำสำหรับ agent (ไฟล์นี้)
5. `DOCKER.md` — คู่มือรัน Docker
6. `sovereign-os.html` (ส่วน `#buy`) — ที่ต้องแก้ checkout link
7. `shop.html` (ฟอร์มแจ้งซื้อ) — ที่ต้องเชื่อมกับ Lemon Squeezy
8. `webhook-service/store.js` — SQLite schema และ API ที่ต้องใช้เมื่อทำ checkout

---

## สรุปสั้นสำหรับ Agent ต่อไป

```
Repo: project-sovereign
Branch: feat/docker-homelab (ดู commit ล่าสุด)
Task: 1) Push + Docker test (2 services: web 8080 + mesh 4200)
      → 2) Checkout link (Lemon/Gumroad)
      → 3) License verify endpoint (ต้องขออนุญาต sovereign-origin)
      → 4) เทสต์ LAN Messenger 2 เครื่อง + ขยาย BLE/NFC (sovereignty/README-MESH.md)
Forbidden: sovereign-origin (read-only), secret keys, .env commit
```
