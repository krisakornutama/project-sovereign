// test/inventory.test.mjs — unit test ของ lib/inventory.mjs
//
// ยืนยันว่าไฟล์นี้รันได้โดยไม่ต้องต่อฐานข้อมูล: การหัก/เติมสต็อกถูกทดสอบด้วย store
// ปลอมที่มีแค่ findUnique/update เหมือน Prisma — ไม่มี Prisma จริงเข้ามาเกี่ยวข้อง
// รัน: node --test templates/thai-shop-kit/test/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  INVENTORY_CATEGORIES,
  EXPIRING_SOON_DAYS,
  daysUntil,
  computeExpiryStatus,
  computeStockStatus,
  computeExpiryDate,
  isCategoryValid,
  deductStock,
  addStock,
} from '../lib/inventory.mjs';

const NOW = new Date('2026-10-06T00:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86_400_000);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

/** store ปลอม มีแค่ inventoryItem.findUnique/update — พิสูจน์ว่าไม่ต้องมี Prisma */
function fakeStore(items) {
  const updates = [];
  return {
    updates,
    store: {
      inventoryItem: {
        async findUnique({ where }) {
          const found = items.find((i) => i.id === where.id);
          return found ? { ...found } : null;
        },
        async update({ where, data }) {
          updates.push({ where, data });
          const found = items.find((i) => i.id === where.id);
          if (found) Object.assign(found, data);
          return found;
        },
      },
    },
  };
}

describe('INVENTORY_CATEGORIES', () => {
  test('ครบ 11 หมวด ไม่ซ้ำ และใช้ตัวพิมพ์ใหญ่ทั้งหมด', () => {
    assert.equal(INVENTORY_CATEGORIES.length, 11);
    assert.equal(new Set(INVENTORY_CATEGORIES).size, 11);
    for (const c of INVENTORY_CATEGORIES) assert.match(c, /^[A-Z_]+$/, `หมวด ${c} ไม่ใช่ตัวพิมพ์ใหญ่`);
  });

  test('ตรวจหมวดได้ถูกต้อง', () => {
    assert.equal(isCategoryValid('WATER'), true);
    assert.equal(isCategoryValid('PRECIOUS_METAL'), true);
    assert.equal(isCategoryValid('ROCKET'), false);
    assert.equal(isCategoryValid(''), false);
  });
});

describe('daysUntil', () => {
  test('นับเป็นจำนวนเต็มวัน', () => {
    assert.equal(daysUntil(day(10), NOW), 10);
    assert.equal(daysUntil(day(0), NOW), 0);
    assert.equal(daysUntil(day(-1), NOW), -1);
  });

  test('เศษวินาทีปัดขึ้น ไม่ใช่ลง (ยังไม่ถึงวันเต็ม = เหลืออีก 1 วัน)', () => {
    assert.equal(daysUntil(new Date(NOW.getTime() + 12 * 3_600_000), NOW), 1);
    assert.equal(daysUntil(new Date(NOW.getTime() + 1000), NOW), 1);
  });
});

describe('EXPIRING_SOON_DAYS', () => {
  test('ค่าเริ่มต้น 30 วัน และตั้งค่าเป็นจำนวนเต็มเสมอ', () => {
    assert.equal(EXPIRING_SOON_DAYS, 30);
    assert.ok(Number.isInteger(EXPIRING_SOON_DAYS));
  });
});

describe('computeExpiryStatus', () => {
  test('ไม่มีวันหมดอายุ = na (ไม่ใช่ error)', () => {
    assert.deepEqual(computeExpiryStatus(null, NOW), { daysLeft: null, status: 'na' });
    assert.deepEqual(computeExpiryStatus(undefined, NOW), { daysLeft: null, status: 'na' });
  });

  test('วันที่อ่านไม่ได้ = na ไม่ใช่ expired (กันของเสียหาย)', () => {
    for (const bad of ['ไม่รู้', 'not-a-date', '']) {
      assert.deepEqual(computeExpiryStatus(bad, NOW), { daysLeft: null, status: 'na' }, `"${bad}" ต้องเป็น na`);
    }
  });

  test('พ้นวันแล้ว = expired พร้อมจำนวนวันติดลบ', () => {
    assert.deepEqual(computeExpiryStatus(day(-1), NOW), { daysLeft: -1, status: 'expired' });
    assert.deepEqual(computeExpiryStatus(day(-400), NOW), { daysLeft: -400, status: 'expired' });
  });

  test('วันหมดอายุตรงวันนี้ = expiring (ยังไม่ expired)', () => {
    assert.deepEqual(computeExpiryStatus(day(0), NOW), { daysLeft: 0, status: 'expiring' });
  });

  test('เหลือไม่เกิน 30 วัน = expiring', () => {
    assert.equal(computeExpiryStatus(day(30), NOW).status, 'expiring');
    assert.equal(computeExpiryStatus(day(14), NOW).status, 'expiring');
  });

  test('เกิน 30 วัน = ok', () => {
    assert.equal(computeExpiryStatus(day(31), NOW).status, 'ok');
    assert.equal(computeExpiryStatus(day(365), NOW).status, 'ok');
  });

  test('ตั้งเกณฑ์เตือนเองได้', () => {
    assert.equal(computeExpiryStatus(day(14), NOW, 7).status, 'ok');
    assert.equal(computeExpiryStatus(day(14), NOW, 14).status, 'expiring');
    assert.equal(computeExpiryStatus(day(14), NOW, 0).status, 'ok');
  });

  test('รับวันที่เป็นสตริง ISO ได้ด้วย', () => {
    assert.deepEqual(computeExpiryStatus('2026-10-20', NOW), { daysLeft: 14, status: 'expiring' });
  });
});

describe('computeStockStatus', () => {
  test('ไม่ได้ตั้งขั้นต่ำ = ไม่มีคำว่าเหลือน้อย', () => {
    assert.deepEqual(computeStockStatus(5, null), { low: false, minimumStock: null });
    assert.deepEqual(computeStockStatus(5, undefined), { low: false, minimumStock: null });
    assert.deepEqual(computeStockStatus(5, 0), { low: false, minimumStock: null });
  });

  test('ต่ำกว่าขั้นต่ำ = เหลือน้อย', () => {
    assert.deepEqual(computeStockStatus(5, 10), { low: true, minimumStock: 10 });
    assert.deepEqual(computeStockStatus(0, 10), { low: true, minimumStock: 10 });
  });

  test('เท่ากับขั้นต่ำพอดี = ยังไม่เหลือน้อย (เกณฑ์คือ <)', () => {
    assert.deepEqual(computeStockStatus(10, 10), { low: false, minimumStock: 10 });
  });

  test('มากกว่าขั้นต่ำ = ปกติ', () => {
    assert.deepEqual(computeStockStatus(11, 10), { low: false, minimumStock: 10 });
  });
});

describe('computeExpiryDate', () => {
  test('นับจากวันอ้างอิง + อายุการเก็บ', () => {
    assert.equal(iso(computeExpiryDate(30, NOW)), '2026-11-05');
    assert.equal(iso(computeExpiryDate(1, NOW)), '2026-10-07');
  });

  test('ข้ามเดือน/ข้ามปีได้ถูกต้อง', () => {
    assert.equal(iso(computeExpiryDate(180, NOW)), '2027-04-04');
    assert.equal(iso(computeExpiryDate(30, new Date('2026-12-20T00:00:00Z'))), '2027-01-19');
  });

  test('อายุการเก็บเป็นเศษปัดทิ้ง ไม่ปัดขึ้น', () => {
    assert.equal(iso(computeExpiryDate(30.9, NOW)), '2026-11-05');
  });

  test('ไม่มีอายุการเก็บ = ไม่มีวันหมดอายุ (null ไม่ใช่วันที่ผิด)', () => {
    for (const bad of [null, undefined, 0, -5, NaN, 'abc']) {
      assert.equal(computeExpiryDate(bad, NOW), null, `ค่า ${bad} ต้องได้ null`);
    }
  });

  test('อายุการเก็บเป็นสตริงตัวเลขก็รับได้', () => {
    assert.equal(iso(computeExpiryDate('30', NOW)), '2026-11-05');
  });

  test('ไม่แก้วันอ้างอิงเดิม (ฟังก์ชันบริสุทธิ์)', () => {
    const anchor = new Date('2026-10-06T00:00:00Z');
    computeExpiryDate(30, anchor);
    assert.equal(iso(anchor), '2026-10-06');
  });
});

describe('deductStock / addStock — ทดสอบด้วย store ปลอม (ไม่ใช้ Prisma)', () => {
  test('หักพอดี = สำเร็จ ไม่ขาด', async () => {
    const { store, updates } = fakeStore([{ id: 'a', name: 'ข้าว 5 กก.', quantity: 10 }]);
    const r = await deductStock(store, 'a', 3);
    assert.equal(r.ok, true);
    assert.equal(r.name, 'ข้าว 5 กก.');
    assert.equal(r.remaining, 7);
    assert.equal(r.shortfall, 0);
    assert.equal(r.reason, undefined);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].data, { quantity: 7 });
  });

  test('หักเกินของที่มี = ตัดให้หมด ไม่ติดลบ และรายงานขาด', async () => {
    const items = [{ id: 'a', name: 'ปุ๋ย', quantity: 4 }];
    const { store } = fakeStore(items);
    const r = await deductStock(store, 'a', 10);
    assert.equal(r.ok, false);
    assert.equal(r.remaining, 0);
    assert.equal(r.shortfall, 6);
    assert.match(r.reason, /ขาด 6/);
    assert.equal(items[0].quantity, 0, 'ของจริงต้องเหลือ 0 ไม่ใช่ติดลบ');
  });

  test('หักพอดีขอบ (เท่ากับของที่มี) = สำเร็จ', async () => {
    const { store } = fakeStore([{ id: 'a', name: 'ยา', quantity: 5 }]);
    const r = await deductStock(store, 'a', 5);
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 0);
    assert.equal(r.shortfall, 0);
  });

  test('ไม่เจอสินค้า = ล้มเหลว พร้อมเหตุผล และไม่แตะข้อมูล', async () => {
    const { store, updates } = fakeStore([]);
    const r = await deductStock(store, 'missing', 5);
    assert.equal(r.ok, false);
    assert.equal(r.remaining, 0);
    assert.equal(r.shortfall, 5);
    assert.equal(r.reason, 'inventory item not found');
    assert.equal(updates.length, 0);
  });

  test('หัก 0 หรือจำนวนติดลบ = ไม่ทำอะไร และไม่เขียนฐานข้อมูล', async () => {
    for (const qty of [0, -5, null, undefined]) {
      const { store, updates } = fakeStore([{ id: 'a', name: 'เมล็ด', quantity: 10 }]);
      const r = await deductStock(store, 'a', qty);
      assert.equal(r.ok, true, `qty=${qty} ควรไม่ล้มเหลว`);
      assert.equal(r.remaining, 10);
      assert.equal(updates.length, 0, `qty=${qty} ไม่ควรเขียนฐานข้อมูล`);
    }
  });

  test('เติมของ = ยอดเพิ่มขึ้นเท่าจำนวนที่ใส่', async () => {
    const { store, updates } = fakeStore([{ id: 'a', name: 'ถังน้ำ', quantity: 10 }]);
    const r = await addStock(store, 'a', 5);
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 15);
    assert.equal(r.shortfall, 0);
    assert.deepEqual(updates[0].data, { quantity: 15 });
  });

  test('เติมเข้าสินค้าที่ไม่มีอยู่ = ล้มเหลว', async () => {
    const { store } = fakeStore([]);
    const r = await addStock(store, 'missing', 5);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'inventory item not found');
  });

  test('เติม 0 หรือจำนวนติดลบ = ไม่เขียนฐานข้อมูล', async () => {
    for (const qty of [0, -3]) {
      const { store, updates } = fakeStore([{ id: 'a', name: 'ขวดแก้ว', quantity: 7 }]);
      const r = await addStock(store, 'a', qty);
      assert.equal(r.ok, true);
      assert.equal(r.remaining, 7);
      assert.equal(updates.length, 0, `qty=${qty} ไม่ควรเขียนฐานข้อมูล`);
    }
  });

  test('หักแล้วเติมกลับได้ยอดเดิม (ไม่หลุดลอยตอนคิดเลขทศนิยม)', async () => {
    const items = [{ id: 'a', name: 'ปูน', quantity: 7 }];
    const { store } = fakeStore(items);
    await deductStock(store, 'a', 3);
    const back = await addStock(store, 'a', 3);
    assert.equal(back.remaining, 7);
    assert.equal(items[0].quantity, 7);
  });
});