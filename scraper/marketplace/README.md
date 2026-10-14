# Marketplace Orders — รับออเดอร์จาก Shopee / Lazada

แปลงออเดอร์จากตลาดเข้า ledger เดียวกับที่ร้านขายเอง
จุดประสงค์: ตัดสต็อกอัตโนมัติ และไม่ให้ตัวเลขภาษีเพี้ยนเพราะกรอกค่าธรรมเนียนผิด

## สถานะปัจจุบัน — ขั้นที่ 1 (ไม่ต่อ API)

รับไฟล์ที่ export ออกมาจากตลาดได้เลย ยังไม่ต้องมี App Secret

| | |
|---|---|
รับออเดอร์ | ✅ CSV / JSON ที่ export จาก Shopee/Lazada |
แปลงเป็น schema เดียว | ✅ |
ตัดสต็อก | ✅ (เฉพาะที่ขายในร้านนี้) |
คำนวณ VAT / ภาษีซื้อ | ✅ |
เขียนลง SQLite | ✅ |
ต่อ API จริง (sync อัตโนมัติ) | ⏳ รอ Partner App ที่แพลตฟอร์มอนุมัติ |

## ทำไมยังดึงอัตโนมัติไม่ได้

Shopee และ Lazada ไม่ให้ API ฟรี — ต้องขอ **Partner App** ก่อน แล้วรออนุมัติ
สิ่งที่ต้องใช้ต่อ API:

| ต้องการ | Shopee | Lazada |
|---|---|---
Shop ID | ✅ มีแล้ว | ✅ มีแล้ว |
Partner ID / App ID | ❌ ต้องขออนุมัติ | ❌ ต้องขออนุมัติ |
App Secret | ❌ ต้องขออนุมัติ | ❌ ต้องขออนุมัติ |

## 🔐 ความปลอดภัย — อ่านก่อนใส่ ID

**Shop ID เป็นตัวเลขร้าน** ไม่ใช่รหัสผ่าน → ไม่ละเอียดอ่อน พูดในแชทได้

**App Secret คือรหัสเข้าร้าน** → ห้ามส่งในแชท ห้าม commit ต้องอยู่ใน `.env` ที่ gitignore ไว้

```bash
# ใส่ใน .env (ไฟล์นี้ไม่ถูก commit)
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_SECRET=     ← ห้ามส่งในแชท
LAZADA_APP_KEY=
LAZADA_APP_SECRET=         ← ห้ามส่งในแชท
```

> ถ้า Secret หลุดไปที่ไหน → เข้า Partner Center เพิกถอนแล้วออกใหม่ทันที

## เริ่มใช้งาน

```bash
cd scraper
node marketplace/cli.mjs import orders.csv --channel shopee
node marketplace/cli.mjs stock
```

## โครงสร้าง

```
marketplace/
  src/
    schema.js       รูปแบบออเดอร์มาตรฐาน (channel-agnostic)
    parsers/
      shopee.js     แปลง CSV ของ Shopee
      lazada.js     แปลง CSV ของ Lazada
      generic.js    CSV/JSON ทั่วไป
    tax.js          VAT 7% · ค่าธรรมเนียน · ภาษีซื้อ
    stock.js        ตัด/คืนสต็อก
    store.js        บันทึกลง SQLite
  cli.mjs           คำสั่งใช้งาน
  test/             เทสต์
```