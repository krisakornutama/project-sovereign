// parsers/shopee.js — Shopee order export.
//
// Shopee's seller centre CSV puts one PRODUCT PER ROW, not one order per row.
// The same order number repeats across rows, so the parser has to fold those
// into a single order. Getting this wrong double-counts revenue.
//
// Column names differ between the "Order" and "Order Items" exports, so several
// aliases are accepted for each.

import { parseCsv, toObjects, pick, num } from './csv.js';
import { makeOrder } from '../schema.js';

const STATUS_MAP = {
  'พร้อมจัดส่ง': 'READY_TO_SHIP',
  READYTOSHIP: 'READY_TO_SHIP',
  'พร้อมส่ง': 'TO_SHIP',
  TOSHIP: 'TO_SHIP',
  'กำลังจัดส่ง': 'IN_TRANSIT',
  INTRANSIT: 'IN_TRANSIT',
  'จัดส่งแล้ว': 'SHIPPED',
  SHIPPED: 'SHIPPED',
  'สำเร็จ': 'DELIVERED',
  DELIVERED: 'DELIVERED',
  'ยกเลิก': 'CANCELLED',
  CANCELLED: 'CANCELLED',
  CANCELLEDBYBUYER: 'CANCELLED',
  'คืนสินค้า': 'RETURNED',
  RETURNED: 'RETURNED'
};

function mapStatus(raw) {
  if (!raw) return 'PENDING';
  const key = String(raw).trim().toUpperCase();
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  // Tolerate "พร้อมจัดส่ง (Ready to ship)" and similar decorated labels.
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k) || String(raw).includes(k)) return v;
  }
  return 'PENDING';
}

export function parseShopeeCsv(text) {
  return parseShopeeObjects(toObjects(parseCsv(text)));
}

export function parseShopeeObjects(rows) {
  /** orderNo -> order under construction */
  const byOrder = new Map();

  for (const row of rows) {
    const orderNo = pick(row, 'Order ID', 'Order ID เลขที่คำสั่งซื้อ', 'เลขที่คำสั่งซื้อ', 'Order No');
    if (!orderNo) continue;

    let entry = byOrder.get(orderNo);
    if (!entry) {
      entry = {
        orderNo,
        orderDate: normaliseDate(pick(row, 'Order Time', 'เวลาสั่งซื้อ', 'Payment Time', 'Create Time')),
        status: mapStatus(pick(row, 'Status', 'สถานะ')),
        customerName: pick(row, 'Buyer Username', 'ชื่อผู้ซื้อ', 'Recipient Name', 'Buyer Name') || '(ไม่ระบุ)',
        customerPhone: pick(row, 'Buyer Phone', 'เบอร์โทรผู้ซื้อ', 'Phone'),
        customerAddress: pick(row, 'Shipping Address', 'ที่อยู่จัดส่ง'),
        platformBuyerId: pick(row, 'Buyer ID', 'Buyer Username'),
        gross: 0,
        shipping: num(pick(row, 'Shipping Fee', 'ค่าจัดส่ง', 'ราคาค่าจัดส่ง')),
        platformFee: 0,
        voucherSeller: 0,
        voucherPlatform: 0,
        discountSeller: 0,
        discountPlatform: 0,
        lines: []
      };
      byOrder.set(orderNo, entry);
    }

    // Totals are repeated on every row of the order. Take the first non-zero
    // value rather than summing, or an order with 5 lines counts 5×.
    const gross = num(pick(row, 'Order Amount', 'ยอดรวมคำสั่งซื้อ', 'Total Amount', 'Amount'));
    if (gross > entry.gross) entry.gross = gross;

    const fee = num(pick(row, 'Shopee Fee', 'ค่าธรรมเนียม', 'Commission Fee', 'ค่าบริการ'));
    if (fee > entry.platformFee) entry.platformFee = fee;

    const sellerVoucher = num(pick(row, 'Seller Voucher', 'ส่วนลดจากผู้ขาย', 'คูปองผู้ขาย'));
    if (sellerVoucher > entry.voucherSeller) entry.voucherSeller = sellerVoucher;

    const platformVoucher = num(pick(row, 'Shopee Voucher', 'ส่วนลดจากแพลตฟอร์ม', 'คูปองแพลตฟอร์ม'));
    if (platformVoucher > entry.voucherPlatform) entry.voucherPlatform = platformVoucher;

    // Shipping lives on the order header, repeated per row — same rule.
    const shipping = num(pick(row, 'Shipping Fee', 'ค่าจัดส่ง', 'ราคาค่าจัดส่ง'));
    if (shipping > entry.shipping) entry.shipping = shipping;

    const sku = pick(row, 'SKU', 'Seller SKU', 'SKU ผู้ขาย') || pick(row, 'Model Item ID', 'Model SKU');
    const qty = Math.max(1, num(pick(row, 'Quantity', 'จำนวน', 'Qty')) || 1);
    const unitPrice = num(
      pick(row, 'Unit Price', 'ราคาต่อหน่วย', 'Price', 'Original Price') ??
        (qty > 0 ? entry.gross / qty : 0)
    );

    if (!sku) {
      entry.lines.push({
        sku: null,
        name: pick(row, 'Product Name', 'ชื่อสินค้า') || '(ไม่ระบุสินค้า)',
        qty,
        unitPrice,
        costKnown: false
      });
    } else {
      entry.lines.push({ sku, name: pick(row, 'Product Name', 'ชื่อสินค้า') || sku, qty, unitPrice, costKnown: false });
    }
  }

  // Stamp the channel here. Relying on the caller to pass it means a missed
    // argument silently files a Shopee order under OTHER.
    return [...byOrder.values()].map((o) => makeOrder({ ...o, channel: 'SHOPEE' }));
}

/** Shopee mixes "2026-10-14 15:30:00" and ISO. Keep it sortable. */
export function normaliseDate(raw) {
  if (!raw) return new Date().toISOString();
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}