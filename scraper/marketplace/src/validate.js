// validate.js — catch a changed CSV before it silently imports wrong numbers.
//
// Both platforms rename and reorder export columns without warning. The failure
// is quiet: the parser finds no "Order Amount", so gross comes out 0, and the
// import "succeeds" with zero revenue. Nobody notices until the month closes.
//
// This module compares the actual header against what each parser needs, and
// reports exactly which columns are missing. Missing columns are warnings, not
// errors — a partial export is still worth importing — except for the ones the
// parser cannot work without.

import { parseCsv } from './parsers/csv.js';

/** Columns a parser cannot do without, grouped by what breaks when absent. */
export const REQUIRED = {
  shopee: [
    { key: 'orderNo', label: 'เลขที่คำสั่งซื้อ', breaks: 'ไม่มีข้อมูลอะไรนำเข้าได้', aliases: ['order id', 'order no', 'เลขที่คำสั่งซื้อ'] }
  ],
  lazada: [
    { key: 'orderNo', label: 'เลขที่คำสั่งซื้อ', breaks: 'ไม่มีข้อมูลอะไรนำเข้าได้', aliases: ['order number', 'order no', 'order id', 'เลขที่คำสั่งซื้อ'] }
  ]
};

/** Missing these silently zeroes money or stock. */
export const IMPORTANT = {
  shopee: [
    { key: 'gross', label: 'ยอดที่ลูกค้าจ่าย', aliases: ['order amount', 'total amount', 'amount', 'ยอดรวมคำสั่งซื้อ'] },
    { key: 'quantity', label: 'จำนวนสินค้า', aliases: ['quantity', 'qty', 'จำนวน'] },
    { key: 'sku', label: 'SKU ผู้ขาย', aliases: ['sku', 'seller sku', 'sku ผู้ขาย', 'model sku', 'model item id'] }
  ],
  lazada: [
    { key: 'gross', label: 'ยอดที่ลูกค้าจ่าย', aliases: ['order amount', 'total amount', 'order total', 'ยอดรวม'] },
    { key: 'quantity', label: 'จำนวนสินค้า', aliases: ['quantity', 'qty', 'จำนวน'] },
    { key: 'sku', label: 'SKU ผู้ขาย', aliases: ['sku', 'seller sku', 'sku ผู้ขาย', 'item sku'] }
  ]
};

function normalise(s) {
  return String(s).toLowerCase().replace(/[\s_\-.]/g, '');
}

function headerSet(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  return rows[0].map((h) => String(h).trim());
}

function findColumn(headers, aliases) {
  const wanted = aliases.map(normalise);
  return headers.find((h) => wanted.includes(normalise(h))) || null;
}

/**
 * @returns {{
 *   ok: boolean,
 *   channel: string,
 *   encoding?: string,
 *   headers: string[],
 *   missingRequired: Array, missingImportant: Array,
 *   unmapped: string[],
 *   message: string
 * }}
 */
export function validateCsv(text, channel, encoding = 'utf-8') {
  const ch = String(channel).toLowerCase();
  const headers = headerSet(text);

  if (!headers.length) {
    return {
      ok: false, channel: ch, encoding, headers: [],
      missingRequired: [], missingImportant: [], unmapped: [],
      message: 'ไฟล์ว่าง หรืออ่านหัวตารางไม่ได้'
    };
  }

  const missingRequired = [];
  const missingImportant = [];

  for (const spec of REQUIRED[ch] || []) {
    if (!findColumn(headers, spec.aliases)) missingRequired.push(spec);
  }
  for (const spec of IMPORTANT[ch] || []) {
    if (!findColumn(headers, spec.aliases)) missingImportant.push(spec);
  }

  // Anything the parser has no use for — usually clutter, worth showing so the
  // user can tell "harmless extra column" from "renamed something important".
  const known = new Set(
    [...(REQUIRED[ch] || []), ...(IMPORTANT[ch] || [])].flatMap((s) =>
      s.aliases.map(normalise)
    )
  );
  const unmapped = headers.filter((h) => !known.has(normalise(h)));

  const mojibake = /[\uFFFD]/.test(text) || encoding.includes('�');

  const parts = [];
  if (missingRequired.length) {
    parts.push(`ขาดคอลัมน์จำเป็น: ${missingRequired.map((m) => m.label).join(', ')}`);
  }
  if (missingImportant.length) {
    parts.push(`ขาดคอลัมน์ที่ควรมี: ${missingImportant.map((m) => m.label).join(', ')} (ตัวเลขที่เกี่ยวข้องจะเป็น 0)`);
  }
  if (mojibake) {
    parts.push('พบอักขระเพี้ยนในไฟล์ — encoding อาจไม่ใช่ UTF-8 หรือ Windows-874');
  }

  return {
    ok: missingRequired.length === 0,
    channel: ch,
    encoding,
    headers,
    missingRequired,
    missingImportant,
    unmapped,
    message: parts.length ? parts.join(' · ') : 'โครงสร้างไฟล์ตรงตามที่คาดไว้'
  };
}

/** Throw with an actionable message when the file cannot be imported at all. */
export function assertImportable(text, channel, encoding) {
  const v = validateCsv(text, channel, encoding);
  if (!v.ok) {
    throw new Error(
      `โครงสร้างไฟล์ไม่ถูกต้อง — ${v.message}\n` +
      `คอลัมน์ที่พบ: ${v.headers.join(' | ') || '(ไม่มี)'}`
    );
  }
  return v;
}