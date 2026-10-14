// store.js — SQLite tables for marketplace orders and stock.
//
// Reuses the scraper's database file so there is one backup to think about.
// SCRAPER_DB_PATH decides where that lives; see scraper/README.md.

import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.SCRAPER_DB_PATH || 'scraper-data.sqlite';
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_items (
    sku        TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    onHand     INTEGER NOT NULL DEFAULT 0,
    reserved   INTEGER NOT NULL DEFAULT 0,
    reorderPoint INTEGER NOT NULL DEFAULT 0,
    costSatang INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS market_orders (
    channel     TEXT NOT NULL,
    orderNo     TEXT NOT NULL,
    orderDate   TEXT NOT NULL,
    status      TEXT NOT NULL,
    customerName TEXT,
    customerPhone TEXT,
    customerAddress TEXT,
    grossSatang   INTEGER NOT NULL DEFAULT 0,
    netSalesSatang INTEGER NOT NULL DEFAULT 0,
    outputVatSatang INTEGER NOT NULL DEFAULT 0,
    inputVatSatang  INTEGER NOT NULL DEFAULT 0,
    payableVatSatang INTEGER NOT NULL DEFAULT 0,
    platformFeeSatang INTEGER NOT NULL DEFAULT 0,
    profitSatang  INTEGER,
    stockApplied  INTEGER NOT NULL DEFAULT 0,
    warnings      TEXT,
    taxBreakdown  TEXT,
    importedAt  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (channel, orderNo)
  );

  CREATE TABLE IF NOT EXISTS market_order_lines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel    TEXT NOT NULL,
    orderNo    TEXT NOT NULL,
    sku        TEXT,
    name       TEXT,
    qty        INTEGER NOT NULL,
    unitPriceSatang INTEGER NOT NULL DEFAULT 0,
    unitCostSatang  INTEGER NOT NULL DEFAULT 0,
    stockAction TEXT,
    FOREIGN KEY (channel, orderNo) REFERENCES market_orders(channel, orderNo) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mol_order ON market_order_lines(channel, orderNo);

  -- Which (order, sku) pairs already moved stock. This is what makes re-running
  -- an import safe: without it, importing the same file twice deducts twice.
  CREATE TABLE IF NOT EXISTS market_stock_applied (
    channel TEXT NOT NULL,
    orderNo TEXT NOT NULL,
    sku     TEXT NOT NULL,
    action  TEXT NOT NULL,
    PRIMARY KEY (channel, orderNo, sku)
  );

  CREATE TABLE IF NOT EXISTS market_shop_settings (
    channel   TEXT PRIMARY KEY,
    shopId    TEXT,
    shopName  TEXT,
    note      TEXT
  );
`);

const q = {
  upsertItem: db.prepare(`
    INSERT INTO stock_items (sku, name, onHand, reserved, reorderPoint, costSatang)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET
      name = excluded.name,
      onHand = excluded.onHand,
      reorderPoint = excluded.reorderPoint,
      costSatang = excluded.costSatang
  `),
  allItems: db.prepare('SELECT * FROM stock_items ORDER BY sku'),
  item: db.prepare('SELECT * FROM stock_items WHERE sku = ?'),

  upsertOrder: db.prepare(`
    INSERT INTO market_orders
      (channel, orderNo, orderDate, status, customerName, customerPhone, customerAddress,
       grossSatang, netSalesSatang, outputVatSatang, inputVatSatang, payableVatSatang,
       platformFeeSatang, profitSatang, stockApplied, warnings, taxBreakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(channel, orderNo) DO UPDATE SET
      status = excluded.status,
      orderDate = excluded.orderDate,
      grossSatang = excluded.grossSatang,
      netSalesSatang = excluded.netSalesSatang,
      outputVatSatang = excluded.outputVatSatang,
      inputVatSatang = excluded.inputVatSatang,
      payableVatSatang = excluded.payableVatSatang,
      platformFeeSatang = excluded.platformFeeSatang,
      profitSatang = excluded.profitSatang,
      stockApplied = excluded.stockApplied,
      warnings = excluded.warnings,
      taxBreakdown = excluded.taxBreakdown
  `),
  order: db.prepare('SELECT * FROM market_orders WHERE channel = ? AND orderNo = ?'),
  allOrders: db.prepare('SELECT * FROM market_orders ORDER BY orderDate DESC LIMIT ?'),

  insertLine: db.prepare(`
    INSERT INTO market_order_lines
      (channel, orderNo, sku, name, qty, unitPriceSatang, unitCostSatang, stockAction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  linesFor: db.prepare('SELECT * FROM market_order_lines WHERE channel = ? AND orderNo = ?'),
  deleteLines: db.prepare('DELETE FROM market_order_lines WHERE channel = ? AND orderNo = ?'),

  markStock: db.prepare(`
    INSERT INTO market_stock_applied (channel, orderNo, sku, action) VALUES (?, ?, ?, ?)
    ON CONFLICT(channel, orderNo, sku) DO NOTHING
  `),
  appliedKeys: db.prepare('SELECT channel, orderNo, sku FROM market_stock_applied'),
  restoredKeys: db.prepare("SELECT channel, orderNo, sku FROM market_stock_applied WHERE action = 'restored'"),

  setOnHand: db.prepare('UPDATE stock_items SET onHand = ? WHERE sku = ?'),

  shopSettings: db.prepare('SELECT * FROM market_shop_settings WHERE channel = ?'),
  setShop: db.prepare(`
    INSERT INTO market_shop_settings (channel, shopId, shopName, note) VALUES (?, ?, ?, ?)
    ON CONFLICT(channel) DO UPDATE SET
      shopId = excluded.shopId, shopName = excluded.shopName, note = excluded.note
  `)
};

export function loadStock() {
  const map = new Map();
  for (const row of q.allItems.all()) {
    map.set(row.sku, {
      sku: row.sku,
      name: row.name,
      onHand: row.onHand,
      reserved: row.reserved,
      reorderPoint: row.reorderPoint,
      costSatang: row.costSatang
    });
  }
  return map;
}

export function saveStockItem(item) {
  q.upsertItem.run(
    item.sku,
    item.name || item.sku,
    item.onHand ?? 0,
    item.reserved ?? 0,
    item.reorderPoint ?? 0,
    item.costSatang ?? 0
  );
}

export function persistOnHand(sku, onHand) {
  q.setOnHand.run(onHand, sku);
}

export function loadApplied() {
  return new Set(q.appliedKeys.all().map((r) => `${r.channel}|${r.orderNo}|${r.sku}`));
}

export function loadRestored() {
  return new Set(q.restoredKeys.all().map((r) => `${r.channel}|${r.orderNo}|${r.sku}`));
}

export function markStockApplied(channel, orderNo, sku, action) {
  q.markStock.run(channel, orderNo, sku || '-', action);
}

export function saveOrder(order) {
  const t = order.taxBreakdown || {};
  q.upsertOrder.run(
    order.channel,
    order.orderNo,
    order.orderDate,
    order.status,
    order.customer.name,
    order.customer.phone,
    order.customer.address,
    order.grossSatang,
    t.netSalesSatang ?? 0,
    t.outputVatSatang ?? 0,
    t.inputVatSatang ?? 0,
    t.payableVatSatang ?? 0,
    order.platformFeeSatang,
    t.profitSatang ?? null,
    order.stockApplied ? 1 : 0,
    JSON.stringify(order.warnings),
    JSON.stringify(t)
  );
  q.deleteLines.run(order.channel, order.orderNo);
  for (let i = 0; i < order.lines.length; i++) {
    const l = order.lines[i];
    const action = order.stockLines.find((s) => s.sku === (l.sku ?? undefined))?.action ?? null;
    q.insertLine.run(order.channel, order.orderNo, l.sku, l.name, l.qty, l.unitPriceSatang, l.unitCostSatang, action);
  }
}

export function getOrder(channel, orderNo) {
  const row = q.order.get(channel, orderNo);
  if (!row) return null;
  return { ...row, lines: q.linesFor.all(channel, orderNo) };
}

export function listOrders(limit = 50) {
  return q.allOrders.all(limit);
}

export function getShop(channel) {
  return q.shopSettings.get(channel) || null;
}

export function setShop(channel, { shopId, shopName, note }) {
  q.setShop.run(channel, shopId ?? null, shopName ?? null, note ?? null);
}

/** Orders already imported, so a re-run can report "nothing new". */
export function knownOrders() {
  return new Set(q.allOrders.all(100000).map((r) => `${r.channel}|${r.orderNo}`));
}