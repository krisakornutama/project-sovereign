#!/usr/bin/env node
// cli.mjs — bring marketplace orders in and check what they did.
//
//   node marketplace/cli.mjs import orders.csv --channel shopee
//   node marketplace/cli.mjs stock
//   node marketplace/cli.mjs orders
//   node marketplace/cli.mjs pp30
//   node marketplace/cli.mjs shop --channel shopee --id 12345678
//   node marketplace/cli.mjs stock set <sku> --on-hand 50 [--cost 120]
//
// Reads the file the seller exported from Shopee/Lazada Seller Centre. No API
// keys needed for any of this.

import { readFileSync } from 'node:fs';
import { makeOrder, toBaht, isCancelled, isReturn } from './src/schema.js';
import { parseShopeeCsv } from './src/parsers/shopee.js';
import { parseLazadaCsv } from './src/parsers/lazada.js';
import { parseCsv, toObjects, readCsvFile } from './src/parsers/csv.js';
import { validateCsv, assertImportable } from './src/validate.js';
import { computeTax, pp30Line } from './src/tax.js';
import { applyStock, OVERSELL_POLICY } from './src/stock.js';
import { beginImport, finishImport, storeSource, listImports, readStored } from './src/audit.js';
import {
  loadStock, persistOnHand, loadApplied, loadRestored, markStockApplied,
  saveOrder, saveStockItem, listOrders, knownOrders, setShop, getShop
} from './src/store.js';

const args = process.argv.slice(2);
const cmd = args[0];

const baht = (s) => `${toBaht(s).toFixed(2)}฿`;

function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const has = (name) => args.includes(`--${name}`);

function usage() {
  console.log(`
marketplace — รับออเดอร์จาก Shopee / Lazada

  import <file.csv> --channel shopee|lazada   นำเข้าออเดอร์ + ตัดส���็อก
  stock                                     ดูสต็อก
  stock set <sku> --on-hand N [--cost N]     ตั้งสต็อก / ต้นทุน
  orders                                    ดูออเดอร์ล่าสุด
  pp30                                      สรุป ภ.พ.30 รายวัน
  shop --channel shopee --id 12345          บันทึก Shop ID

ตัวเลือก
  --dry-run       คำนวณแล้วไม่เขียนลงฐานข้อมูล
  --no-stock       ไม่ตัดสต็อก
  --block-oversell ปฏิเสธถ้าสต็อกไม่พอ (�กติจะตัดแล้วเตือน)
  --include-fee    นับค่าธรรมเนียนแพลตฟอร์มเป็นรายได้ (ปกติเป็นค่าเริ่มต้น)
  --fee-vat        คิด VAT บนค่าจัดส่งด้วย
`.trim());
}

if (!cmd || has('help')) {
  usage();
  process.exit(0);
}

if (cmd === 'import') {
  const file = args[1];
  const channel = (flag('channel') || 'shopee').toLowerCase();
  if (!file) { console.error('ต้องระบุไฟล์: import orders.csv --channel shopee'); process.exit(1); }

  const dry = has('dry-run');

  // Read + sniff encoding, then check the header shape before parsing. A renamed
  // column used to import happily with every amount at zero.
  let text, encoding;
  try {
    ({ text, encoding } = readCsvFile(file));
  } catch (err) {
    console.error(`อ่านไฟล์ไม่สำเร็จ: ${err.message}`);
    process.exit(1);
  }

  let report;
  try {
    report = assertImportable(text, channel, encoding);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (report.missingImportant.length || report.encoding.includes('�')) {
    console.warn(`⚠ ตรวจโครงสร้างไฟล์: ${report.message}`);
    if (report.unmapped.length) {
      console.warn(`  คอลัมน์ที่ไม่รู้จัก (ข้ามไป): ${report.unmapped.slice(0, 8).join(', ')}${report.unmapped.length > 8 ? ' …' : ''}`);
    }
  }

  const importId = beginImport({
    sourceFile: file, channel, encoding, dryRun: dry, headers: report.headers
  });
  const storedFile = dry ? null : storeSource(importId, file);

  let orders;
  try {
    if (channel === 'shopee') orders = parseShopeeCsv(text);
    else if (channel === 'lazada') orders = parseLazadaCsv(text);
    else orders = toObjects(parseCsv(text)).map((r) => makeOrder({ channel, ...r }));
  } catch (err) {
    console.error(`อ่านไฟล์ไม่สำเร็จ: ${err.message}`);
    finishImport(importId, { ordersRead: 0, warnings: [`ล้มเหลว: ${err.message}`] });
    process.exit(1);
  }
  const stock = loadStock();
  const applied = loadApplied();
  const restored = loadRestored();
  const known = knownOrders();
  const taxOpts = {
    includeFeeInRevenue: !has('no-fee'),
    platformVatOnShipping: has('fee-vat')
  };
  const policy = has('block-oversell') ? OVERSELL_POLICY.BLOCK : OVERSELL_POLICY.ALLOW_AND_REPORT;

  console.log(`อ่าน ${orders.length} ออเดอร์ จาก ${file} (ช่องทาง: ${channel})`);
  if (dry) console.log('— โหมดทดลอง ไม่เขียนลงฐานข้อมูล —');

  let newCount = 0, skippedCount = 0, stockTouched = 0, unmatchedCount = 0;
  let totalNet = 0, totalVat = 0, totalInput = 0, totalPayable = 0, totalFee = 0, totalGross = 0;
  const allWarnings = [];

  for (const order of orders) {
    // Fill known cost from the catalogue BEFORE tax runs, otherwise the first
    // import claims no input VAT and every later import uses a different number.
    for (const l of order.lines) {
      const item = l.sku ? stock.get(l.sku) : null;
      if (item) {
        l.unitCostSatang = item.costSatang;
        l.costKnown = true;
      }
    }

    computeTax(order, taxOpts);
    if (!has('no-stock')) {
      applyStock(order, { stock, applied, restored, policy });
    }

    const isNew = !known.has(`${order.channel}|${order.orderNo}`);
    if (isNew) newCount++; else skippedCount++;

    const t = order.taxBreakdown;
    // A cancelled or returned order is not a sale. Counting it inflates revenue
    // and VAT on both ภ.พ.30 and the profit figure.
    const cancelled = isCancelled(order.status);
    const returned = isReturn(order.status);
    // A return keeps its revenue (it was a real sale in its own period) but the
    // stock goes back, so it stays in the totals while a cancel drops out.
    if (isNew && !cancelled) {
      totalNet += t.netSalesSatang;
      totalVat += t.outputVatSatang;
      totalInput += t.inputVatSatang;
      totalPayable += t.payableVatSatang;
      totalFee += order.platformFeeSatang;
      totalGross += order.grossSatang;
    }
    unmatchedCount += order.stockLines.filter((l) => l.action === 'unmatched').length;
    allWarnings.push(...order.warnings.map((w) => `${order.orderNo}: ${w}`));

    const flagMark = !isNew
      ? 'ซ้ำ (ไม่หักสต็อกซ้ำ)'
      : cancelled
        ? 'ยกเลิก — ไม่นับรายได้'
        : returned
          ? 'คืนสินค้า — คืนสต็อก รายได้ยังอยู่งวดเดิม ต้องออกใบลดหนี้'
          : 'ใหม่';
    console.log(`\n${order.orderNo} [${order.status}] ${flagMark}`);
    console.log(`  ยอดที่ลูกค้าจ่าย : ${baht(order.grossSatang)}`);
    console.log(`  รายได้สุทธิ     : ${baht(t.netSalesSatang)}   VAT ขาย ${baht(t.outputVatSatang)} · ซื้อ ${baht(t.inputVatSatang)} · ต้องจ่าย ${baht(t.payableVatSatang)}`);
    console.log(`  ค่าธรรมเนียนแพลตฟอร์ม: ${baht(order.platformFeeSatang)}`);
    if (t.profitSatang !== null) console.log(`  กำไร          : ${baht(t.profitSatang)}`);
    for (const l of order.stockLines) {
      const mark = { deducted: 'ตัดสต็อก', 'deducted-oversell': 'ตัดสต็อก (ขาดจริง!)', restored: l.reversalKind === 'returned' ? 'คืนสต็อก (คืนสินค้า)' : 'คืนสต็อก', 'already-restored': 'คืนไปแล้ว', 'already-applied': 'ตัดไปแล้ว', unmatched: 'ไม่พบสินค้า', blocked: 'สต็อกไม่พอ', 'skipped-status': 'ยังไม่นับขาย' }[l.action] || l.action;
      console.log(`  สต็อก ${l.sku ?? '(ไม่มี SKU)'} x${l.qty} → ${mark}${l.onHandAfter !== null && l.onHandAfter !== undefined ? ` (เหลือ ${l.onHandAfter})` : ''}`);
      if (l.action === 'deducted') stockTouched++;
    }
    for (const w of order.warnings) console.log(`  ⚠ ${w}`);

    if (!dry) {
      for (const l of order.stockLines) {
        if (['deducted', 'deducted-oversell'].includes(l.action) && l.sku) {
          persistOnHand(l.sku, l.onHandAfter);
          markStockApplied(order.channel, order.orderNo, l.sku, l.action);
        } else if (l.action === 'restored' && l.sku) {
          persistOnHand(l.sku, l.onHandAfter);
          markStockApplied(order.channel, order.orderNo, l.sku, 'restored');
        }
      }
      saveOrder(order);
    }
  }

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`สรุป ${newCount} ออเดอร์ใหม่ · ซ้ำ ${skippedCount} · ตัดสต็อก ${stockTouched} รายการ · SKU ไม่ตรง ${unmatchedCount}`);
  console.log(`รายได้สุทธิ ${baht(totalNet)} · VAT ขาย ${baht(totalVat)} · VAT ซื้อ ${baht(totalInput)} · VAT สุทธิ ${baht(totalPayable)}`);
  console.log(`ค่าธรรมเนียนรวม ${baht(totalFee)} · ยอดขายรวม ${baht(totalGross)}`);

  finishImport(importId, {
    storedFile,
    ordersRead: orders.length,
    ordersNew: newCount,
    ordersDup: skippedCount,
    stockDeducted: stockTouched,
    unmatchedSku: unmatchedCount,
    grossSatang: totalGross,
    netSalesSatang: totalNet,
    vatPayableSatang: totalPayable,
    warnings: allWarnings
  });
  console.log(`บันทึกประวัติการนำเข้าแล้ว (#${importId})${dry ? ' — โหมดทดลองไม่เก็บสำเนาไฟล์' : ''}`);
  process.exit(0);
}

if (cmd === 'stock') {
  if (args[1] === 'set') {
    const sku = args[2];
    const onHand = flag('on-hand');
    const cost = flag('cost');
    if (!sku || onHand === null) { console.error('ใช้: stock set <sku> --on-hand 50 [--cost 120]'); process.exit(1); }
    const stock = loadStock();
    const existing = stock.get(sku);
    saveStockItem({
      sku,
      name: existing?.name ?? sku,
      onHand: Number(onHand),
      reserved: existing?.reserved ?? 0,
      reorderPoint: existing?.reorderPoint ?? 0,
      costSatang: cost !== null ? Math.round(Number(cost) * 100) : existing?.costSatang ?? 0
    });
    console.log(`บันทึกแล้ว: ${sku} · สต็อก ${onHand}${cost !== null ? ` · ต้นทุน ${cost}฿` : ''}`);
    process.exit(0);
  }

  const stock = loadStock();
  if (!stock.size) {
    console.log('ยังไม่มีสินค้าในระบบ — เพิ่มด้วย: node marketplace/cli.mjs stock set <sku> --on-hand 50');
    process.exit(0);
  }
  console.log('SKU'.padEnd(20) + 'สต็อก'.padStart(8) + 'ต้นทุน'.padStart(12) + '  หมายเหตุ');
  console.log('─'.repeat(56));
  for (const s of stock.values()) {
    const note = s.onHand < 0 ? 'ติดลบ! ขายเกิน' : s.reorderPoint && s.onHand <= s.reorderPoint ? 'ถึงจุดสั่งซื้อ' : '';
    console.log(
      s.sku.padEnd(20) + String(s.onHand).padStart(8) + baht(s.costSatang).padStart(12) + '  ' + note
    );
  }
  process.exit(0);
}

if (cmd === 'orders') {
  const rows = listOrders(Number(flag('limit', '20')));
  if (!rows.length) { console.log('ยังไม่มีออเดอร์ที่นำเข้า'); process.exit(0); }
  console.log('วันที่'.padEnd(11) + 'เลขออเดอร์'.padEnd(22) + 'ช่องทาง'.padEnd(9) + 'ยอด'.padStart(11) + 'VAT สุทธิ'.padStart(11) + '  สถานะ');
  console.log('─'.repeat(80));
  for (const r of rows) {
    console.log(
      String(r.orderDate).slice(0, 10).padEnd(11) +
      String(r.orderNo).slice(0, 20).padEnd(22) +
      String(r.channel).padEnd(9) +
      baht(r.grossSatang).padStart(11) +
      baht(r.payableVatSatang).padStart(11) +
      '  ' + r.status
    );
  }
  process.exit(0);
}

if (cmd === 'imports') {
  const rows = listImports(Number(flag('limit', '10')));
  if (!rows.length) { console.log('ยังไม่มีประวัติการนำเข้า'); process.exit(0); }
  console.log('#'.padEnd(5) + 'เวลา'.padEnd(22) + 'ช่องทาง'.padEnd(9) + 'ไฟล์'.padEnd(24) + 'ออเดอร์'.padStart(8) + 'ใหม่'.padStart(6) + 'ตัดสต็อก'.padStart(10) + '  VAT สุทธิ');
  console.log('─'.repeat(100));
  for (const r of rows) {
    console.log(
      String(r.id).padEnd(5) +
      String(r.startedAt).replace('T', ' ').slice(0, 19).padEnd(22) +
      String(r.channel).padEnd(9) +
      String(r.sourceFile).slice(0, 22).padEnd(24) +
      String(r.ordersRead).padStart(8) +
      String(r.ordersNew).padStart(6) +
      String(r.stockDeducted).padStart(10) +
      '  ' + baht(r.vatPayableSatang) +
      (r.dryRun ? '  [ทดลอง]' : '')
    );
  }
  console.log('\nดูรายละเอียด: node marketplace/cli.mjs imports --limit 20');
  console.log('สำเนาไฟล์ต้นทางอยู่ใน marketplace-storage/imports/');
  process.exit(0);
}

if (cmd === 'pp30') {
  const rows = listOrders(1000);
  // Cancelled and returned orders are stored for the audit trail but are not
  // sales. Including them inflates revenue and both sides of the VAT.
  const counted = rows.filter((r) => !isCancelled(r.status));
  if (!counted.length) {
    console.log(rows.length ? 'ยังไม่มีออเดอร์ที่นับรายได้ (ทั้งหมดยกเลิก/คืนสินค้า)' : 'ยังไม่มีออเดอร์ที่นำเข้า');
    process.exit(0);
  }
  const byDay = new Map();
  for (const r of counted) {
    const day = String(r.orderDate).slice(0, 10);
    const e = byDay.get(day) || { sales: 0, output: 0, input: 0, payable: 0, count: 0 };
    e.sales += r.netSalesSatang;
    e.output += r.outputVatSatang;
    e.input += r.inputVatSatang;
    e.payable += r.payableVatSatang;
    e.count++;
    byDay.set(day, e);
  }
  console.log('วันที่'.padEnd(12) + 'จำนวน'.padStart(7) + 'ยอดขาย'.padStart(12) + 'VAT ขาย'.padStart(11) + 'VAT ซื้อ'.padStart(11) + 'สุทธิ'.padStart(11));
  console.log('─'.repeat(64));
  let ts = 0, to = 0, ti = 0, tp = 0;
  for (const day of [...byDay.keys()].sort()) {
    const e = byDay.get(day);
    console.log(
      day.padEnd(12) + String(e.count).padStart(7) + baht(e.sales).padStart(12) +
      baht(e.output).padStart(11) + baht(e.input).padStart(11) + baht(e.payable).padStart(11)
    );
    ts += e.sales; to += e.output; ti += e.input; tp += e.payable;
  }
  console.log('─'.repeat(64));
  console.log('รวม'.padEnd(12) + ''.padStart(7) + baht(ts).padStart(12) + baht(to).padStart(11) + baht(ti).padStart(11) + baht(tp).padStart(11));
  const excluded = rows.length - counted.length;
  if (excluded > 0) console.log(`\nข้ามออเดอร์ที่ยกเลิก/คืนสินค้า ${excluded} รายการ`);
  console.log('หมายเหตุ: ตัวเลขนี้คำนวณจากออเดอร์ที่นำเข้าเท่านั้น ไม่ใช่ภ.พ.30 ฉบับสมบูรณ์');
  process.exit(0);
}

if (cmd === 'shop') {
  const channel = (flag('channel') || '').toUpperCase();
  const id = flag('id');
  if (!channel) { console.error('ใช้: shop --channel shopee --id 12345678'); process.exit(1); }
  if (id) {
    setShop(channel, { shopId: id, shopName: flag('name'), note: flag('note') });
    console.log(`บันทึกแล้ว: ${channel} · Shop ID ${id}`);
  } else {
    const s = getShop(channel);
    console.log(s ? `${channel} · Shop ID ${s.shopId} · ${s.shopName ?? ''}` : `ยังไม่ได้บันทึก ${channel}`);
  }
  process.exit(0);
}

usage();
process.exit(1);