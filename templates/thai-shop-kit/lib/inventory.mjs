// lib/inventory.mjs — ต้นทุน/วันหมดอายุ/สถานะสต็อก สำหรับร้านเล็ก (pure functions)
//
// ส่วนตรรกะที่ไม่แตะฐานข้อมูลทั้งหมด: วันหมดอายุ, สถานะของเหลือน้อย, อายุการเก็บ
// ส่วนหัก/เติมสต็อก รับ "ที่เก็บข้อมูล" เป็นพารามิเตอร์ (duck-typed เหมือน Prisma แต่ไม่ต้อง
// ต่อฐานข้อมูลจริง) จึงทดสอบด้วย stub ได้ 100% โดยไม่ต้องลงอะไร
//
// ที่มา: ดึงจาก sovereign-os/core-api/src/services/inventory.service.ts (โครงการ
// sovereign-origin) แปลง TypeScript → JavaScript ESM ที่ไม่พึ่ง dependency ใด ๆ
// ตรรกะคงเดิมทุกบรรทัด เปลี่ยนเฉพาะการถอด type annotation

export const INVENTORY_CATEGORIES = [
  'WATER',
  'FOOD',
  'SEED',
  'FUEL',
  'MEDICINE',
  'TOOL',
  'MATERIAL',
  'PRECIOUS_METAL',
  'COMPOST',
  'FERTILIZER',
  'OTHER',
];

const DAY_MS = 86_400_000;

// จำนวนวันก่อนหมดอายุเริ่มเตือน (ตั้งได้ผ่าน env, ค่าเริ่ม 30 วัน)
// อ่าน process.env แบบกัน ReferenceError เพื่อให้วางในเบราว์เซอร์ได้โดยไม่พัง
const ENV = typeof process !== 'undefined' && process && process.env ? process.env : {};

/** จำนวนวันก่อนหมดอายุเริ่มเตือน (ตั้งได้ผ่าน env, ค่าเริ่ม 30 วัน) */
export const EXPIRING_SOON_DAYS = parseInt(ENV.INVENTORY_EXPIRING_SOON_DAYS || '30', 10);

/** จำนวนวันก่อนหมดอายุ (ปัดขึ้นเป็นจำนวนเต็มวัน) */
export function daysUntil(date, now = new Date()) {
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / DAY_MS);
}

/**
 * สถานะวันหมดอายุ:
 * - expired   หมดอายุแล้ว (daysLeft < 0)
 * - expiring  เหลือไม่เกิน expiringSoonDays วัน
 * - ok        ยังเหลืออีกนาน
 * - na        ไม่ตั้งวันหมดอายุ
 * @returns {{daysLeft:number|null, status:'ok'|'expiring'|'expired'|'na'}}
 */
export function computeExpiryStatus(expiryDate, now = new Date(), expiringSoonDays = EXPIRING_SOON_DAYS) {
  if (expiryDate == null) return { daysLeft: null, status: 'na' };
  const date = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return { daysLeft: null, status: 'na' };
  const left = daysUntil(date, now);
  if (left < 0) return { daysLeft: left, status: 'expired' };
  if (left <= expiringSoonDays) return { daysLeft: left, status: 'expiring' };
  return { daysLeft: left, status: 'ok' };
}

/** ของเหลือน้อย = มีค่า minimum_stock และ quantity ต่ำกว่านั้น */
export function computeStockStatus(quantity, minimumStock) {
  if (minimumStock == null || minimumStock <= 0) return { low: false, minimumStock: null };
  return { low: quantity < minimumStock, minimumStock };
}

/** คำนวณวันหมดอายุอัตโนมัติจาก shelf_life_days (นับจากวันนี้ + อายุการเก็บ) */
export function computeExpiryDate(shelfLifeDays, now = new Date()) {
  if (shelfLifeDays == null || !Number.isFinite(Number(shelfLifeDays)) || Number(shelfLifeDays) <= 0) {
    return null;
  }
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + Math.floor(Number(shelfLifeDays)));
  return date;
}

/** ตรวจสอบ category ที่ถูกต้อง */
export function isCategoryValid(category) {
  return INVENTORY_CATEGORIES.includes(category);
}

// ─────────────────────────────────────────────────────────────
// Stock adjustment — หัก/เติมยอดคงเหลืออัตโนมัติ
// รับ store ที่มี inventoryItem.findUnique/update (เช่น Prisma client)
// ─────────────────────────────────────────────────────────────

/**
 * หักยอดคงเหลือ — หักเกิน = หักได้เท่าที่เหลือ + รายงาน shortfall (ไม่มีติดลบ)
 * @returns {Promise<{ok:boolean,name?:string,remaining:number,shortfall:number,reason?:string}>}
 */
export async function deductStock(prisma, itemId, qty) {
  const amount = Math.max(0, Number(qty) || 0);
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, remaining: 0, shortfall: amount, reason: 'inventory item not found' };
  const remaining = Math.max(0, Number(item.quantity) - amount);
  const shortfall = Math.max(0, amount - Number(item.quantity));
  if (amount === 0) return { ok: true, name: item.name, remaining: Number(item.quantity), shortfall: 0 };
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: remaining } });
  return {
    ok: shortfall === 0,
    name: item.name,
    remaining,
    shortfall,
    reason: shortfall > 0 ? `หักได้ ${remaining}/${Number(item.quantity)} — ขาด ${shortfall}` : undefined,
  };
}

/** เติมยอดคงเหลือ (กลับเข้าคลัง) */
export async function addStock(prisma, itemId, qty) {
  const amount = Math.max(0, Number(qty) || 0);
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, remaining: 0, shortfall: 0, reason: 'inventory item not found' };
  if (amount === 0) return { ok: true, name: item.name, remaining: Number(item.quantity), shortfall: 0 };
  const remaining = Number(item.quantity) + amount;
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: remaining } });
  return { ok: true, name: item.name, remaining, shortfall: 0 };
}