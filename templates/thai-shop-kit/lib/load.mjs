// lib/load.mjs — อ่านไฟล์ CSV ของแม่แบบ → ข้อมูลที่คำนวณภาษี/สต็อกรับได้ตรง ๆ
//
// ไม่พึ่ง dependency ใด ๆ (ไม่ใช้ไลบรารี CSV) · รองรับ BOM, CRLF, เครื่องหมายคำพูด,
// คอมมาที่อยู่ในช่อง, และหัวคอลัมน์ภาษาไทย
//
// กติกาสำคัญ: ข้อมูลที่อ่านไม่ถูกต้องจะถูก "ข้าม" ไม่ใช่โยน error และจะถูกนับไว้ใน
// `skipped` เสมอ เพื่อให้เจ้าของร้านเห็นว่ามีบรรทัดไหนหายไป ไม่ใช่ได้ตัวเลขมั่ว

// ─────────────────────────────────────────────────────────────
// แยก CSV (RFC 4180 แบบย่อ)
// ─────────────────────────────────────────────────────────────

/** แปลงข้อความ CSV เป็นอาร์เรย์ของอาร์เรย์ (ตัด BOM, รองรับ CRLF และช่องที่หุ้มด้วย ") */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** แถวแรกคือหัวตาราง → ออกเป็นออบเจกต์ โดยตัดช่องว่างและทิ้งแถวที่ว่างทั้งหมด */
export function toRecords(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => String(c).trim() !== ''))
    .map((cells) => {
      const record = {};
      header.forEach((h, i) => {
        record[h] = String(cells[i] ?? '').trim();
      });
      return record;
    });
}

// ─────────────────────────────────────────────────────────────
// แปลงค่าแต่ละชนิด — คืน null เมื่ออ่านไม่ได้ (ไม่เดา ไม่ใส่ 0 แทน)
// ─────────────────────────────────────────────────────────────

/** จำนวนเงิน: ตัด ฿ และลูกน้ำออก เช่น "฿1,234.50" → 1234.5 · คืน null ถ้าไม่ใช่ตัวเลข */
export function parseAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[฿,\s]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** วันที่แบบ ISO เท่านั้น (YYYY-MM-DD) — คืน Date เมื่อเป็นวันที่จริง, คืน null เมื่อมีวันที่ไม่มีอยู่จริง */
export function parseIsoDate(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? '').trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  // กัน 2026-02-30 ซึ่ง Date จะเลื่อนไปเป็นมีนาคมโดยเงียบ ๆ
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** รับได้ทั้งภาษาอังกฤษและไทย: INCOME/รายรับ → INCOME, EXPENSE/รายจ่าย → EXPENSE */
const TYPE_ALIASES = new Map([
  ['INCOME', 'INCOME'],
  ['รายรับ', 'INCOME'],
  ['EXPENSE', 'EXPENSE'],
  ['รายจ่าย', 'EXPENSE'],
]);

function normalizeType(raw) {
  const key = String(raw ?? '').trim().toUpperCase();
  return TYPE_ALIASES.get(key) ?? null;
}

/** อ่านค่าหัวคอลัมน์จากหลายชื่อที่เขียนได้ (แนะนำให้เจ้าของร้านแก้ชื่อคอลัมน์เองได้) */
function pick(record, aliases) {
  for (const alias of aliases) {
    if (record[alias] != null && record[alias] !== '') return record[alias];
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// บัญชีรายรับ-รายจ่าย → รูปแบบที่ businessTaxOverview() รับ
// ─────────────────────────────────────────────────────────────

/**
 * @returns {{rows:Array<object>, skipped:number}} — rows พร้อมส่งเข้า businessTaxOverview ทันที
 */
export function readLedgerCsv(text) {
  const rows = [];
  let skipped = 0;
  for (const rec of toRecords(parseCsv(text))) {
    const type = normalizeType(pick(rec, ['ประเภท', 'type']));
    const createdAt = parseIsoDate(pick(rec, ['วันที่', 'createdAt', 'date']));
    const amount = parseAmount(pick(rec, ['จำนวนเงิน', 'amount']));
    if (!type || !createdAt || amount === null) {
      skipped += 1;
      continue;
    }
    rows.push({
      type,
      category: pick(rec, ['หมวด', 'category']) || 'OTHER',
      amount,
      vatAmount: parseAmount(pick(rec, ['ภาษี VAT', 'vatAmount', 'vat'])) ?? 0,
      whtAmount: parseAmount(pick(rec, ['หัก ณ ที่จ่าย', 'whtAmount', 'wht'])) ?? 0,
      createdAt,
      note: pick(rec, ['หมายเหตุ', 'note']),
    });
  }
  return { rows, skipped };
}

// ─────────────────────────────────────────────────────────────
// สต็อก → สถานะที่พร้อมใช้ (เติมเต็ม/หมดอายุ/ของเหลือน้อย) ให้ทันที
// ─────────────────────────────────────────────────────────────

import { INVENTORY_CATEGORIES, computeExpiryDate, computeExpiryStatus, computeStockStatus, isCategoryValid } from './inventory.mjs';

/**
 * อ่านสต็อกแล้วติดสถานะให้เลย: วันหมดอายุ (คำนวณจากอายุการเก็บ) + เข้ม/หมดอายุ + ของเหลือน้อย
 * @returns {{rows:Array<object>, skipped:number}}
 */
export function readInventoryCsv(text, now = new Date()) {
  const rows = [];
  let skipped = 0;
  for (const rec of toRecords(parseCsv(text))) {
    const category = pick(rec, ['หมวด', 'category']).toUpperCase();
    const name = pick(rec, ['ชื่อสินค้า', 'name']);
    const quantity = parseAmount(pick(rec, ['จำนวน', 'quantity']));
    if (!name || quantity === null || !isCategoryValid(category)) {
      skipped += 1;
      continue;
    }
    const shelfLifeDays = parseAmount(pick(rec, ['อายุเก็บ (วัน)', 'อายุการเก็บ (วัน)', 'shelfLifeDays']));
    const purchasedAt = parseIsoDate(pick(rec, ['วันที่ซื้อ', 'purchasedAt', 'วันที่']));
    const minimumStock = parseAmount(pick(rec, ['ขั้นต่ำ', 'minimumStock', 'ขั้นต่ำสต็อก']));
    // วันหมดอายุคำนวณจาก "วันที่ซื้อ + อายุการเก็บ" ถ้ามีวันที่ซื้อ; ไม่มีก็นับจากวันอ้างอิง
    const anchor = purchasedAt ?? now;
    const expiryDate = computeExpiryDate(shelfLifeDays, anchor);
    rows.push({
      code: pick(rec, ['รหัส', 'code', 'sku']),
      name,
      category,
      quantity,
      minimumStock: minimumStock === null ? null : minimumStock,
      shelfLifeDays: shelfLifeDays === null ? null : shelfLifeDays,
      purchasedAt,
      expiryDate,
      expiry: computeExpiryStatus(expiryDate, now),
      stock: computeStockStatus(quantity, minimumStock),
    });
  }
  return { rows, skipped };
}

/** หมวดที่ใช้ได้ทั้งหมด (สะดวกตอนสร้างไฟล์ CSV ใหม่) */
export { INVENTORY_CATEGORIES };