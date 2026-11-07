/* SQLite persistence layer for webhook-service.
 * Replaces the in-memory Map (lost on every restart) with a durable
 * database so that idempotency, failed deliveries, and license events
 * survive redeploys — addressing PLAN.md 1.3 (data in RAM). */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.WEBHOOK_DB_PATH || path.join(__dirname, '..', 'webhook-data.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_events (
    id        TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    order_id  TEXT,
    github_username TEXT,
    status    TEXT,
    result    TEXT,
    processed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_events_key
    ON webhook_events (order_id, event_name);

  CREATE TABLE IF NOT EXISTS webhook_failures (
    id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    order_id  TEXT,
    event_name TEXT,
    reason    TEXT,
    status_code INTEGER,
    failed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_failures_order
    ON webhook_failures (order_id);

  CREATE TABLE IF NOT EXISTS licenses (
    order_id  TEXT PRIMARY KEY,
    github_username TEXT NOT NULL,
    license_key    TEXT NOT NULL,
    tier     TEXT NOT NULL DEFAULT 'starter',   -- starter | pro | business
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    refund_status TEXT DEFAULT 'none'            -- none | processed | manual
  );
`);

const q = {
  hasEvent: db.prepare('SELECT 1 FROM webhook_events WHERE order_id = ? AND event_name = ?'),
  insertEvent: db.prepare('INSERT INTO webhook_events (id, event_name, order_id, github_username, status, result, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  insertFailure: db.prepare('INSERT INTO webhook_failures (order_id, event_name, reason, status_code, failed_at) VALUES (?, ?, ?, ?, ?)'),
  insertLicense: db.prepare('INSERT OR IGNORE INTO licenses (order_id, github_username, license_key, tier, created_at) VALUES (?, ?, ?, ?, ?)'),
  revokeLicense: db.prepare("UPDATE licenses SET revoked_at = datetime('now'), refund_status = ? WHERE order_id = ?"),
  getLicense: db.prepare('SELECT * FROM licenses WHERE order_id = ?'),
  listFailures: db.prepare('SELECT * FROM webhook_failures ORDER BY failed_at DESC LIMIT ?'),
  clearFailures: db.prepare('DELETE FROM webhook_failures'),
};

export function isProcessed(orderId, eventName) {
  return !!q.hasEvent.get(orderId, eventName);
}

export function markProcessed(orderId, eventName, githubUsername, status, result) {
  const id = `${orderId}:${eventName}:${Date.now()}`;
  q.insertEvent.run(id, eventName, orderId, githubUsername || null, status, result || null, new Date().toISOString());
}

export function persistFailure(orderId, eventName, reason, statusCode) {
  q.insertFailure.run(orderId, eventName, reason || '', statusCode ?? 0, new Date().toISOString());
}

export function recordLicense({ orderId, githubUsername, licenseKey, tier = 'starter' }) {
  q.insertLicense.run(orderId, githubUsername, licenseKey, tier, new Date().toISOString());
}

export function getLicense(orderId) {
  return q.getLicense.get(orderId) ?? null;
}

export function revokeLicenseByOrder(orderId, refundStatus = 'processed') {
  q.revokeLicense.run(refundStatus, orderId);
}

export function listFailures(limit = 50) {
  return q.listFailures.all(Math.min(limit | 0 || 50, 500));
}

export function clearFailures() {
  q.clearFailures.run();
}
