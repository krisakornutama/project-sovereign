// parsers/lazada.js — Lazada order export.
//
// Lazada also exports one item per row. Two things differ from Shopee and both
// bite if ignored:
//
//   1. "Order Amount" on Lazada is what the buyer paid EXCLUDING platform-funded
//      discounts in some exports. If the number looks like the subtotal and the
//      payable differs, the discount has to come back out.
//   2. Lazada's "Seller Discount" and "Fees" columns are the same idea under
//      different names, and the fee can be quoted VAT-inclusive or exclusive.
//
// Everything is folded per order number for the same reason as Shopee.

import { parseCsv, toObjects, pick, num } from './csv.js';
import { makeOrder } from '../schema.js';
import { normaliseDate } from './shopee.js';

const STATUS_MAP = {
  'รอจัดส่ง': 'TO_SHIP',
  TOSHIP: 'TO_SHIP',
  'พร้อมจัดส่ง': 'READY_TO_SHIP',
  READYTOSHIP: 'READY_TO_SHIP',
  'กำลังจัดส่ง': 'IN_TRANSIT',
  INTRANSIT: 'IN_TRANSIT',
  'จัดส่งแล้ว': 'SHIPPED',
  SHIPPED: 'SHIPPED',
  'สำเร็จ': 'DELIVERED',
  DELIVERED: 'DELIVERED',
  'ยกเลิก': 'CANCELLED',
  CANCELLED: 'CANCELLED',
  'คืนสินค้า': 'RETURNED',
  RETURNED: 'RETURNED'
};

function mapStatus(raw) {
  if (!raw) return 'PENDING';
  const key = String(raw).trim().toUpperCase();
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k) || String(raw).includes(k)) return v;
  }
  return 'PENDING';
}

export function parseLazadaCsv(text) {
  return parseLazadaObjects(toObjects(parseCsv(text)));
}

export function parseLazadaObjects(rows) {
  const byOrder = new Map();

  for (const row of rows) {
    const orderNo = pick(row, 'Order Number', 'Order No', 'เลขที่คำสั่งซื้อ', 'Order ID');
    if (!orderNo) continue;

    let entry = byOrder.get(orderNo);
    if (!entry) {
      entry = {
        orderNo,
        orderDate: normaliseDate(pick(row, 'Order Date', 'Created At', 'วันที่สั่งซื้อ')),
        status: mapStatus(pick(row, 'Status', 'สถานะ')),
        customerName: pick(row, 'Buyer Name', 'Customer Name', 'ชื่อผู้ซื้อ', 'Recipient') || '(ไม่ระบุ)',
        customerPhone: pick(row, 'Phone', 'Buyer Phone', 'เบอร์โทร'),
        customerAddress: pick(row, 'Address', 'Shipping Address', 'ที่อยู่จัดส่ง'),
        platformBuyerId: pick(row, 'Buyer ID', 'Buyer Username'),
        gross: 0,
        shipping: 0,
        platformFee: 0,
        voucherSeller: 0,
        voucherPlatform: 0,
        discountSeller: 0,
        discountPlatform: 0,
        lines: []
      };
      byOrder.set(orderNo, entry);
    }

    // "Order Amount" is repeated per row — take the largest, never sum.
    const gross = num(pick(row, 'Order Amount', 'Total Amount', 'Order Total', 'ยอดรวม'));
    if (gross > entry.gross) entry.gross = gross;

    const shipping = num(pick(row, 'Shipping Fee', 'Shipping Cost', 'ค่าจัดส่ง', 'ค่าส่ง'));
    if (shipping > entry.shipping) entry.shipping = shipping;

    // Lazada splits the platform cut into several columns. Take whichever the
    // export actually provides rather than assuming one name.
    const fee = num(
      pick(row, 'Fees', 'Commission Fee', 'Platform Fee', 'ค่าธรรมเนียม', 'Lazada Fee') ??
      (num(pick(row, 'Seller Transaction Fee')) + num(pick(row, 'Payment Fee')))
    );
    if (fee > entry.platformFee) entry.platformFee = fee;

    const sellerDiscount = num(
      pick(row, 'Seller Discount', 'Voucher by Seller', 'ส่วนลดจากผู้ขาย', 'คูปองผู้ขาย')
    );
    if (sellerDiscount > entry.voucherSeller) entry.voucherSeller = sellerDiscount;

    const platformDiscount = num(
      pick(row, 'Platform Discount', 'Voucher by Lazada', 'ส่วนลดจากแพลตฟอร์ม', 'คูปองแพลตฟอร์ม')
    );
    if (platformDiscount > entry.discountPlatform) entry.discountPlatform = platformDiscount;

    const sku = pick(row, 'SKU', 'Seller SKU', 'SKU ผู้ขาย') || pick(row, 'Item SKU');
    const qty = Math.max(1, num(pick(row, 'Quantity', 'Qty', 'จำนวน')) || 1);
    const unitPrice = num(
      pick(row, 'Unit Price', 'Price', 'ราคาต่อหน่วย', 'Selling Price') ??
        (qty > 0 ? entry.gross / qty : 0)
    );

    entry.lines.push({
      sku: sku || null,
      name: pick(row, 'Product Name', 'Item Name', 'ชื่อสินค้า') || sku || '(ไม่ระบุสินค้า)',
      qty,
      unitPrice,
      costKnown: false
    });
  }

  // Stamp the channel here rather than trusting the caller — see shopee.js.
  return [...byOrder.values()].map((o) => makeOrder({ ...o, channel: 'LAZADA' }));
}