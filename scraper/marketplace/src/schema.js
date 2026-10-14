// schema.js — one order shape for every marketplace.
//
// Shopee and Lazada call the same thing different names and split the tax across
// different fields. Normalising here means tax.js and stock.js never have to
// know which platform an order came from.
//
// Money is stored in satang (integer). Thai platforms think in satang and floats
// lose satang: 99.10 * 100 = 9909.999999999998. Never do arithmetic on floats.

export const CHANNELS = ['SHOPEE', 'LAZADA', 'POS', 'OTHER'];

/** Order line statuses that mean the sale is real and should move stock. */
export const COUNTED_STATUSES = new Set([
  'READY_TO_SHIP', // Shopee: ชำระแล้ว รอจัดส่ง
  'TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'DONE',
  'TO_SHIP', // Lazada
  'DELIVERED',
  'CANCELLED' // handled separately
]);

export function makeOrder(input) {
  const channel = String(input.channel || 'OTHER').toUpperCase();
  if (!CHANNELS.includes(channel)) {
    throw new Error(`Unknown channel: ${channel}`);
  }

  const order = {
    channel,
    orderNo: require_(input.orderNo, 'orderNo'),
    orderDate: input.orderDate || new Date().toISOString(),
    status: String(input.status || 'PENDING').toUpperCase(),

    customer: {
      name: input.customerName || '(ไม่ระบุ)',
      phone: input.customerPhone || null,
      address: input.customerAddress || null,
      // Marketplace orders are usually logged out — only the courier sees the
      // address. Keep it so packing slips work, never for analytics.
      platformBuyerId: input.platformBuyerId || null
    },

    currency: 'THB',
    // Gross = what the buyer paid including shipping and platform fees.
    grossSatang: toSatang(input.gross ?? input.itemSubtotal ?? 0),
    shippingSatang: toSatang(input.shipping ?? 0),
    platformFeeSatang: toSatang(input.platformFee ?? 0),
    voucherSellerSatang: toSatang(input.voucherSeller ?? 0),
    voucherPlatformSatang: toSatang(input.voucherPlatform ?? 0),
    // Lazada and Shopee both discount. Who paid decides whether we may claim it.
    // seller-funded = we gave it away (reduces revenue); platform-funded = theirs.
    discountSatang: toSatang(input.discountSeller ?? 0),
    discountPlatformSatang: toSatang(input.discountPlatform ?? 0),

    // Filled by tax.js
    itemSubtotalSatang: toSatang(input.itemSubtotal ?? 0),
    taxSatang: 0,
    vatRate: Number.isFinite(input.vatRate) ? input.vatRate : 0.07,
    taxBreakdown: null,

    // Filled by stock.js
    stockApplied: false,
    stockLines: [],
    warnings: [],

    lines: (input.lines || []).map((l) => ({
      sku: l.sku || null,
      name: l.name || '(ไม่ระบุสินค้า)',
      qty: Math.max(1, parseInt(l.qty, 10) || 1),
      unitPriceSatang: toSatang(l.unitPrice ?? 0),
      unitCostSatang: toSatang(l.unitCost ?? 0),
      // Unknown cost is worse than a stated zero: profit maths stays honest.
      costKnown: Boolean(l.costKnown)
    })),

    raw: input.raw || null
  };

  if (order.lines.length === 0) {
    order.warnings.push('ไม่มีรายการสินค้าในออเดอร์');
  }
  return order;
}

function require_(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field: ${name}`);
  }
  return String(value);
}

/** Accepts 1234.56 or "1234.56" and returns satang. Input must not be NaN. */
export function toSatang(value) {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s฿]/g, '')) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function toBaht(satang) {
  return satang / 100;
}

/** Is this status final enough to count as revenue and move stock? */
export function isCounted(status) {
  return COUNTED_STATUSES.has(String(status).toUpperCase());
}

export function isCancelled(status) {
  const s = String(status).toUpperCase();
  return s === 'CANCELLED' || s === 'CANCELED' || s === 'RETURNED';
}