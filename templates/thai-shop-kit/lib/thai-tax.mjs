// lib/thai-tax.mjs — ภาษีไทยสำหรับร้านเล็ก (คำนวณล้วน ๆ ไม่ใช่คำแนะนำภาษี)
//
// ตัวเลขอ้างอิงประมวลรัษฎากร ณ ก.ย. 2026: VAT 7% ยกเว้นลดอัตราถึง 30 ก.ย. 2027
// (มติ ครม. ต่ออายุอีก 1 ปี), ภาษีเงินได้นิติบุคคล SME 0/15/20% (ทุนจดทะเบียน ≤ 5 ล้าน
// และรายได้รวม ≤ 30 ล้าน), ภาษีเงินได้บุคคลธรรมดา 8 ขั้น 0–35%
//
// หลักการ: ตัวเลขทุกตัวมีที่มาเดียวในไฟล์นี้ (RATES) — ห้ามเขียนเปอร์เซ็นต์ที่อื่น
// ทุกฟังก์ชันเป็น pure function (ไม่แตะฐานข้อมูล) → เทสได้ตรง ๆ ทุกกรณี
// การเงินเป็นบาท 2 ตำแหน่ง (round ตอนท้ายเสมอ ไม่ปัดกลางทาง)
//
// ที่มา: ดึงจาก sovereign-os/core-api/src/services/thai-tax.service.ts (โครงการ
// sovereign-origin) แปลง TypeScript → JavaScript ESM ที่ไม่พึ่ง dependency ใด ๆ
// ตรรกะคงเดิมทุกบรรทัด เปลี่ยนเฉพาะการถอด type annotation

// ────────────────────────────────────────────────────────────────────────────
// RATES — ที่มาเดียวของตัวเลขภาษีทั้งชุด
// ────────────────────────────────────────────────────────────────────────────

export const RATES = {
  // VAT — อัตราลดพิเศษ 7% (รวม local tax) ต่ออายุถึง 30 ก.ย. 2027; ปกติ 10%
  VAT: {
    REDUCED: 0.07,
    REDUCED_UNTIL: '2027-09-30',
    STANDARD: 0.10,
  },
  // ภ.ง.ด.50 — นิติบุคคล SME: ทุนจดทะเบียน ≤ 5 ล้าน และรายได้รวมในรอบบัญชี ≤ 30 ล้าน
  SME_CIT: {
    CAPITAL_CAP: 5_000_000,
    REVENUE_CAP: 30_000_000,
    BRACKETS: [
      { upTo: 300_000, rate: 0 },
      { upTo: 3_000_000, rate: 0.15 },
      { upTo: Infinity, rate: 0.20 },
    ],
  },
  // นิติบุคคลทั่วไป — อัตรากลาง 20% (มาตรา 65(2))
  CIT_STANDARD: 0.20,
  // ภ.ง.ด.90/91 — บุคคลธรรมดา 8 ขั้น (มาตรา 48(2))
  PIT: {
    PERSONAL_ALLOWANCE: 60_000, // ค่าใช้จ่ายส่วนตัว (ลดหย่อนอื่นยังไม่รองรับ)
    BRACKETS: [
      { upTo: 150_000, rate: 0 },
      { upTo: 300_000, rate: 0.05 },
      { upTo: 500_000, rate: 0.10 },
      { upTo: 750_000, rate: 0.15 },
      { upTo: 1_000_000, rate: 0.20 },
      { upTo: 2_000_000, rate: 0.25 },
      { upTo: 5_000_000, rate: 0.30 },
      { upTo: Infinity, rate: 0.35 },
    ],
  },
};
// หมายเหตุ หัก ณ ที่จ่าย (WHT): ระบบเก็บยอดที่ถูกหักจริงเท่านั้น อัตราตาม ท.ป.4/ท.ป.6
// (เช่า 5%, ค่าจ้างทั่วไป 3%, ขนส่ง 1%) กรอกตอนออกบิล/จ่ายเงิน

// ────────────────────────────────────────────────────────────────────────────
// helpers — ปัดเงินบาท 2 ตำแหน่ง, แปลง "ราคารวม VAT" → "ราคาสินค้า + VAT"
// ────────────────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * ms สุดท้ายของเดือน YYYY-MM — ใช้เป็นจุด anchor ของงวด VAT ที่เลือกย้อนหลัง
 *
 * [แก้จากต้นฉบับ] เดิมรับได้เฉพาะรูปแบบ YYYY-MM แต่ไม่เช็กว่าเดือนอยู่ในช่วง 1–12
 * ทำให้ endOfMonth('2026-13') คืน 2027-01-31 และ '2026-00' คืน 2025-12-31 โดยไม่แจ้งเตือน
 * คือคำนวณงวดภาษีของเดือนที่ไม่มีอยู่จริง — เป็นบั๊กที่ทำเงินเพี้ยนเงียบ ๆ
 * จึงเพิ่มการตรวจช่วงเดือนให้โยน error แทนการเดา
 */
export function endOfMonth(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error('month must be YYYY-MM');
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) throw new Error(`month out of range: ${month}`);
  return new Date(Date.UTC(year, mon, 1) - 1);
}

/** ยอดรวมในใบเสร็จ (รวม VAT) → { base, vat } — ทางร้านตั้งราคารวม VAT เสมอ จึงต้องแยกย้อนหลัง */
export function splitVatFromGross(gross, vatRate) {
  if (!Number.isFinite(gross) || gross < 0) return { base: 0, vat: 0 };
  const base = vatRate > 0 ? gross / (1 + vatRate) : gross;
  return { base: round2(base), vat: round2(gross - base) };
}

// ────────────────────────────────────────────────────────────────────────────
// 1) VAT รายเดือน — ภ.พ.30 (ภาษีขาย − ภาษีซื้อ ติดลบได้ = งวดนี้ยังไม่ต้องจ่าย/ขอคืนได้)
// ────────────────────────────────────────────────────────────────────────────

/**
 * ภาษีขายฝั่งขายของ ภ.พ.30 — ส่วนภาษีซื้อ (inputVat) ให้ผู้เรียกประกอบเอง
 * @param {{vatRate:number, salesGrossByRate:Record<string,number>}} input
 */
export function computeVatMonthly(input) {
  let salesBase = 0;
  let outputVat = 0;
  let salesWithoutVat = 0;
  for (const [rateStr, gross] of Object.entries(input.salesGrossByRate ?? {})) {
    const g = Number(gross) || 0;
    const r = Number(rateStr) || 0;
    if (r <= 0) {
      salesWithoutVat += g;
      continue;
    }
    const { base, vat } = splitVatFromGross(g, r);
    salesBase += base;
    outputVat += vat;
  }
  return {
    vatRate: input.vatRate,
    salesBase: round2(salesBase),
    outputVat: round2(outputVat),
    salesWithoutVat: round2(salesWithoutVat),
  };
}

/** อัตรา VAT ที่ควรใช้ ณ วันที่กำหนด (วันนี้ถ้าไม่ส่งมา) — 7% จนถึง 30 ก.ย. 2027, หลังจากนั้น 10% */
export function currentVatRate(onDate = new Date()) {
  const d = onDate.toISOString().slice(0, 10);
  return d <= RATES.VAT.REDUCED_UNTIL ? RATES.VAT.REDUCED : RATES.VAT.STANDARD;
}

// ────────────────────────────────────────────────────────────────────────────
// 2) ภาษีเงินได้นิติบุคคล — ภ.ง.ด.50 (SME 0/15/20% หรืออัตรากลาง 20%)
// ────────────────────────────────────────────────────────────────────────────

/** SME = ทุนจดทะเบียน ≤ 5 ล้าน และรายได้รวมทั้งรอบบัญชี ≤ 30 ล้าน (เส้นเท่ายังเป็น SME) */
export function isSme(capitalRegistered, totalRevenue) {
  return capitalRegistered <= RATES.SME_CIT.CAPITAL_CAP && totalRevenue <= RATES.SME_CIT.REVENUE_CAP;
}

/**
 * @param {{netProfit:number, capitalRegistered:number, totalRevenue:number, whtCredits:number}} input
 */
export function computeCit(input) {
  const profit = Math.max(0, Number(input.netProfit) || 0);
  const sme = isSme(input.capitalRegistered, input.totalRevenue);
  const breakdown = [];
  let grossTax = 0;
  if (sme) {
    let prev = 0;
    for (const b of RATES.SME_CIT.BRACKETS) {
      if (profit <= prev) break;
      const base = Math.min(profit, b.upTo) - prev;
      const tax = round2(base * b.rate);
      breakdown.push({ from: prev, to: Math.min(profit, b.upTo), rate: b.rate, base: round2(base), tax });
      grossTax += tax;
      prev = b.upTo;
    }
  } else {
    const tax = round2(profit * RATES.CIT_STANDARD);
    breakdown.push({ from: 0, to: profit, rate: RATES.CIT_STANDARD, base: round2(profit), tax });
    grossTax = tax;
  }
  const whtCredits = Math.max(0, Number(input.whtCredits) || 0);
  const taxDue = Math.max(0, round2(grossTax - whtCredits));
  return {
    isSme: sme,
    netProfit: round2(profit),
    grossTax: round2(grossTax),
    whtCredits: round2(whtCredits),
    taxDue,
    breakdown,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3) ภาษีเงินได้บุคคลธรรมดา — ภ.ง.ด.90/91 (ประมาณการสำหรับเจ้าของธุรกิจ)
//    หมายเหตุ: คำนวณหยาบจากกำไรธุรกิจ − ค่าใช้จ่ายส่วนตัว 60,000 เท่านั้น
//    (ลดหย่อนครอบครัว/ประกัน/กองทุนยังไม่รองรับ — ให้คนตกลงเองตอนยื่นจริง)
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {{totalIncome:number, whtCredits?:number}} input
 */
export function computePit(input) {
  const income = Math.max(0, Number(input.totalIncome) || 0);
  const taxable = Math.max(0, income - RATES.PIT.PERSONAL_ALLOWANCE);
  let grossTax = 0;
  const breakdown = [];
  let prev = 0;
  for (const b of RATES.PIT.BRACKETS) {
    if (taxable <= prev) break;
    const base = Math.min(taxable, b.upTo) - prev;
    const tax = round2(base * b.rate);
    breakdown.push({ from: prev, to: Math.min(taxable, b.upTo), rate: b.rate, base: round2(base), tax });
    grossTax += tax;
    prev = b.upTo;
  }
  const whtCredits = Math.max(0, Number(input.whtCredits) || 0);
  return {
    totalIncome: round2(income),
    taxable: round2(taxable),
    grossTax: round2(grossTax),
    whtCredits: round2(whtCredits),
    taxDue: Math.max(0, round2(grossTax - whtCredits)),
    breakdown,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4) ปฏิทินยื่น-จ่าย — กำหนดสำคัญของธุรกิจ (กติกาเดียวกันทุกปี; e-filing เลื่อนได้อีก 8 วิ)
// ────────────────────────────────────────────────────────────────────────────

function thMonthYear(d) {
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

/** วันสุดท้ายของเดือนถัดไปแบบเว้นวันที่ 15 (ภ.พ.30 ยื่นภายในวันที่ 15 ของเดือนถัดไป) */
function midNextMonth(from) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 15));
}

/** วันที่ 7 ของเดือนถัดไป (ภ.ง.ด.3 ยื่นภายในวันที่ 7 ของเดือนถัดไป — e-filing +8 วิ) */
function seventhNextMonth(from) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 7));
}

/** ภ.ง.ด.50 — ยื่นภายใน 150 วันนับจากวันปิดรอบบัญชี */
function plusDays(from, days) {
  return new Date(from.getTime() + days * 86_400_000);
}

/**
 * ปฏิทินภาษีที่ต้องติดตามของธุรกิจ
 * @param {Date} [now]
 * @param {string} [fiscalYearEnd] วันปิดรอบบัญชี (YYYY-MM-DD) ปกติใช้ 31 ธ.ค.
 * @returns {Array<{key:string,label:string,due:string,periodLabel:string}>}
 */
export function taxCalendar(now = new Date(), fiscalYearEnd) {
  const out = [];
  const today = now.toISOString().slice(0, 10);

  // ภ.พ.30 — VAT งวดเดือนก่อน: ยื่นภายในวันที่ 15 ของเดือนนี้ (ถ้าผ่านแล้ว = งวดเดือนนี้ ต้นเดือนหน้า)
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const vatDue = midNextMonth(prevMonth);
  const vatPeriod = vatDue.toISOString().slice(0, 10) > today ? prevMonth : now;
  out.push({
    key: 'PP30',
    label: 'ภ.พ.30 — VAT รายเดือน (ยื่นภายในวันที่ 15 ของเดือนถัดไป)',
    due: midNextMonth(vatPeriod).toISOString().slice(0, 10),
    periodLabel: thMonthYear(vatPeriod),
  });

  // ภ.ง.ด.3 — หัก ณ ที่จ่ายงวดเดือนก่อน: ยื่นภายในวันที่ 7 ของเดือนนี้ (e-filing +8 วิ)
  const whtPeriod = seventhNextMonth(prevMonth).toISOString().slice(0, 10) > today ? prevMonth : now;
  out.push({
    key: 'PND3',
    label: 'ภ.ง.ด.3 — หัก ณ ที่จ่าย (ยื่นภายในวันที่ 7 ของเดือนถัดไป / e-filing +8 วัน)',
    due: seventhNextMonth(whtPeriod).toISOString().slice(0, 10),
    periodLabel: thMonthYear(whtPeriod),
  });

  // ภ.ง.ด.50 — รายปี: 150 วันหลังปิดรอบบัญชี (default 31 ธ.ค.)
  const fyEnd = fiscalYearEnd ? new Date(`${fiscalYearEnd}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  out.push({
    key: 'PND50',
    label: 'ภ.ง.ด.50 — ภาษีเงินได้นิติบุคคลรายปี (ยื่นภายใน 150 วันหลังปิดรอบบัญชี)',
    due: plusDays(fyEnd, 150).toISOString().slice(0, 10),
    periodLabel: thMonthYear(fyEnd),
  });

  // ภ.ง.ด.51 — ครึ่งปี: ภายใน 2 เดือนหลังปิดครึ่งรอบบัญชี (default 30 มิ.ย. → 31 ส.ค.)
  const h1End = new Date(Date.UTC(now.getUTCFullYear(), 5, 30));
  out.push({
    key: 'PND51',
    label: 'ภ.ง.ด.51 — ภาษีนิติบุคคลครึ่งปี (ยื่นภายใน 2 เดือนหลังปิดครึ่งรอบบัญชี)',
    due: new Date(Date.UTC(h1End.getUTCFullYear(), h1End.getUTCMonth() + 3, 0)).toISOString().slice(0, 10),
    periodLabel: thMonthYear(h1End),
  });

  // ภ.ง.ด.90 — บุคคลธรรมดา: ยื่นภายใน 31 มี.ค. ของปีถัดไป
  out.push({
    key: 'PND90',
    label: 'ภ.ง.ด.90/91 — ภาษีเงินได้บุคคลธรรมดา (ยื่นภายใน 31 มี.ค. ของปีถัดไป)',
    due: `${now.getUTCFullYear() + 1}-03-31`,
    periodLabel: thMonthYear(new Date(Date.UTC(now.getUTCFullYear(), 11, 31))),
  });

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 5) ประกอบทุกอย่างจากข้อมูลจริงของธุรกิจ — เรียกครั้งเดียวได้ครบทุกงวด
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   vatRate:number,
 *   salesPayments:Array<{amount:number,vatRate:number,paidAt:Date|string}>,
 *   ledger:Array<{type:string,category:string,amount:number,vatAmount:number,whtAmount:number,createdAt:Date|string}>,
 *   capitalRegistered?:number, fiscalYearEnd?:string, month?:string, now?:Date,
 * }} input
 */
export function businessTaxOverview(input) {
  const now = input.now ?? new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const inThisYear = (d) => d >= yearStart && d <= now;

  // VAT งวดเดือนนี้ + เดือนก่อน (จาก payments — ยอด "รวม VAT" แยกเป็น base + VAT ด้วยอัตราของแต่ละรายการ)
  const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  const grossByRate = (month) => {
    const acc = {};
    for (const p of input.salesPayments) {
      if (monthKey(p.paidAt) === month) acc[String(p.vatRate)] = (acc[String(p.vatRate)] ?? 0) + (p.amount || 0);
    }
    return acc;
  };

  // ภาษีซื้อของเดือนนี้ = VAT จากรายจ่ายใน ledger ที่บันทึก vatAmount ไว้
  const monthLedger = (month) => input.ledger.filter((l) => monthKey(l.createdAt) === month);
  const inputVat = (month) => round2(monthLedger(month).filter((l) => l.type === 'EXPENSE').reduce((s, l) => s + (l.vatAmount || 0), 0));

  // เลือกงวดย้อนหลัง: anchor ของภาษีขาย/ซื้อ = ปลายเดือนที่เลือก (ค่าเริ่ม = วันนี้)
  const vatAnchor = input.month ? endOfMonth(input.month) : now;
  const thisMonth = monthKey(vatAnchor);
  const prevMonth = monthKey(new Date(Date.UTC(vatAnchor.getUTCFullYear(), vatAnchor.getUTCMonth() - 1, 1)));

  const vatThis = computeVatMonthly({ vatRate: input.vatRate, salesGrossByRate: grossByRate(thisMonth) });
  const vatPrev = computeVatMonthly({ vatRate: input.vatRate, salesGrossByRate: grossByRate(prevMonth) });
  const inputVatThis = inputVat(thisMonth);

  // รายได้/รายจ่าย/กำไร รายปี (จาก ledger — ปีนี้)
  const yearRows = input.ledger.filter((l) => inThisYear(l.createdAt));
  const income = round2(yearRows.filter((l) => l.type === 'INCOME').reduce((s, l) => s + l.amount, 0));
  const expense = round2(yearRows.filter((l) => l.type === 'EXPENSE').reduce((s, l) => s + l.amount, 0));
  const incomeVat = round2(yearRows.filter((l) => l.type === 'INCOME').reduce((s, l) => s + (l.vatAmount || 0), 0));
  const expenseVat = round2(yearRows.filter((l) => l.type === 'EXPENSE').reduce((s, l) => s + (l.vatAmount || 0), 0));
  const whtIncome = round2(yearRows.filter((l) => l.type === 'INCOME').reduce((s, l) => s + (l.whtAmount || 0), 0));
  const whtExpense = round2(yearRows.filter((l) => l.type === 'EXPENSE').reduce((s, l) => s + (l.whtAmount || 0), 0));

  // ฐานกำไรก่อนภาษี = กำไร ledger − VAT ที่เบิกจ่ายไปแล้ว (VAT ไม่ใช่รายได้/รายจ่ายของกิจการ)
  const netProfitBeforeTax = round2(income - incomeVat - (expense - expenseVat));

  const capital = input.capitalRegistered ?? 0;
  const cit = computeCit({ netProfit: netProfitBeforeTax, capitalRegistered: capital, totalRevenue: income, whtCredits: whtIncome });

  const pit = computePit({ totalIncome: netProfitBeforeTax, whtCredits: 0 });

  return {
    asOf: now.toISOString(),
    vatRate: input.vatRate,
    currentVatRate: currentVatRate(now),
    vat: {
      thisMonth: { ...vatThis, inputVat: inputVatThis, netVat: round2(vatThis.outputVat - inputVatThis) },
      lastMonth: vatPrev,
    },
    year: {
      income,
      incomeVat,
      expense,
      expenseVat,
      wht: { received: whtIncome, paid: whtExpense },
      netProfitBeforeTax,
    },
    cit,
    pit,
    calendar: taxCalendar(now, input.fiscalYearEnd),
  };
}