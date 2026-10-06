// test/load.test.mjs — unit test ของ lib/load.mjs (อ่านแม่แบบ CSV)
//
// เน้นหลักการเดียวกับไฟล์อื่น: ข้อมูลที่อ่านไม่ได้ต้องถูก"ข้ามและนับ" ไม่ใช่โยน error
// และห้ามเดาตัวเลข — เท่ากับกติกาของ weekly-report.mjs
// รัน: node --test templates/thai-shop-kit/test/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCsv, toRecords, parseAmount, parseIsoDate, readLedgerCsv, readInventoryCsv } from '../lib/load.mjs';
import { businessTaxOverview } from '../lib/thai-tax.mjs';

const NOW = new Date('2026-10-06T00:00:00Z');
const file = (name) => readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8');
const iso = (d) => d.toISOString().slice(0, 10);

describe('parseCsv', () => {
  test('แยกช่องตามจุลภาคและขึ้นบรรทัดใหม่', () => {
    assert.deepEqual(parseCsv('a,b\n1,2'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('ตัด BOM ไม่ให้ติดหัวคอลัมน์แรก', () => {
    assert.deepEqual(parseCsv('﻿วันที่,จำนวน\n2026-10-06,100')[0], ['วันที่', 'จำนวน']);
  });

  test('รองรับ CRLF (ไฟล์ที่มาจาก Excel บน Windows)', () => {
    assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('จุลภาคที่อยู่ในช่องที่หุ้มด้วยเครื่องหมายคำพูดได้', () => {
    assert.deepEqual(parseCsv('a,b\n"ข้าว, 5 กก.",2'), [
      ['a', 'b'],
      ['ข้าว, 5 กก.', '2'],
    ]);
  });

  test('เครื่องหมายคำพูดซ้ำในช่อง = อัญลักษณ์คำพูดตัวเดียว', () => {
    assert.deepEqual(parseCsv('a\n"เขียนว่า ""ok"" นะ"'), [['a'], ['เขียนว่า "ok" นะ']]);
  });

  test('ช่องว่างข้างในไม่ถูกตัด (toRecords ค่อยตัดทีหลัง)', () => {
    assert.deepEqual(parseCsv('a\n  1  '), [['a'], ['  1  ']]);
  });

  test('ไฟล์ว่าง = ไม่มีแถว ไม่ใช่แถวเดียวที่ว่าง', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv(undefined), []);
  });

  test('บรรทัดว่างกลางไฟล์ไม่ทำให้หัวตารางเพี้ยน', () => {
    assert.deepEqual(toRecords(parseCsv('a,b\n\n1,2\n\n')).length, 1);
  });
});

describe('toRecords', () => {
  test('แถวแรกคือหัวตาราง และตัดช่องว่างรอบชื่อคอลัมน์', () => {
    assert.deepEqual(toRecords(parseCsv(' วันที่ , จำนวน \n2026-10-06,100')), [{ 'วันที่': '2026-10-06', 'จำนวน': '100' }]);
  });

  test('ช่องที่สั้นกว่าหัวตารางได้ค่าว่าง ไม่ใช่ undefined', () => {
    assert.deepEqual(toRecords(parseCsv('a,b,c\n1')), [{ a: '1', b: '', c: '' }]);
  });

  test('ไม่มีข้อมูล = อาร์เรย์ว่าง', () => {
    assert.deepEqual(toRecords(parseCsv('a,b')), []);
  });
});

describe('parseAmount — เครื่องหมายเงินและจุลภาค', () => {
  test('ตัดสัญลักษณ์฿ และจุลภาคออก', () => {
    assert.equal(parseAmount('฿1,234.50'), 1234.5);
    assert.equal(parseAmount('1,000'), 1000);
    assert.equal(parseAmount(' ฿ 2,000 '), 2000);
  });

  test('เลข 0 ต้องรับได้ (ไม่ใช่ "ไม่มีค่า")', () => {
    assert.equal(parseAmount('0'), 0);
  });

  test('สิ่งที่ไม่ใช่ตัวเลขต้องได้ null — ห้ามเดาเป็น 0', () => {
    for (const bad of ['abc', '-', '', null, undefined, '๑๐๐']) {
      assert.equal(parseAmount(bad), null, `"${bad}" ต้องได้ null ไม่ใช่ตัวเลข`);
    }
  });
});

describe('parseIsoDate — วันที่เข้มงวด ไม่เดา', () => {
  test('รับเฉพาะ YYYY-MM-DD', () => {
    assert.equal(iso(parseIsoDate('2026-10-06')), '2026-10-06');
    assert.equal(parseIsoDate('06/10/2026'), null);
    assert.equal(parseIsoDate('6 ต.ค. 2569'), null);
    assert.equal(parseIsoDate(''), null);
  });

  test('วันที่ไม่มีอยู่จริงต้องได้ null ไม่ใช่เลื่อนไปเดือนอื่น', () => {
    assert.equal(parseIsoDate('2026-02-30'), null);
    assert.equal(parseIsoDate('2026-13-01'), null);
    assert.equal(parseIsoDate('2026-00-10'), null);
    assert.equal(parseIsoDate('2026-04-31'), null);
  });

  test('ปีอธิกสุรทินรับได้', () => {
    assert.equal(iso(parseIsoDate('2024-02-29')), '2024-02-29');
    assert.equal(parseIsoDate('2026-02-29'), null);
  });
});

describe('readLedgerCsv — บัญชีรายรับ-รายจ่าย', () => {
  test('แม่แบบที่แนบมาต้องอ่านได้ครบทุกแถว ไม่มีแถวหลุด', () => {
    const { rows, skipped } = readLedgerCsv(file('ledger.csv'));
    assert.equal(rows.length, 6);
    assert.equal(skipped, 0, 'แม่แบบของเราเองอ่านไม่ครบ = ข้อมูลตัวอย่างเพี้ยน');
  });

  test('แถวแรกต้องเป็นรูปแบบที่ businessTaxOverview() รับได้ตรง ๆ', () => {
    const { rows } = readLedgerCsv(file('ledger.csv'));
    const first = rows[0];
    assert.equal(first.type, 'INCOME');
    assert.equal(first.category, 'SALE');
    assert.equal(first.amount, 10_700);
    assert.equal(first.vatAmount, 700);
    assert.equal(first.whtAmount, 0);
    assert.ok(first.createdAt instanceof Date);
    assert.equal(iso(first.createdAt), '2026-09-01');
  });

  test('รับได้ทั้งภาษาไทยและอังกฤษ (รายรับ/INCOME)', () => {
    const { rows, skipped } = readLedgerCsv(
      'วันที่,ประเภท,จำนวนเงิน\n2026-10-01,รายรับ,100\n2026-10-02,INCOME,200\n2026-10-03,รายจ่าย,300\n2026-10-04,expense,400',
    );
    assert.equal(skipped, 0);
    assert.deepEqual(rows.map((r) => r.type), ['INCOME', 'INCOME', 'EXPENSE', 'EXPENSE']);
  });

  test('ช่อง VAT/หัก ณ ที่จ่ายเว้นว่าง = 0 แต่ช่องจำนวนเงินเว้นว่าง = ข้าม', () => {
    const { rows, skipped } = readLedgerCsv('วันที่,ประเภท,จำนวนเงิน,ภาษี VAT\n2026-10-01,รายรับ,500,');
    assert.equal(skipped, 0);
    assert.equal(rows[0].vatAmount, 0);
    assert.equal(rows[0].whtAmount, 0);

    const bad = readLedgerCsv('วันที่,ประเภท,จำนวนเงิน\n2026-10-01,รายรับ,');
    assert.equal(bad.rows.length, 0);
    assert.equal(bad.skipped, 1);
  });

  test('แถวเสียต้องถูกข้ามและนับ ไม่ใช่ทำให้ทั้งไฟล์พัง', () => {
    const csv = [
      'วันที่,ประเภท,จำนวนเงิน',
      '2026-10-01,รายรับ,1000', // ดี
      '2026-13-01,รายรับ,1000', // วันที่ไม่มีจริง
      '2026-10-02,ของแปลก,1000', // ประเภทไม่รู้จัก
      '2026-10-03,รายรับ,abc', // จำนวนเงินไม่ใช่ตัวเลข
      'not-a-date,รายรับ,1000', // รูปแบบวันที่ผิด
      '2026-10-05,รายจ่าย,200', // ดี
    ].join('\n');
    const { rows, skipped } = readLedgerCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(skipped, 4);
    assert.deepEqual(rows.map((r) => r.amount), [1000, 200]);
  });

  test('ไฟล์ว่าง = ไม่มีแถว ไม่ใช่ error', () => {
    assert.deepEqual(readLedgerCsv(''), { rows: [], skipped: 0 });
    assert.deepEqual(readLedgerCsv('วันที่,ประเภท,จำนวนเงิน'), { rows: [], skipped: 0 });
  });

  test('ไฟล์ที่เปิดใน Excel บน Windows แล้วบันทึกกลับ (CRLF) ต้องอ่านได้เหมือนกัน', () => {
    // เจ้าของร้านเกือบทุกคนใช้ Excel บน Windows → บันทึกกลับมาเป็น CRLF เสมอ
    // ถ้าตัวหารเศษ \r ไม่ถูกจัดการ คอลัมน์สุดท้ายจะเพี้ยนแล้วทั้งแถวหาย
    const lf = readLedgerCsv('วันที่,ประเภท,จำนวนเงิน,ภาษี VAT\n2026-10-01,รายรับ,1000,70');
    const crlf = readLedgerCsv('วันที่,ประเภท,จำนวนเงิน,ภาษี VAT\r\n2026-10-01,รายรับ,1000,70\r\n');
    assert.equal(crlf.skipped, 0, 'CRLF ทำให้แถวหาย');
    assert.deepEqual(crlf.rows, lf.rows);
    assert.equal(crlf.rows[0].vatAmount, 70, 'คอลัมน์สุดท้ายเพี้ยนจาก \\r ท้ายบรรทัด');
  });

  test('ต่อกับคำนวณภาษีได้จริงแบบปลายทางเดียว', () => {
    // พิสูจน์ว่า "อ่านไฟล์ → คำนวณ" เป็นขั้นตอนเดียวจบ ไม่ต้องแปลงมือ
    const { rows } = readLedgerCsv(file('ledger.csv'));
    const salesPayments = rows
      .filter((r) => r.type === 'INCOME')
      .map((r) => ({ amount: r.amount, vatRate: 0.07, paidAt: r.createdAt }));
    const o = businessTaxOverview({ vatRate: 0.07, salesPayments, ledger: rows, now: NOW });

    // งวด ต.ค. ของแม่แบบ: ขาย 16,050 ซื้อ 3,000 → VAT สุทธิ 1,050
    assert.equal(o.vat.thisMonth.outputVat, 1050);
    assert.equal(o.vat.thisMonth.inputVat, 0);
    assert.equal(o.vat.thisMonth.netVat, 1050);
    // ปีนี้: รายรับ 32,100 รายจ่าย 10,126
    assert.equal(o.year.income, 32_100);
    assert.equal(o.year.expense, 10_126);
  });
});

describe('readInventoryCsv — สต็อก', () => {
  test('แม่แบบที่แนบมาต้องอ่านได้ครบทุกแถว ไม่มีแถวหลุด', () => {
    const { rows, skipped } = readInventoryCsv(file('inventory.csv'), NOW);
    assert.equal(rows.length, 6);
    assert.equal(skipped, 0, 'แม่แบบของเราเองอ่านไม่ครบ = ข้อมูลตัวอย่างเพี้ยน');
  });

  test('ต้องติดสถานะครบทุกช่องตั้งแต่ตอนอ่าน ไม่ต้องไปคำนวณเองทีหลัง', () => {
    const { rows } = readInventoryCsv(file('inventory.csv'), NOW);
    for (const r of rows) {
      assert.ok(['ok', 'expiring', 'expired', 'na'].includes(r.expiry.status), `สถานะวันหมดอายุของ ${r.code} ไม่ถูกต้อง`);
      assert.equal(typeof r.stock.low, 'boolean', `${r.code} ไม่ได้คิดสถานะของเหลือน้อย`);
      assert.ok(r.expiryDate === null || r.expiryDate instanceof Date);
    }
  });

  test('วันหมดอายุคำนวณจากวันที่ซื้อ + อายุการเก็บ', () => {
    const { rows } = readInventoryCsv(file('inventory.csv'), NOW);
    const rice = rows.find((r) => r.code === 'RICE-01');
    assert.equal(iso(rice.expiryDate), '2027-01-28'); // 1 ส.ค. 2026 + 180 วัน
    assert.equal(rice.expiry.daysLeft, 114);
    assert.equal(rice.expiry.status, 'ok');
  });

  test('สินค้าที่ไม่มีอายุเก็บ = na ไม่ใช่หมดอายุทันที', () => {
    const { rows } = readInventoryCsv(file('inventory.csv'), NOW);
    const tool = rows.find((r) => r.code === 'TOOL-01');
    assert.equal(tool.expiryDate, null);
    assert.deepEqual(tool.expiry, { daysLeft: null, status: 'na' });
  });

  test('ของเหลือน้อยตามขั้นต่ำ', () => {
    const { rows } = readInventoryCsv(file('inventory.csv'), NOW);
    const low = rows.filter((r) => r.stock.low).map((r) => r.code);
    assert.deepEqual(low, ['FERT-01', 'MED-01']);
    // และต้องบอกได้ว่าเหลือน้อยกว่าขั้นต่ำเท่าไร
    assert.deepEqual(rows.find((r) => r.code === 'FERT-01').stock, { low: true, minimumStock: 20 });
  });

  test('ไม่ได้ใส่ขั้นต่ำ = ไม่มีคำว่าเหลือน้อย', () => {
    const { rows, skipped } = readInventoryCsv('ชื่อสินค้า,หมวด,จำนวน\nกระดาษ A4,TOOL,5\n', NOW);
    assert.equal(skipped, 0);
    assert.equal(rows[0].stock.low, false);
    assert.equal(rows[0].minimumStock, null);
  });

  test('หมวดที่ไม่รู้จักต้องข้ามและนับ (ห้ามเดาหมวดให้)', () => {
    const { rows, skipped } = readInventoryCsv('ชื่อสินค้า,หมวด,จำนวน\nของแปลก,ROCKET,5\nของดี,FOOD,5\n', NOW);
    assert.equal(rows.length, 1);
    assert.equal(skipped, 1);
    assert.equal(rows[0].category, 'FOOD');
  });

  test('ไม่มีชื่อสินค้าหรือไม่มีจำนวน = ข้าม', () => {
    const { rows, skipped } = readInventoryCsv('ชื่อสินค้า,หมวด,จำนวน\n,FOOD,5\nของ,FOOD,\nของดี,FOOD,5\n', NOW);
    assert.equal(rows.length, 1);
    assert.equal(skipped, 2);
  });

  test('วันที่ซื้อผิดรูปแบบไม่ทำให้แถวหาย — แค่ไม่คิดวันหมดอายุ', () => {
    const { rows, skipped } = readInventoryCsv('ชื่อสินค้า,หมวด,จำนวน,อายุเก็บ (วัน),วันที่ซื้อ\nข้าว,FOOD,5,30,31/12/2569\n', NOW);
    assert.equal(skipped, 0, 'วันที่ผิดรูปไม่ควรทิ้งทั้งแถว');
    assert.equal(rows[0].purchasedAt, null);
    // ไม่มีวันที่ซื้อ = นับอายุการเก็บจากวันอ้างอิงแทน
    assert.equal(iso(rows[0].expiryDate), '2026-11-05');
  });

  test('หมวดเขียนเล็กได้ (แปลงเป็นตัวพิมพ์ใหญ่ก่อนตรวจ)', () => {
    const { rows, skipped } = readInventoryCsv('ชื่อสินค้า,หมวด,จำนวน\nข้าว,food,5\n', NOW);
    assert.equal(skipped, 0);
    assert.equal(rows[0].category, 'FOOD');
  });

  test('ไฟล์ว่าง = ไม่มีแถว ไม่ใช่ error', () => {
    assert.deepEqual(readInventoryCsv('', NOW), { rows: [], skipped: 0 });
  });

  test('ไฟล์ CRLF (จาก Excel บน Windows) ต้องอ่านได้เหมือนไฟล์ LF', () => {
    const body = 'รหัส,ชื่อสินค้า,หมวด,จำนวน,ขั้นต่ำ,อายุเก็บ (วัน),วันที่ซื้อ\nRICE-01,ข้าว,FOOD,120,50,180,2026-08-01';
    const lf = readInventoryCsv(body, NOW);
    const crlf = readInventoryCsv(body.replace(/\n/g, '\r\n'), NOW);
    assert.equal(crlf.skipped, 0);
    assert.deepEqual(crlf.rows, lf.rows);
  });
});