// audit.js — an import trail.
//
// When a seller disputes a number ("that order shouldn't be here") or stock
// looks wrong, the only useful answer is: which file did you import, when, and
// what did it change. Without that the whole argument falls back to memory.
//
// The original file itself is stored too, so a re-run can reproduce exactly what
// was imported rather than trusting the seller to re-export the same thing.

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, join, extname } from 'node:path';

const DB_PATH = process.env.SCRAPER_DB_PATH || 'scraper-data.sqlite';
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS market_imports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt    TEXT NOT NULL,
    finishedAt   TEXT,
    sourceFile   TEXT NOT NULL,
    storedFile   TEXT,
    channel      TEXT NOT NULL,
    shopId       TEXT,
    encoding     TEXT,
    dryRun       INTEGER NOT NULL DEFAULT 0,
    ordersRead   INTEGER NOT NULL DEFAULT 0,
    ordersNew    INTEGER NOT NULL DEFAULT 0,
    ordersDup    INTEGER NOT NULL DEFAULT 0,
    ordersSkipped INTEGER NOT NULL DEFAULT 0,
    stockDeducted INTEGER NOT NULL DEFAULT 0,
    unmatchedSku INTEGER NOT NULL DEFAULT 0,
    grossSatang  INTEGER NOT NULL DEFAULT 0,
    netSalesSatang INTEGER NOT NULL DEFAULT 0,
    vatPayableSatang INTEGER NOT NULL DEFAULT 0,
    warnings     TEXT,
    headerSnapshot TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_imports_started ON market_imports(startedAt DESC);
`);

const q = {
  insert: db.prepare(`
    INSERT INTO market_imports
      (startedAt, sourceFile, channel, encoding, dryRun, headerSnapshot)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  finish: db.prepare(`
    UPDATE market_imports SET
      finishedAt = ?, storedFile = ?, ordersRead = ?, ordersNew = ?, ordersDup = ?,
      ordersSkipped = ?, stockDeducted = ?, unmatchedSku = ?, grossSatang = ?,
      netSalesSatang = ?, vatPayableSatang = ?, warnings = ?
    WHERE id = ?
  `),
  recent: db.prepare('SELECT * FROM market_imports ORDER BY id DESC LIMIT ?'),
  one: db.prepare('SELECT * FROM market_imports WHERE id = ?')
};

const STORAGE_DIR = process.env.MARKETPLACE_STORAGE || 'marketplace-storage/imports';

export function beginImport({ sourceFile, channel, encoding, dryRun, headers }) {
  mkdirSync(STORAGE_DIR, { recursive: true });
  const info = q.insert.run(
    new Date().toISOString(),
    basename(sourceFile),
    channel,
    encoding || 'utf-8',
    dryRun ? 1 : 0,
    JSON.stringify(headers || [])
  );
  return Number(info.lastInsertRowid);
}

/**
 * Copy the source file next to the ledger.
 *
 * The name carries the timestamp and the row id so several imports of
 * "orders.csv" on the same day stay distinguishable.
 */
export function storeSource(importId, sourcePath) {
  if (!existsSync(sourcePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${stamp}_${importId}_${basename(sourcePath)}`;
  const dest = join(STORAGE_DIR, name);
  writeFileSync(dest, readFileSync(sourcePath));
  return dest;
}

export function finishImport(importId, stats) {
  q.finish.run(
    new Date().toISOString(),
    stats.storedFile || null,
    stats.ordersRead ?? 0,
    stats.ordersNew ?? 0,
    stats.ordersDup ?? 0,
    stats.ordersSkipped ?? 0,
    stats.stockDeducted ?? 0,
    stats.unmatchedSku ?? 0,
    stats.grossSatang ?? 0,
    stats.netSalesSatang ?? 0,
    stats.vatPayableSatang ?? 0,
    JSON.stringify(stats.warnings || []),
    importId
  );
}

export function listImports(limit = 20) {
  return q.recent.all(limit);
}

export function getImport(id) {
  return q.one.get(id) || null;
}

/** Re-read a stored file — for reproducing an import months later. */
export function readStored(importRow) {
  if (!importRow?.storedFile || !existsSync(importRow.storedFile)) return null;
  return readFileSync(importRow.storedFile, 'utf8');
}