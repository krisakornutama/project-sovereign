# Sovereign Scraper — micro-SaaS

แดชบอร์ดดึงข้อมูลเว็บ (metadata) แบบจ่ายตามใช้ เงินบาทผ่าน Stripe
อยู่ในรีโปเดียวกับเว็บ `project-sovereign` แต่**เป็นคนละแอป** — deploy แยกกัน

| โฟลเดอร์ | อะไร | ปล่อยที่ไหน |
|---|---|---|
`frontend/` | Vite + React (แดชบอร์ด) | `harvest-ledger.pages.dev` |
`backend/` | Express API + Stripe | `api.sovereignoriginshop.dpdns.org` |
`scripts/` | ตรวจ host ว่ายังไม่ขึ้นหน้าว่าง | `npm run check:hosts` |

## ⚠️ โค้ดส่วนนี้ไม่ได้ถูก deploy ไปกับเว็บ

`project-sovereign` ปล่อยด้วย GitHub Pages ที่ root ของรีโป
workflow จึง **กรองเฉพาะไฟล์เว็บ** (`*.html`, `nav.*`, `assets/`) ไม่เอาโฟลเดอร์นี้ไปด้วย
มีการตรวจใน CI ว่าไม่มี `.js` อื่นหลุดไปและไม่มีโฟลเดอร์ `scraper/` ในไซต์ — ถ้าหลุด workflow จะ fail

## รันบนเครื่อง

```bash
npm run install:all          # ติดตั้งทั้ง backend + frontend
npm run dev:backend          # :4000
npm run dev:frontend         # :5173
```

## ตรวจก่อน commit

```bash
npm run verify               # เทสต์ backend (63) + build frontend — ต้องผ่านทั้งหมด
```

> `allowPrivateTargets: true` ในเทสต์เป็นของเฉพาะเทสต์เท่านั้น (fixture อยู่บน 127.0.0.1 ซึ่ง SSRF guard บล็อกตามจริง)
> แอปที่ deploy ไม่เปิด flag นี้เด็ดขาด

## ความปลอดภัย — อ่านก่อนแตะส่วน auth หรือการดึงข้อมูล

| ไฟล์ | หน้าที่ |
|---|---|
`backend/src/ssrfGuard.js` | ทุกการดึงข้อมูลผ่าน `assertPublicUrl()` — บล็อก loopback · RFC1918 · CGNAT · link-local · reserved และ IPv6 เทียบเท่า รวมถึง `localhost` / `metadata.google.internal` · hostname ถูก resolve แล้วตรวจทุกคำตอบ (public name ที่ชี้ 127.0.0.1 ก็โดน) |
`backend/src/customerToken.js` | ตัวตนคือ token `<id>.<HMAC-SHA256>` จาก `POST /api/customer` ส่งมาเป็น `x-customer-token` · header `x-customer-id` เดิมตายแล้ว (ปลอมได้) · ถ้าไม่มี token ที่ถูกต้อง → 401 ห้าม fallback ไป bucket กลาง |
`backend/src/securityHeaders.js` | CORS allowlist (ห้าม `*`) · security headers · `publicError` ไม่ส่งรายละเอียด 5xx ออกไป |

### ต้องตั้ง env (ไม่มี = ระบบจะ 503)

```
CUSTOMER_TOKEN_SECRET   ยาว ≥32 ตัวอักษร  ใช้เซ็น token
ADMIN_TOKEN             สำหรับดูประวัติการขาย
```

สร้างค่า: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

> ⚠️ **อย่าเปลี่ยน `CUSTOMER_TOKEN_SECRET` หลังปล่อยใช้งาน** — token เก่าทั้งหมดจะใช้ไม่ได้
> เครดิตที่ลูกค้าจ่ายแล้วจะหายถาวร

### ข้อมูลถูกเก็บที่ไหน

SQLite ไฟล์เดียว ผ่าน `node:sqlite` (มีในตัว Node 22.5+ จึงไม่ต้องติดตั้งอะไรเพิ่ม)

```
scraper-data.sqlite   →  path ตาม env SCRAPER_DB_PATH
```

เก็บ 3 อย่าง: `items` (harvests) · `customers` (เครดิต) · `payments` (ประวัติการขาย)

**บน Railway ต้องผูก volume** ไม่งั้นข้อมูลหายทุกครั้งที่ deploy (รีโปใหม่ = ไฟล์ใหม่)

```bash
# ตั้งใน Railway dashboard
SCRAPER_DB_PATH=/data/scraper-data.sqlite
# แล้วผูก volume ที่ /data
```

เทสต์ `tests/persistence.test.js` (7 เคส) ยืนยันว่าข้อมูลไม่หายเมื่อ restart

### ข้อจำกัดที่ยังไม่แก้ (รู้ไว้ ไม่ใช่ของลืม)

- ไม่มี rate limit ต่อ customer (มีแค่ 120 req/นาที ต่อ IP)
- ไม่มี audit log
- ยังไม่มี login — ตัวตนผูกกับ token ในเบราว์เซอร์ ล้างข้อมูลเครื่องแล้วก็ต้องซื้อใหม่