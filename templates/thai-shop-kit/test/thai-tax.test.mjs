// test/thai-tax.test.mjs — unit test ของ lib/thai-tax.mjs
//
// เทสต์ไฟล์นี้ตั้งใจ "ไม่ต้องต่ออะไรเลย": ไม่มี Prisma, ไม่มีฐานข้อมูล, ไม่มี HTTP server
// ทุกค่าที่คาดไว้คำนวณจากกฎภาษีด้วยมือ ไม่ใช่การอ่านค่าที่โค้ดเพิ่งผลิตให้เอง
// รัน: node --test templates/thai-shop-kit/test/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  RATES,
  endOfMonth,
  splitVatFromGross,
  computeVatMonthly,
  currentVatRate,
  isSme,
  computeCit,
  computePit,
  taxCalendar,
  businessTaxOverview,
} from '../lib/thai-tax.mjs';

const NOW = new Date('2026-10-06T00:00:00Z');
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

describe('RATES — ที่มาเดียวของตัวเลขภาษี', () => {
  test('อัตรา VAT ลดพิเศษ 7% ถึง 30 ก.ย. 2027 แล้วกลับไป 10%', () => {
    assert.equal(RATES.VAT.REDUCED, 0.07);
    assert.equal(RATES.VAT.REDUCED_UNTIL, '2027-09-30');
    assert.equal(RATES.VAT.STANDARD, 0.1);
  });

  test('เพดาน SME คือทุนจดทะเบียน 5 ล้าน และรายได้รวม 30 ล้าน', () => {
    assert.equal(RATES.SME_CIT.CAPITAL_CAP, 5_000_000);
    assert.equal(RATES.SME_CIT.REVENUE_CAP, 30_000_000);
    assert.equal(RATES.PIT.PERSONAL_ALLOWANCE, 60_000);
    assert.equal(RATES.CIT_STANDARD, 0.2);
  });

  test('อัตราก้าวหน้าของ SME คือ 0/15/20% เรียงจากฐานขั้นต่ำขึ้นไป', () => {
    assert.deepEqual(RATES.SME_CIT.BRACKETS, [
      { upTo: 300_000, rate: 0 },
      { upTo: 3_000_000, rate: 0.15 },
      { upTo: Infinity, rate: 0.2 },
    ]);
  });

  test('บุคคลธรรมดา 8 ขั้น เริ่ม 0% จบ 35%', () => {
    const rates = RATES.PIT.BRACKETS.map((b) => b.rate);
    assert.equal(rates.length, 8);
    assert.equal(rates[0], 0);
    assert.equal(rates.at(-1), 0.35);
    // ขั้นถัดไปต้องเริ่มที่เพดานของขั้นก่อนหน้า (ไม่มีช่องว่าง)
    for (let i = 1; i < RATES.PIT.BRACKETS.length; i += 1) {
      assert.equal(RATES.PIT.BRACKETS[i].upTo === Infinity || RATES.PIT.BRACKETS[i].upTo > RATES.PIT.BRACKETS[i - 1].upTo, true);
    }
  });
});

describe('endOfMonth — จุด anchor ของงวด VAT ที่เลือกย้อนหลัง', () => {
  test('เดือน 31 วันและ 30 วัน', () => {
    assert.equal(iso(endOfMonth('2026-01')), '2026-01-31');
    assert.equal(iso(endOfMonth('2026-02')), '2026-02-28');
    assert.equal(iso(endOfMonth('2026-04')), '2026-04-30');
  });

  test('ปีอธิกสุรทิน กุมภาพันธ์ได้ 29 วัน', () => {
    assert.equal(iso(endOfMonth('2024-02')), '2024-02-29');
    assert.equal(iso(endOfMonth('2028-02')), '2028-02-29');
  });

  test('เดือน 12 ของปีถัดไปไม่หลุดปี', () => {
    assert.equal(iso(endOfMonth('2026-12')), '2026-12-31');
  });

  test('รูปแบบผิดต้องต้องโยน error ไม่ใช่เดา', () => {
    for (const bad of ['2026-1', 'ม.ค. 2569', '', '2026/01', '202610']) {
      assert.throws(() => endOfMonth(bad), /month must be YYYY-MM/, `ควรโยนเมื่อใส่ "${bad}"`);
    }
  });

  test('เดือนที่ไม่มีอยู่จริงต้องโยน error (เดิมคืนเดือนอื่นให้เงียบ ๆ)', () => {
    // endOfMonth('2026-13') เดิมคืน 2027-01-31 = คำนวณงวด VAT ของเดือนที่ไม่มีจริง
    for (const bad of ['2026-00', '2026-13', '2026-99']) {
      assert.throws(() => endOfMonth(bad), /month out of range/, `ควรโยนเมื่อใส่ "${bad}"`);
    }
  });
});

describe('splitVatFromGross — แยก VAT ย้อนหลังจากราคารวม', () => {
  test('10700 ที่ 7% = สินค้า 10000 + VAT 700', () => {
    assert.deepEqual(splitVatFromGross(10700, 0.07), { base: 10000, vat: 700 });
  });

  test('อัตรา 0 = ไม่มี VAT ให้หัก', () => {
    assert.deepEqual(splitVatFromGross(5000, 0), { base: 5000, vat: 0 });
  });

  test('base + vat ต้องกลับได้ยอดรวมเสมอ (ทุกอัตรา ทุกจำนวนเงิน)', () => {
    // สัญญาคือ "คลาดเคลื่อนได้ไม่เกิน 1 สตางค์" เพราะอัลกอริทึมปัด base และ vat
    // แยกกันทีละฝั่งให้เป๊ะ 2 ตำแหน่ง (ถ้าปัดรวมทีเดียว VAT จะไม่ใช่ตัวเลขที่
    // ใบเสร็จจริง) — ดังนั้น 99.99 ที่ 5% ได้ 99.99000000000001 ซึ่งถูกต้องตามกฎนี้
    for (const rate of [0, 0.05, 0.07, 0.1]) {
      for (const gross of [0, 1, 99.99, 1000, 5350, 10700, 123456.78]) {
        const { base, vat } = splitVatFromGross(gross, rate);
        assert.ok(Math.abs(base + vat - gross) <= 0.01, `คลาดเกิน 1 สตางค์ที่อัตรา ${rate} ยอด ${gross}`);
        assert.match(String(base), /^-?\d+(\.\d{1,2})?$/, 'base ต้องไม่เกิน 2 ตำแหน่ง');
        assert.match(String(vat), /^-?\d+(\.\d{1,2})?$/, 'vat ต้องไม่เกิน 2 ตำแหน่ง');
      }
    }
  });

  test('จำนวนเงินที่ใช้ไม่ได้ต้องได้ 0 ไม่ใช่ NaN', () => {
    for (const bad of [-100, NaN, Infinity, -Infinity, undefined, null]) {
      assert.deepEqual(splitVatFromGross(bad, 0.07), { base: 0, vat: 0 }, `ค่า ${bad} ต้องเป็นศูนย์`);
    }
  });
});

describe('computeVatMonthly — ภาษีขายฝั่งขายของ ภ.พ.30', () => {
  test('แยกยอดที่มี VAT ออกจากยอดที่ไม่มี VAT ให้คนละช่อง', () => {
    const r = computeVatMonthly({ vatRate: 0.07, salesGrossByRate: { 0.07: 10700, 0: 5000 } });
    assert.deepEqual(r, { vatRate: 0.07, salesBase: 10000, outputVat: 700, salesWithoutVat: 5000 });
  });

  test('รวมยอดหลายรายการที่อัตราเดียวกันก่อนหัก VAT', () => {
    const r = computeVatMonthly({ vatRate: 0.07, salesGrossByRate: { 0.07: 10700 + 5350 } });
    assert.equal(r.salesBase, 15000);
    assert.equal(r.outputVat, 1050);
  });

  test('ไม่มีการขายเลย = ศูนย์ทุกช่อง (ไม่ใช่ NaN)', () => {
    const r = computeVatMonthly({ vatRate: 0.07, salesGrossByRate: {} });
    assert.deepEqual(r, { vatRate: 0.07, salesBase: 0, outputVat: 0, salesWithoutVat: 0 });
  });

  test('สินค้ายกเว้น VAT ไม่ต้องถูกนับเป็นภาษีขาย', () => {
    const r = computeVatMonthly({ vatRate: 0.07, salesGrossByRate: { 0: 10000 } });
    assert.equal(r.outputVat, 0);
    assert.equal(r.salesWithoutVat, 10000);
  });
});

describe('currentVatRate — อัตราที่ใช้ ณ วันที่กำหนด', () => {
  test('ยังอยู่ในช่วง 7%', () => {
    assert.equal(currentVatRate(new Date('2026-10-06T00:00:00Z')), 0.07);
    assert.equal(currentVatRate(new Date('2027-01-31T00:00:00Z')), 0.07);
  });

  test('วันสุดท้ายของอัตราลดยังเป็น 7% (เส้นเท่ายังอยู่ในช่วง)', () => {
    assert.equal(currentVatRate(new Date('2027-09-30T00:00:00Z')), 0.07);
  });

  test('พ้น 30 ก.ย. 2027 ต้องกลับไป 10%', () => {
    assert.equal(currentVatRate(new Date('2027-10-01T00:00:00Z')), 0.1);
    assert.equal(currentVatRate(new Date('2028-06-01T00:00:00Z')), 0.1);
  });
});

describe('isSme — เกณฑ์ ทุนจดทะเบียน ≤ 5 ล้าน และรายได้ ≤ 30 ล้าน', () => {
  test('ต่ำกว่าเพดานทั้งสองทาง = SME', () => {
    assert.equal(isSme(1_000_000, 10_000_000), true);
  });

  test('เท่ากับเพดานพอดียังเป็น SME (เกณฑ์คือ ≤)', () => {
    assert.equal(isSme(5_000_000, 30_000_000), true);
  });

  test('เกินเพียงบาทเดียว = ไม่ใช่ SME', () => {
    assert.equal(isSme(5_000_001, 30_000_000), false);
    assert.equal(isSme(5_000_000, 30_000_001), false);
  });
});

describe('computeCit — ภ.ง.ด.50', () => {
  const sme = (netProfit, extra = {}) => computeCit({ netProfit, capitalRegistered: 1_000_000, totalRevenue: 1_000_000, whtCredits: 0, ...extra });

  test('กำไรไม่เกิน 300,000 ยังไม่ต้องเสียภาษี (อัตรา 0%)', () => {
    const r = sme(300_000);
    assert.equal(r.isSme, true);
    assert.equal(r.grossTax, 0);
    assert.equal(r.taxDue, 0);
    assert.equal(r.breakdown.length, 1);
  });

  test('กำไร 500,000 = ช่วง 0% 300,000 + ช่วง 15% อีก 200,000 = 30,000', () => {
    const r = sme(500_000);
    assert.equal(r.grossTax, 30_000);
    assert.deepEqual(r.breakdown, [
      { from: 0, to: 300_000, rate: 0, base: 300_000, tax: 0 },
      { from: 300_000, to: 500_000, rate: 0.15, base: 200_000, tax: 30_000 },
    ]);
  });

  test('กำไร 4,000,000 ต้องข้ามครบทั้งสามขั้น = 405,000 + 200,000 = 605,000', () => {
    const r = sme(4_000_000);
    assert.equal(r.breakdown.length, 3);
    assert.equal(r.grossTax, 605_000);
    assert.equal(r.breakdown.map((b) => b.tax).reduce((a, b) => a + b, 0), 605_000);
  });

  test('ฐานภาษีรวมต้องเท่ากำไรเสมอ (ขั้นต้องไม่ทับกัน ไม่มีช่องว่าง)', () => {
    for (const profit of [1, 299_999, 300_000, 300_001, 999_999, 3_000_000, 3_000_001, 25_000_000]) {
      const r = sme(profit);
      const covered = r.breakdown.reduce((s, b) => s + b.base, 0);
      assert.equal(covered, profit, `ฐานภาษีไม่ครบที่กำไร ${profit}`);
      assert.equal(r.grossTax, r.breakdown.reduce((s, b) => s + b.tax, 0), `ภาษีไม่ตรง breakdown ที่กำไร ${profit}`);
    }
  });

  test('ไม่ใช่ SME = อัตรากลาง 20% ทั้งก้อน', () => {
    const r = computeCit({ netProfit: 500_000, capitalRegistered: 6_000_000, totalRevenue: 40_000_000, whtCredits: 0 });
    assert.equal(r.isSme, false);
    assert.equal(r.grossTax, 100_000);
    assert.equal(r.breakdown.length, 1);
  });

  test('ขาดทุนหรือกำไรศูนย์ = ภาษีศูนย์ ไม่ใช่ภาษีติดลบ', () => {
    for (const p of [-500_000, -1, 0]) {
      const r = sme(p);
      assert.equal(r.netProfit, 0);
      assert.equal(r.grossTax, 0);
      assert.equal(r.taxDue, 0);
    }
  });

  test('หักภาษี ณ ที่จ่ายที่ถูกหักไว้แล้วหักออกจากที่ต้องจ่ายเพิ่ม', () => {
    const r = sme(500_000, { whtCredits: 5_000 });
    assert.equal(r.grossTax, 30_000);
    assert.equal(r.whtCredits, 5_000);
    assert.equal(r.taxDue, 25_000);
  });

  test('เครดิตเกินภาษีที่ต้องจ่าย = จ่ายเพิ่ม 0 (ห้ามติดลบ)', () => {
    const r = sme(500_000, { whtCredits: 99_999 });
    assert.equal(r.taxDue, 0);
  });

  test('กรอกค่าผิดชนิดต้องไม่ทำให้ตัวเลขเพี้ยนเป็น NaN', () => {
    const r = computeCit({ netProfit: 'abc', capitalRegistered: undefined, totalRevenue: null, whtCredits: 'x' });
    assert.equal(r.netProfit, 0);
    assert.equal(r.taxDue, 0);
  });
});

describe('computePit — ภ.ง.ด.90/91 (ประมาณการเจ้าของธุรกิจ)', () => {
  test('รายได้ไม่เกินค่าใช้จ่ายส่วนตัว 60,000 = ไม่ต้องเสียภาษี', () => {
    const r = computePit({ totalIncome: 60_000 });
    assert.equal(r.taxable, 0);
    assert.equal(r.grossTax, 0);
    assert.deepEqual(r.breakdown, []);
  });

  test('รายได้ 150,000 → เกินค่าใช้จ่ายส่วนตัว 90,000 ยังอยู่ในขั้น 0% = ยังไม่เสียภาษี', () => {
    // ขั้นแรกของบุคคลธรรมดาคือ 0–150,000 อัตรา 0% และคิดจาก "เงินที่หักค่าใช้จ่ายส่วนตัวแล้ว"
    const r = computePit({ totalIncome: 150_000 });
    assert.equal(r.taxable, 90_000);
    assert.equal(r.grossTax, 0);
    assert.equal(r.breakdown.length, 1);
    assert.equal(r.breakdown[0].base, 90_000);
    assert.equal(r.breakdown[0].rate, 0);
  });

  test('รายได้ 240,000 → เกินส่วนตัว 180,000 คิด 5% เฉพาะส่วนที่เกิน 150,000 = 1,500', () => {
    const r = computePit({ totalIncome: 240_000 });
    assert.equal(r.taxable, 180_000);
    assert.deepEqual(r.breakdown, [
      { from: 0, to: 150_000, rate: 0, base: 150_000, tax: 0 },
      { from: 150_000, to: 180_000, rate: 0.05, base: 30_000, tax: 1_500 },
    ]);
    assert.equal(r.grossTax, 1_500);
  });

  test('รายได้ 1,500,000 ต้องข้าม 6 ขั้น รวม 225,000', () => {
    const r = computePit({ totalIncome: 1_500_000 });
    assert.equal(r.taxable, 1_440_000);
    assert.equal(r.breakdown.length, 6);
    assert.equal(r.grossTax, 225_000);
  });

  test('ฐานภาษีของแต่ละขั้นต้องต่อเนื่องและครอบคลุม taxable เป๊ะ', () => {
    for (const income of [0, 60_001, 210_000, 350_000, 480_000, 620_000, 870_000, 1_400_000, 6_000_000]) {
      const r = computePit({ totalIncome: income });
      const covered = r.breakdown.reduce((s, b) => s + b.base, 0);
      assert.equal(covered, r.taxable, `ฐานภาษีไม่ครบที่รายได้ ${income}`);
      // ขั้นต้องเรียงและไม่ทับกัน
      let prev = 0;
      for (const b of r.breakdown) {
        assert.equal(b.from, prev, `ขั้นไม่ต่อกันที่รายได้ ${income}`);
        prev = b.to;
      }
    }
  });

  test('รายได้ติดลบ/ศูนย์ = ภาษีศูนย์', () => {
    for (const income of [-1, -999_999, 0]) {
      const r = computePit({ totalIncome: income });
      assert.equal(r.totalIncome, 0);
      assert.equal(r.taxDue, 0);
    }
  });

  test('หัก ณ ที่จ่ายที่ถูกหักไว้แล้วหักออก แต่ห้ามเกินภาษีที่ต้องจ่าย', () => {
    assert.equal(computePit({ totalIncome: 240_000, whtCredits: 1_000 }).taxDue, 500);
    assert.equal(computePit({ totalIncome: 240_000, whtCredits: 99_999 }).taxDue, 0);
  });
});

describe('taxCalendar — ปฏิทินยื่น-จ่าย', () => {
  test('ต้องครบทั้ง 5 ใบ เรียงตามลำดับ', () => {
    const cal = taxCalendar(NOW);
    assert.deepEqual(cal.map((c) => c.key), ['PP30', 'PND3', 'PND50', 'PND51', 'PND90']);
  });

  test('วันครบกำหนดต้องเป็น ISO และมีคำอธิบายภาษาไทย', () => {
    for (const c of taxCalendar(NOW)) {
      assert.match(c.due, /^\d{4}-\d{2}-\d{2}$/, `${c.key} วันครบกำหนดไม่ใช่ ISO`);
      assert.ok(c.label.length > 10, `${c.key} ไม่มีคำอธิบาย`);
      assert.ok(typeof c.periodLabel === 'string' && c.periodLabel.length > 0, `${c.key} ไม่มีป้ายงวด`);
    }
  });

  test('ยังไม่ถึงวันครบกำหนด → งวดเดือนก่อนหน้าที่ยังยื่นได้ (6 ต.ค. ยังยื่น ก.ย. ได้ถึง 15 ต.ค.)', () => {
    const cal = taxCalendar(NOW);
    assert.equal(cal.find((c) => c.key === 'PP30').due, '2026-10-15');
    assert.equal(cal.find((c) => c.key === 'PND3').due, '2026-10-07');
  });

  test('พ้นวันครบกำหนดแล้ว → งวดเดือนนี้ (16 ต.ค. งวด ต.ค. ต้องยื่น 15 พ.ย.)', () => {
    const cal = taxCalendar(new Date('2026-10-16T00:00:00Z'));
    assert.equal(cal.find((c) => c.key === 'PP30').due, '2026-11-15');
  });

  test('ภ.ง.ด.50 = วันปิดรอบบัญชี + 150 วัน (31 ธ.ค. 2026 → 30 พ.ค. 2027)', () => {
    assert.equal(taxCalendar(NOW).find((c) => c.key === 'PND50').due, '2027-05-30');
  });

  test('ถ้าปิดรอบบัญชีเองได้ ต้องใช้วันนั้น (30 มิ.ย. 2026 → 27 พ.ย. 2026)', () => {
    assert.equal(taxCalendar(NOW, '2026-06-30').find((c) => c.key === 'PND50').due, '2026-11-27');
  });

  test('ภ.ง.ด.51 = ปิดครึ่งปี 30 มิ.ย. + 2 เดือน = 31 ส.ค.', () => {
    assert.equal(taxCalendar(NOW).find((c) => c.key === 'PND51').due, '2026-08-31');
  });

  test('ภ.ง.ด.90 = 31 มี.ค. ของปีถัดไปเสมอ', () => {
    assert.equal(taxCalendar(NOW).find((c) => c.key === 'PND90').due, '2027-03-31');
    assert.equal(taxCalendar(new Date('2029-03-01T00:00:00Z')).find((c) => c.key === 'PND90').due, '2030-03-31');
  });
});

describe('businessTaxOverview — ประกอบจากข้อมูลจริงของร้าน', () => {
  // ร้านขายสินค้ารวม VAT 2 บิลในเดือน ต.ค. + ซื้อของ 1 รายการใน ต.ค. + ค่าเช่าใน ก.ย.
  const salesPayments = [
    { amount: 10_700, vatRate: 0.07, paidAt: new Date('2026-10-02T00:00:00Z') },
    { amount: 5_350, vatRate: 0.07, paidAt: new Date('2026-10-05T00:00:00Z') },
  ];
  const ledger = [
    { type: 'EXPENSE', category: 'COGS', amount: 2_126, vatAmount: 139, whtAmount: 0, createdAt: new Date('2026-10-03T00:00:00Z') },
    { type: 'INCOME', category: 'SALE', amount: 16_050, vatAmount: 1_050, whtAmount: 0, createdAt: new Date('2026-10-05T00:00:00Z') },
    { type: 'EXPENSE', category: 'RENT', amount: 5_000, vatAmount: 0, whtAmount: 0, createdAt: new Date('2026-09-10T00:00:00Z') },
  ];
  const overview = () => businessTaxOverview({ vatRate: 0.07, salesPayments, ledger, now: NOW });

  test('VAT งวดเดือนนี้ = ขาย 16,050 − ซื้อ 139 = ต้องจ่าย 911', () => {
    const vat = overview().vat.thisMonth;
    assert.equal(vat.salesBase, 15_000);
    assert.equal(vat.outputVat, 1_050);
    assert.equal(vat.inputVat, 139);
    assert.equal(vat.netVat, 911);
  });

  test('เดือนก่อนหน้าที่ไม่มีรายการต้องเป็นศูนย์ ไม่ใช่ค้างจากเดือนนี้', () => {
    assert.deepEqual(overview().vat.lastMonth, {
      vatRate: 0.07,
      salesBase: 0,
      outputVat: 0,
      salesWithoutVat: 0,
    });
  });

  test('รายได้/รายจ่ายปีนี้รวมจากทั้ง ต.ค. และ ก.ย.', () => {
    const year = overview().year;
    assert.equal(year.income, 16_050);
    assert.equal(year.expense, 7_126); // 2,126 + 5,000
    assert.deepEqual(year.wht, { received: 0, paid: 0 });
  });

  test('กำไรก่อนภาษีต้องหัก VAT ออก เพราะ VAT ไม่ใช่รายได้ของกิจการ', () => {
    const year = overview().year;
    // 16,050 − 1,050 − (7,126 − 139) = 8,013
    assert.equal(year.netProfitBeforeTax, 8_013);
  });

  test('กำไร 8,013 ยังต่ำกว่าขั้นแรก → CIT และ PIT เป็นศูนย์', () => {
    const o = overview();
    assert.equal(o.cit.isSme, true);
    assert.equal(o.cit.taxDue, 0);
    assert.equal(o.pit.taxable, 0);
    assert.equal(o.pit.taxDue, 0);
  });

  test('ต้องรายงานอัตรา VAT ที่ใช้จริง ณ วันที่อ้างอิง', () => {
    const o = overview();
    assert.equal(o.vatRate, 0.07);
    assert.equal(o.currentVatRate, 0.07);
    assert.equal(o.asOf, NOW.toISOString());
  });

  test('เลือกย้อนหลังได้ด้วย month และต้องไม่รวมเดือนนั้นกับเดือนปัจจุบัน', () => {
    const o = businessTaxOverview({ vatRate: 0.07, salesPayments, ledger, now: NOW, month: '2026-08' });
    assert.equal(o.vat.thisMonth.outputVat, 0);
    assert.equal(o.vat.lastMonth.outputVat, 0);
  });

  test('เลือกย้อนหลังเป็นเดือนที่มีของจริง = ได้ยอดของเดือนนั้น', () => {
    const sales = [{ amount: 10_700, vatRate: 0.07, paidAt: new Date('2026-09-01T00:00:00Z') }];
    const o = businessTaxOverview({ vatRate: 0.07, salesPayments: sales, ledger, now: NOW, month: '2026-09' });
    assert.equal(o.vat.thisMonth.outputVat, 700);
  });

  test('ทุกตัวเลขต้องเป็นตัวเลขจริง ไม่มี NaN หลุดออกมา', () => {
    const o = overview();
    const walk = (v, path = '') => {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `NaN/Infinity ที่ ${path}`);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(o, 'overview');
  });

  test('ข้อมูลเดิมต้องได้ผลเดิมเสมอ (deterministic — ไม่แตะเวลาระบบ)', () => {
    assert.deepEqual(overview(), overview());
  });

  test('ร้านยังไม่มีรายการเลยต้องได้ศูนย์ทั้งหมด ไม่ใช่ error', () => {
    const o = businessTaxOverview({ vatRate: 0.07, salesPayments: [], ledger: [], now: NOW });
    assert.equal(o.vat.thisMonth.netVat, 0);
    assert.equal(o.year.income, 0);
    assert.equal(o.year.netProfitBeforeTax, 0);
    assert.equal(o.cit.taxDue, 0);
    assert.equal(o.calendar.length, 5);
  });
});