# Sovereign Mesh — เลเยอร์สื่อสาร "อธิปไตย" ของ Project Sovereign

> เป้าหมาย: สื่อสารระหว่างคน/เครื่องในบ้านและฟาร์ม **โดยไม่พึ่งพาอินเทอร์เน็ต ไม่มีเซิร์ฟเวอร์กลาง**
> หลักการเดียวกับเว็บทั้งไฟล์: ทุกอย่างอยู่บนเครื่องเราเอง — ถ้าส่วนกลางล่ม เรายังทำงาน

---

## ✅ ระดับ 1 — LAN Messenger (ทำเสร็จแล้ว + ทดสอบผ่านจริง)

แชทระหว่างเครื่องใน LAN เดียวกัน — เราเตอร์/ฮอตสปอตธรรมดาพอ ไม่ต้องมีอินเทอร์เน็ต
เหมาะกับ: ครอบครัว, ทีมงานฟาร์ม, กลุ่มอาชีพในหมู่บ้านที่อินเทอร์เน็ตล่ม/ถูกตัด

### สถาปัตยกรรม

```
┌─────────────┐   UDP multicast 239.255.42.1:41235   ┌─────────────┐
│  เครื่อง A   │ ◄────── ประกาศตัว/กระจายข้อความ ─────► │  เครื่อง B   │
│ (HTTP 4200) │      (ไม่ผ่านอินเทอร์เน็ตเลย)            │ (HTTP 4200) │
└─────────────┘                                      └─────────────┘
       ▲                                                    ▲
       └────────────  เราเตอร์บ้าน/ฮอตสปอต  ─────────────────┘
                  (แค่เครือข่าย LAN — ไม่ต้องต่อ WAN)

- Discovery: แต่ละเครื่องประกาศตัว (`announce`) ทุก 10 วินาที + ตอบกลับเมื่อเจอเพื่อนใหม่
- ส่งข้อความ: กระจายทั้งกลุ่ม (`message`) ทุกเครื่องเก็บประวัติในเครื่องตัวเอง (local-first)
- ออกจากกลุ่ม: แจ้ง `leave` ตอนปิดเครื่องเพื่อให้รายชื่อเพื่อนสะอาด
- เข้ารหัส (optional): ตั้ง `MESH_PASSPHRASE` → payload ทั้งหมดเข้ารหัส AES-256-GCM (กุญแจมาจาก scrypt)
```

### ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | UDP multicast + HTTP API + เสิร์ฟหน้าแชท — **zero npm dependencies** (built-in เท่านั้น) · `PAGES` map เสิร์ฟ `/` (แชท) + `/nfc` (เช็คอิน) + `/ble` (แดชบอร์ด BLE) |
| `public/lan-messenger.html` | หน้าแชท dark theme ตามระบบ (IBM Plex Sans Thai Looped + JetBrains Mono) |
| `public/nfc-checkin.html` | หน้าเช็คอินฟาร์มด้วยแท็ก NFC — IndexedDB local-first, export JSON, โหมดจำลอง |
| `public/ble-sensors.html` | แดชบอร์ดเซนเซอร์ BLE (SIG preset + Nordic UART) — dual-engine จริง/จำลอง, DataView parser, IndexedDB |
| `package.json` | `npm start` — ต้อง Node >= 20 |
| `Dockerfile` | node:22-alpine, USER node (non-root), healthcheck ยิง `/health` |

### รัน

```bash
cd sovereignty
node server.js
# เปิด http://localhost:4200  (UI แชท)

# ตั้งชื่อเครื่อง + เข้ารหัส (เครื่องทุกตัวในกลุ่มต้องใช้ passphrase เดียวกัน)
MESH_PEER_NAME="แม่บ้าน" MESH_PASSPHRASE="ฟ้า-สวรรค์" node server.js
```

### API (สำหรับเครื่องอื่น/สคริปต์)

| Endpoint | คำอธิบาย |
|---|---|
| `GET /health` | สถานะ + จำนวนเพื่อน + จำนวนข้อความ + เปิดเข้ารหัสหรือไม่ |
| `GET /peers` | รายชื่อเครื่องบน LAN (อายุไม่เกิน 30s) |
| `GET /messages?since=N` | ข้อความใหม่ตั้งแต่ seq N (cursor) |
| `POST /send` | ส่งข้อความทั้งกลุ่ม — `{"text":"..."}` (สูงสุด 2000 ตัวอักษร, body จำกัด 8KB) |

### ผลทดสอบจริง (เครื่อง Windows, ผ่านแล้วทุกข้อ)

| ทดสอบ | ผล |
|---|---|
| UDP multicast bind `239.255.42.1:41235` | ✅ สำเร็จ (peer id `74fb71341ac54a61`, name `DESKTOP-763T34T`) |
| `GET /health` | ✅ `{"status":"ok", ...}` |
| `POST /send` | ✅ `{"ok":true,"seq":1}` |
| `GET /messages` — ข้อความไทย UTF-8 | ✅ เก็บและส่งกลับถูกต้อง ("ทดสอบส่งภาษาไทยผ่าน HTTP ด้วย encoding UTF8 จริง") |
| `GET /peers` | ✅ ทำงาน (ยังไม่มีเครื่องที่ 2 ใน sandbox) |
| ปิด server | ✅ (exit code 1 จาก `Stop-Process -Force` — คาดการณ์ไว้ ไม่ใช่ bug) |

> **หมายเหตุ Windows:** ทดสอบผ่าน PowerShell ต้อง `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`
> แล้วส่ง body เป็น UTF-8 bytes (`[System.Text.Encoding]::UTF8.GetBytes(...)`) —
> เครื่องหมาย `???` ใน terminal เป็นข้อจำกัดการแสดงผล PowerShell เท่านั้น ไม่ใช่ปัญหาของ server
> (ผู้ใช้จริงผ่านเบราว์เซอร์เห็นไทยถูกต้องเสมอ เพราะ HTML/HTTP ใช้ UTF-8)

### Docker

บรรจุอยู่ใน `docker-compose.yml` (ราก repo) เป็น service `sovereign-mesh`:

```bash
docker compose up -d
#  เว็บ   → http://localhost:8080
#  แชท   → http://localhost:4200
```

`network_mode: host` (Linux/Raspberry Pi เท่านั้น) เพื่อให้ multicast เห็นอุปกรณ์จริงทั้ง LAN —
ตั้งค่าผ่าน env: `MESH_PEER_NAME`, `MESH_PASSPHRASE`, `MESH_MULTI_ADDR`, `MESH_MULTI_PORT`

---

## ✅ ระดับ 2 — ทำสำเร็จในเบราว์เซอร์ (เริ่มแล้ว — NFC เสร็จ, Next: Bluetooth)

หลักการ: หน้าเว็บสถิตของเรา (GitHub Pages / เสิร์ฟจาก mesh node) สื่อสารเครื่อง-ต่อ-เครื่องโดยตรงผ่าน API มาตรฐานของเบราว์เซอร์

| เทคโนโลยี | สถานะ | ไฟล์ / รายละเอียด |
|---|---|---|
| **Web NFC (เช็คอินฟาร์ม)** | ✅ **ทำแล้ว (ใช้เว็บจริง + ทดสอบ pipe ครบ)** | `public/nfc-checkin.html` เสิร์ฟที่ `/nfc` — แตะแท็กบันทึกใคร/ทำอะไร/เมื่อไร ลง **IndexedDB ในเครื่อง** (ไม่มี network call หนึ่งคำ) · เขียนลงแท็ก (อ่าน/เขียน NDEF text) · ส่งออก JSON · ล้างประวัติ + โหมดจำลองเทียบระดับ code path เดียวกันทั้งระบบ — **ผลทดสอบจริงครบ: โหลด 0 console error, บันทึกภาษาไทยลง IndexedDB ถูกต้อง, ปุ่มเขียนแท็กซ่อนอัตโนมัติเมื่อมี NFC ไม่ได้ทันใช้, confirm dialog ทำงานถูก** — ส่วน "แตะแท็กจริง" ต้องมี: Chrome บน Android + แท็ก NFC + เปิดผ่าน https/localhost (Web NFC ต้องการ secure context) |
| **Web Bluetooth (BLE เซนเซอร์)** | ✅ **ทำแล้ว (ใช้เว็บจริง + ทดสอบ pipeline ครบ ผ่าน simulator)** | `public/ble-sensors.html` เสิร์ฟที่ `/ble` — Dual-Engine: **ของจริง** = `requestDevice` → GATT → auto-ค้นหา preset → notify/read (SIG 0x181A/0x2A6E+0x2A6F, 0x180F/0x2A19, 0x180D/0x2A37, Nordic NUS 6E400001… TX 6E400003…) · **จำลอง** = sine (temp 25–35 °C / humidity 40–80 % / battery 80–100 % / bpm 60–90) ทุกค่าเข้า IndexedDB (**code path เดียวกันทั้งระบบ** — cap 1000 แถวลบเก่าอัตโนมัติ, bin hex preview, export JSON, wipe + confirm) · **ผลทดสอบจริง (OpenCode browser):** 0 console error เต็ม session · capability detection เที่ยง (Chrome เห็น API แต่ Windows radio ปิด → ปุ่มเชื่อมของจริงถูก disable ถูกต้อง) · sim 32 records/~14s (4 ต่อ 2s tick) · หยุด/ล้าง/kindLabel ไทยถูกต้องทุกจุด · หมายเหตุเครื่อง dev: module BT มีแต่ radio ปิด — เปิดใน Windows แล้วกดเชื่อมได้ทันที เหลือเพียงคู่แข่งอุปกรณ์จริง (ESP32/เซนเซอร์) + preset รุ่นเฉพาะ (Xiaomi pvvx/custom) ตอนบอกรุ่น |
| **PWA Offline + Service Worker** | ⏳ คิวถัดไป | บนตัวหน้าร้านหลักอยู่แล้ว (`sw.js` + `manifest.webmanifest`) — ปรับ cache-first ครบถวั้นแพ็ knowledge page |

เส้นทางถัดไป (แนะนำตามลำดับ): 1) **PWA offline เต็ม** (`sw.js` cache-first) 2) preset เพิ่มเมื่อมีอุปกรณ์จริง (Xiaomi LYWSD03MMC ฟอร์มแวร์ pvvx / เซนเซอร์ DI อื่น)

เพิ่มหน้าเครื่องมือใหม่ที่ `/` ได้ทันที: แก้ `PAGES` map ใน `server.js` (route → ไฟล์ใน `public/`) — ปัจจุบันมี `/` (แชท), `/nfc` (เช็คอิน), `/ble` (แดชบอร์ด BLE) — สุดก็เสิร์ฟทุกเครื่องบน LAN โดยไม่ต้องแก้อะไรให้ต่อ

---

## 📡 ระดับ 3 — สื่อสารนอกครัวเรือน (ต้องมีฮาร์ดแวร์ — ซื้อค่อยทำ)

พ้นขอบเขต LAN (~100m) แล้ว ต้องมีวิทยุ:

| ฮาร์ดแวร์ | ต้นทุนโดยประมาณ | ระยะ | เหมาะกับ |
|---|---|---|---|
| **LoRa RFM95W + Raspberry Pi/ESP32** | ~500–1,200 ฿/โหนด | 2–10 km (จุดสูง) | ส่งข้อมูลเซนเซอร์ฟาร์มนอกบ้าน (ปริมาณน้อย ทุกวินาที) — เชื่อมกันเองเป็น Meshtastic mesh |
| **Meshtastic (สำเร็จรูป LILYGO/RAK)** | ~1,500–2,500 ฿/ตัว | 2–10 km | แชทข้อความ + GPS แชแรของทีมทำงานไร่/ป่า ไม่ต้องมีเน็ต |
| **RTL-SDR + สายอากาศ** | ~1,000–2,000 ฿ | ฟังเท่านั้น | ฟังวิทยุภาคบ้าน/เกษตรกรรม/ภาวะฉุกเฉิน (อ่านอย่างเดียว) |
| **GMRS/UHF วอล์กี้ทอล์ค + gateway** | ~2,000–4,000 ฿ | 5–15 km | เสียงสื่อสารภาคสนามจริง (ต้องถือใบอนุญาตตามกฎหมาย — ตรวจสอบ NBTC ก่อน) |

สถาปัตยกรรมที่ต่อได้เลยเมื่อมี LoRa: โหนดฝน/ดิน/คอก (เซนเซอร์) → LoRa → เกตเวย์ RPi → endpoints เดียวกันกับ LAN Messenger นี้ (HTTP `/messages`) → แดชบอร์ด Sovereign เดิม — **รูปแบบ API คงเดิม** ประหยัดงานเขียนใหม่ทั้งชุด

---

## 🏡 สถานการณ์ใช้จริงในฟาร์ม (ไม่พึ่งพาส่วนกลาง)

| สถานการณ์ | ใช้อะไรจากไฟล์นี้ |
|---|---|
| เน็ตล่มโดนพายุ/ถูกตัดค่าเช่าเซิร์ฟเวอร์ | LAN Messenger ยังแชทได้เพราะวิ่งบนเราเตอร์บ้าน |
| สั่งงานคนงานในสวนแยะบาง/ปศุสัตว์ | เครื่องคนงานต่อ Wi-Fi บ้านเดียวกัน → เห็นรายชื่อกัน + แชททีมได้ทันที |
| ข้อมูลละเอียดอ่อน (รายได้/แต่งกลุ่ม/เหตุฉุกเฉิน) | `MESH_PASSPHRASE` เข้ารหัสทุก payload ออกอากาศ — จับ payload ก็อ่านไม่ได้ |
| เครื่องมือหมดกระแส ไฟดับ | รันบน Pi + power bank ได้ (Docker service `sovereign-mesh` restart อัตโนมัติ) |
| ต่อยอดเซนเซอร์/ประตู/ปั๊มน้ำ | API `/send` `/messages` ใช้จากมือถือ/ESP32 ได้ — ไม่ต้องเรียกส่วนกลางเลย |

---

## 🔒 ความปลอดภัย (ตามแบบของระบบ)

- `timingSafeEqual` ไม่เกี่ยว (ไม่มีรหัสตรวจเทียบ); เน้น **ไม่เก็บ secret อะไรใน code** — passphrase มาจาก env เท่านั้น
- เข้ารหัส payload แบบ optional โดย AES-256-GCM + scrypt (N=16384) — key เส้นทางอากาศไม่เป็น plaintext
- Dedupe ด้วย `(from, seq)` — ไม่มี replay ซ้ำในประวัติ
- บอดี้จำกัด 8KB + ข้อความ 2000 อักษร (ป้องกัน overflow)
- หน้าแชทแสดงข้อความด้วย `esc()` — ป้องกัน XSS จากข้อความอื่น
- HTTP เสิร์ฟ local เท่านั้นตาม docker บน localhost; ถ้าเปิด LAN กว้าง แนะนำป้องกันด้วย proxy/WAF ตามเว็บเดิม
- ไม่แตะ `sovereign-origin` — ตาม AGENTS.md ข้อ 1 (โฟลเดอร์นี้ทำงานใน `project-sovereign` เท่านั้น)

---

*สร้างโดย Agent (ผลทดสอบจริงบันทึกไว้ในเอกสารนี้) · ส่วนหนึ่งของ Project Sovereign — ระบบที่อยู่กับเจ้าของ ไม่เช่าจากใคร*
