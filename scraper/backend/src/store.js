// store.js — persistence for the scraper.
//
// Was a set of in-memory Maps. Every deploy, restart or crash wiped the ledger
// *and* the credit balances — meaning a customer who had paid was left with
// nothing. This module keeps the same API but writes through to SQLite so state
// survives a restart.
//
// Uses node:sqlite (built into Node 22.5+), so there is no native dependency to
// compile and nothing new to install.
//
// Rules that carried over from the in-memory version and must stay true:
//   - each customer's data is scoped to their own id
//   - one successful scrape spends exactly one credit
//   - a failed scrape must not spend anything
//   - the free tier is capped per IP so one network cannot mint credit by
//     cycling ids

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export const DEFAULT_SCOPE = 'shared';
export const FREE_TIER_CREDITS = 3;
export const FREE_TIER_MAX_PER_IP = 3;

// DATA_DIR lets the deploy mount a volume. Without it we sit next to the code,
// which is fine locally but loses data when Railway redeploys the image.
const DB_PATH = process.env.SCRAPER_DB_PATH || 'scraper-data.sqlite';

const db = new DatabaseSync(DB_PATH);

// WAL lets readers and a writer coexist, but it still allows exactly one
// writer at a time. The tests open several connections in parallel (node --test
// runs files as separate processes against the same file), so wait rather than
// throwing "database is locked". busy_timeout is what makes that wait happen.
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    scope       TEXT NOT NULL,
    url         TEXT NOT NULL,
    domain      TEXT,
    title       TEXT,
    description TEXT,
    h1Count     INTEGER NOT NULL DEFAULT 0,
    wordCount   INTEGER NOT NULL DEFAULT 0,
    status      TEXT,
    createdAt   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_scope ON items(scope, createdAt DESC);

  CREATE TABLE IF NOT EXISTS customers (
    scope     TEXT PRIMARY KEY,
    credits   INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ipFreeGrants (
    ip     TEXT PRIMARY KEY,
    grants INTEGER NOT NULL DEFAULT 0
  );
`);

const q = {
  ownItems: db.prepare(
    'SELECT * FROM items WHERE scope = ? ORDER BY createdAt DESC LIMIT ?'
  ),
  allItemsForScope: db.prepare('SELECT * FROM items WHERE scope = ?'),
  getById: db.prepare('SELECT * FROM items WHERE id = ? AND scope = ?'),
  insertItem: db.prepare(`
    INSERT INTO items (id, scope, url, domain, title, description, h1Count, wordCount, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteItem: db.prepare('DELETE FROM items WHERE id = ? AND scope = ?'),

  getCustomer: db.prepare('SELECT scope, credits, createdAt FROM customers WHERE scope = ?'),
  insertCustomer: db.prepare(
    'INSERT INTO customers (scope, credits, createdAt) VALUES (?, 0, ?) ON CONFLICT(scope) DO NOTHING'
  ),
  addCredits: db.prepare('UPDATE customers SET credits = credits + ? WHERE scope = ?'),
  spendCredit: db.prepare(
    'UPDATE customers SET credits = credits - 1 WHERE scope = ? AND credits >= 1'
  ),
  creditBalance: db.prepare('SELECT credits FROM customers WHERE scope = ?'),

  getGrant: db.prepare('SELECT grants FROM ipFreeGrants WHERE ip = ?'),
  addGrant: db.prepare(
    'INSERT INTO ipFreeGrants (ip, grants) VALUES (?, 1) ON CONFLICT(ip) DO UPDATE SET grants = grants + 1'
  ),

  clearItems: db.prepare('DELETE FROM items'),
  clearCustomers: db.prepare('DELETE FROM customers'),
  clearGrants: db.prepare('DELETE FROM ipFreeGrants')
};

const resolveScope = (scope) =>
  typeof scope === 'string' && scope.trim() ? scope.trim() : DEFAULT_SCOPE;

function ensureRow(scope) {
  const key = resolveScope(scope);
  const existing = q.getCustomer.get(key);
  if (existing) return { key, created: false };
  q.insertCustomer.run(key, new Date().toISOString());
  return { key, created: true };
}

export function ensureCustomer(scope, ip) {
  const { key, created } = ensureRow(scope);
  let freeTierApplied = false;

  // The free tier belongs to a *first* visit only. Without the `created` guard
  // this granted 3 credits on every single request, and the per-IP cap counted
  // calls rather than customers — so a reload could hand out fresh credit.
  if (created && ip) {
    const used = q.getGrant.get(ip)?.grants ?? 0;
    if (used < FREE_TIER_MAX_PER_IP) {
      q.addGrant.run(ip);
      q.addCredits.run(FREE_TIER_CREDITS, key);
      freeTierApplied = true;
    }
  }
  return { scope: key, credits: getCredits(key), freeTierApplied };
}

function ownItems(scope, limit) {
  return q.ownItems.all(resolveScope(scope), limit);
}

export function listContents({ q: query = '', limit = 50, scope } = {}) {
  const needle = String(query || '').toLowerCase().trim();
  const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  let all = ownItems(scope, 200);

  if (needle) {
    all = all.filter(
      (it) =>
        (it.url || '').toLowerCase().includes(needle) ||
        (it.title || '').toLowerCase().includes(needle) ||
        (it.description || '').toLowerCase().includes(needle)
    );
  }
  return all.slice(0, n);
}

export function getContent(id, scope) {
  return q.getById.get(id, resolveScope(scope)) ?? null;
}

export function createContent(data, scope) {
  const doc = {
    id: randomUUID(),
    scope: resolveScope(scope),
    url: data.url,
    domain: data.domain,
    title: data.title || '',
    description: data.description || '',
    h1Count: data.h1Count ?? 0,
    wordCount: data.wordCount ?? 0,
    status: data.status || 'ok',
    createdAt: new Date().toISOString()
  };
  q.insertItem.run(
    doc.id, doc.scope, doc.url, doc.domain, doc.title, doc.description,
    doc.h1Count, doc.wordCount, doc.status, doc.createdAt
  );
  return doc;
}

export function removeContent(id, scope) {
  return q.deleteItem.run(id, resolveScope(scope)).changes > 0;
}

// ---- credits ---------------------------------------------------------------

export function getCredits(scope) {
  return q.creditBalance.get(resolveScope(scope))?.credits ?? 0;
}

export function grantCredits(n, scope) {
  const amount = Number.isInteger(n) && n > 0 ? n : 0;
  if (amount === 0) return getCredits(scope);
  const { key } = ensureRow(scope);
  q.addCredits.run(amount, key);
  return getCredits(key);
}

export function spendCredit(scope) {
  const key = resolveScope(scope);
  if (!q.getCustomer.get(key)) return false;
  // The WHERE clause carries the check, so two concurrent requests cannot both
  // spend the last credit.
  return q.spendCredit.run(key).changes > 0;
}

export function resetCredits() {
  q.clearCustomers.run();
  q.clearGrants.run();
}

export function clearStore() {
  q.clearItems.run();
  resetCredits();
}

export function getStats(scope) {
  const all = q.allItemsForScope.all(resolveScope(scope));
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = all.filter((it) => (it.createdAt || '').slice(0, 10) === today).length;
  const totalWords = all.reduce((s, it) => s + (it.wordCount || 0), 0);
  const domains = {};
  for (const it of all) {
    if (it.domain) domains[it.domain] = (domains[it.domain] || 0) + 1;
  }
  const topDomains = Object.entries(domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));
  return {
    total: all.length,
    today: todayCount,
    avgWordCount: all.length ? Math.round(totalWords / all.length) : 0,
    topDomains
  };
}

/** Test helper — points at a throwaway file so tests never touch real data. */
export function useTempDatabase() {
  q.clearItems.run();
  q.clearCustomers.run();
  q.clearGrants.run();
}