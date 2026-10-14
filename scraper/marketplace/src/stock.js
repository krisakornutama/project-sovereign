// stock.js — move stock when an order is real.
//
// Rules that matter, learned the hard way:
//
//  1. Idempotent. Re-importing the same file must not deduct twice. Every
//     application is keyed on (channel, orderNo, sku) and recorded in the DB.
//  2. Cancelled restores. A cancellation is an explicit reversal, not "ignore".
//  3. Unknown SKU is a warning, not a failure. The order still imported — losing
//     a sale because we mistyped a SKU is worse than an unmatched line.
//  4. Never go negative silently. Stock is allowed to hit 0 and the oversell is
//     reported, because in reality you already sold it.

import { isCancelled, isReturn, isReversal, isCounted } from './schema.js';

export const OVERSELL_POLICY = {
  ALLOW_AND_REPORT: 'allow-and-report',
  BLOCK: 'block'
};

/**
 * @param {object} order    after computeTax()
 * @param {object} options
 *   stock:     { sku -> { sku, name, onHand, reserved, costSatang } }
 *   applied:   Set of "CHANNEL|ORDERNO|SKU" already deducted
 *   restored:  Set of already-restored lines
 *   policy:    OVERSELL_POLICY
 */
export function applyStock(order, { stock = new Map(), applied = new Set(), restored = new Set(), policy = OVERSELL_POLICY.ALLOW_AND_REPORT } = {}) {
  const lines = [];
  const key = (l) => `${order.channel}|${order.orderNo}|${l.sku ?? l.name}`;

  if (isReversal(order.status)) {
    // Both a cancel and a return put the goods back on the shelf. What differs
    // is the accounting, and that lives in tax.js — here it is only the count
    // that matters. isReturn() is checked so a RETURN_REFUND status cannot fall
    // through to the "not counted yet" branch and leave stock stuck down.
    const wasCancelled = isCancelled(order.status);
    for (const line of order.lines) {
      const k = key(line);
      const entry = stock.get(line.sku);
      const already = restored.has(k);
      if (!already && entry) {
        entry.onHand += line.qty;
        restored.add(k);
      }
      lines.push({
        sku: line.sku,
        qty: line.qty,
        action: already ? 'already-restored' : 'restored',
        onHandAfter: entry ? entry.onHand : null,
        matched: Boolean(entry),
        // Kept for the report: the CLI prints a different note per case.
        reversalKind: wasCancelled ? 'cancelled' : 'returned'
      });
    }
    order.stockApplied = true;
    order.stockLines = lines;
    if (isReturn(order.status)) {
      order.warnings.push(
        'ออเดอร์คืนสินค้า — คืนสต็อกแล้ว แต่รายได้เดิมยังอยู่ในงวดที่ขาย ต้องออกใบลดหนี้ (Credit Note) ชดเชย'
      );
    }
    return order;
  }

  if (!isCounted(order.status)) {
    // Not real money yet (PENDING / TO_DISPATCH confusion). Leave stock alone
    // but say so, so nobody wonders why the count is off.
    order.stockApplied = false;
    order.stockLines = order.lines.map((l) => ({
      sku: l.sku,
      qty: l.qty,
      action: 'skipped-status',
      matched: Boolean(l.sku && stock.has(l.sku))
    }));
    order.warnings.push(`สถานะ ${order.status} ยังไม่นับขาย — สต็อกยังไม่ถูกตัด (รอสถานะ READY_TO_SHIP ขึ้นไป)`);
    return order;
  }

  for (const line of order.lines) {
    const k = key(line);

    if (applied.has(k)) {
      lines.push({ sku: line.sku, qty: line.qty, action: 'already-applied', matched: true, onHandAfter: stock.get(line.sku)?.onHand ?? null });
      continue;
    }

    const entry = line.sku ? stock.get(line.sku) : null;
    if (!entry) {
      const msg = line.sku
        ? `ไม่พบสินค้า SKU ${line.sku} — ไม่ได้ตัดสต็อก`
        : `รายการ "${line.name}" ไม่มี SKU — ไม่ได้ตัดสต็อก`;
      order.warnings.push(msg);
      lines.push({ sku: line.sku, qty: line.qty, action: 'unmatched', matched: false, note: msg });
      continue;
    }

    const available = entry.onHand - (entry.reserved || 0);
    if (available < line.qty && policy === OVERSELL_POLICY.BLOCK) {
      const msg = `สต็อก ${line.sku} ไม่พอ (มี ${available} ต้องการ ${line.qty}) — บล็อกการตัด`;
      order.warnings.push(msg);
      lines.push({ sku: line.sku, qty: line.qty, action: 'blocked', matched: true, onHandAfter: entry.onHand });
      continue;
    }

    entry.onHand -= line.qty;
    applied.add(k);

    // "Sold more than sellable stock." Reserved units are physically present but
    // promised elsewhere, so `onHand` can stay positive while the oversell is
    // real — checking onHand < 0 alone would miss it.
    let action = 'deducted';
    if (available < line.qty || entry.onHand < 0) {
      action = 'deducted-oversell';
      const short = Math.max(0, line.qty - available);
      order.warnings.push(
        `สต็อก ${line.sku} ขาดจริง ${short} ชิ้น (พร้อมขาย ${available} แต่ออเดอร์นี้ ${line.qty}) — ขายแล้วถือว่าไม่มีของ ต้องจัดซื้อเพิ่ม`
      );
    }
    if (entry.reorderPoint && entry.onHand <= entry.reorderPoint) {
      order.warnings.push(`สต็อก ${line.sku} เหลือ ${entry.onHand} ถึงจุดสั่งซื้อแล้ว (${entry.reorderPoint})`);
    }

    lines.push({ sku: line.sku, qty: line.qty, action, matched: true, onHandAfter: entry.onHand });
  }

  order.stockApplied = true;
  order.stockLines = lines;
  return order;
}

/** Reverse every deduction for an order — used when a sale is cancelled later. */
export function restoreStock(order, { stock = new Map(), restored = new Set() } = {}) {
  order.status = 'CANCELLED';
  return applyStock(order, { stock, restored, policy: OVERSELL_POLICY.ALLOW_AND_REPORT });
}