// sovereignty/server.js
// Sovereign LAN Messenger — device-to-device chat over local network.
// No internet required. No central server. Peers find each other
// through UDP multicast and exchange messages over direct HTTP.
//
// Design goals (per "อธิปไตย" — sovereignty, no central dependency):
//   1. Discovery: peers announce themselves on the LAN via multicast —
//      a router/hotspot is enough, internet is not.
//   2. Transport: messages go peer-to-peer; nothing is relayed through
//      a cloud service.
//   3. Local-first: message history is kept on each device, not in a
//      shared database.
//   4. Optional passphrase encryption for message payloads
//      (AES-256-GCM, key derived via scrypt) — privacy across the wire.

'use strict';

import http from 'http';
import dgram from 'dgram';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ── Config ------------------------------------------------------------------
const PORT = Number(process.env.MESH_HTTP_PORT || 4200);
const MULTI_ADDR = process.env.MESH_MULTI_ADDR || '239.255.42.1';
const MULTI_PORT = Number(process.env.MESH_MULTI_PORT || 41235);
const PEER_TTL = 30_000; // a peer is "alive" for 30s after its last announce

const PEER_ID = crypto.randomBytes(8).toString('hex');
const PEER_NAME = process.env.MESH_PEER_NAME || os.hostname() || `sovereign-${PEER_ID.slice(0, 4)}`;

// Optional passphrase — if set, payloads are AES-256-GCM encrypted with
// a scrypt-derived key before going on the wire.
const PASSPHRASE = process.env.MESH_PASSPHRASE || '';

// ── Crypto helpers (optional layer) ------------------------------------------
function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

function encryptPayload(obj, passphrase) {
  if (!passphrase) return JSON.stringify(obj);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const text = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ enc: 1, s: salt.toString('base64'), i: iv.toString('base64'), t: tag.toString('base64'), c: text.toString('base64') });
}

function decryptPayload(raw, passphrase) {
  if (!passphrase || raw == null || typeof raw !== 'object' || raw.enc !== 1) return raw;
  try {
    const salt = Buffer.from(raw.s, 'base64');
    const iv = Buffer.from(raw.i, 'base64');
    const tag = Buffer.from(raw.t, 'base64');
    const ciphertext = Buffer.from(raw.c, 'base64');
    const key = deriveKey(passphrase, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plain);
  } catch {
    return null; // wrong passphrase or corrupted packet — never crash on it
  }
}

// ── Local state ----------------------------------------------------------------
const peers = new Map(); // peerId -> { id, name, host, port, lastSeen }
const messages = [];     // { seq, from, fromName, text, ts }
const MAX_HISTORY = 500;
let seqCounter = 0;

function prunePeers() {
  const now = Date.now();
  for (const [id, p] of peers) {
    if (now - p.lastSeen > PEER_TTL) peers.delete(id);
  }
}

function rememberPeer({ id, name, host, lastSeen }) {
  if (!id || id === PEER_ID) return;
  const existing = peers.get(id);
  peers.set(id, {
    id,
    name: name || existing?.name || 'unknown',
    host: host || existing?.host || '',
    lastSeen: lastSeen || Date.now(),
  });
}

// ── UDP multicast (discovery + broadcast) -------------------------------------
const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });

function sendAnnounce(type, extra = {}) {
  const payload = encryptPayload(
    { v: 1, type, from: PEER_ID, name: PEER_NAME, ts: Date.now(), ...extra },
    PASSPHRASE
  );
  const buf = Buffer.from(payload, 'utf8');
  udp.send(buf, 0, buf.length, MULTI_PORT, MULTI_ADDR);
}

udp.on('message', (buf, rinfo) => {
  // Parse outer envelope first (may be encrypted)
  let outer;
  try { outer = JSON.parse(buf.toString('utf8')); } catch { return; }
  const inner = decryptPayload(outer, PASSPHRASE);
  if (!inner || inner.v !== 1 || !inner.from) return;
  if (inner.from === PEER_ID) return; // our own echo

  switch (inner.type) {
    case 'announce':
      rememberPeer({ id: inner.from, name: inner.name, host: rinfo.address });
      // answer with our own announce so the other side learns about us too
      if (!peers.has(inner.from)) sendAnnounce('announce');
      break;
    case 'leave':
      peers.delete(inner.from);
      break;
    case 'message': {
      if (!inner.seq) break;
      rememberPeer({ id: inner.from, name: inner.name, host: rinfo.address });
      // Dedupe: same seq must not enter history twice
      if (messages.some(m => m.from === inner.from && m.seq === inner.seq)) break;
      seqCounter += 1;
      messages.push({ seq: inner.seq, from: inner.from, fromName: inner.name, text: String(inner.text ?? '').slice(0, 2000), ts: inner.ts || Date.now() });
      if (messages.length > MAX_HISTORY) messages.splice(0, messages.length - MAX_HISTORY);
      break;
    }
    default:
      break;
  }
});

udp.on('error', (err) => {
  // Rule from the sovereign web: aux service must never take the page down.
  console.error('udp error (ignored, service continues):', err.message);
});

udp.bind(MULTI_PORT, () => {
  try {
    udp.setMulticastTTL(4); // a few hops is enough for a LAN/farm ground
    udp.addMembership(MULTI_ADDR);
  } catch (err) {
    console.error('multicast setup warning:', err.message);
  }
  console.log(`sovereign-mesh: UDP multicast ready on ${MULTI_ADDR}:${MULTI_PORT}`);
  console.log(`sovereign-mesh: peer id=${PEER_ID} name=${PEER_NAME} http=:${PORT}`);
  sendAnnounce('announce');
  // Re-announce every 10s (cheap keepalive; neighbours with old state recover)
  setInterval(() => sendAnnounce('announce'), 10_000).unref?.();
});

// On shutdown tell neighbours we left, so peer lists stay clean.
function gracefulLeave() {
  try { sendAnnounce('leave'); } catch {}
  setTimeout(() => process.exit(0), 120);
}
process.on('SIGINT', gracefulLeave);
process.on('SIGTERM', gracefulLeave);

// ── HTTP server (API + chat UI) -----------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');

// Sovereignty tools — each is a self-contained page (zero external requests).
// Serving them from the mesh node means every device on the LAN reaches them
// at http://<mesh-host>:4200/<path> — no internet, no cdn, no cloud.
const PAGES = new Map([
  ['/', 'lan-messenger.html'],
  ['/nfc', 'nfc-checkin.html'],
]);
const PAGE_CACHE = new Map(); // pathname -> Buffer | null (loaded once at startup)

for (const [route, file] of PAGES) {
  const full = path.join(PUBLIC_DIR, file);
  PAGE_CACHE.set(route, fs.existsSync(full) ? fs.readFileSync(full) : null);
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    // Sovereign-origin rule: never leak stack details to the network side
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

function readBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  prunePeers();
  try {
    if (u.pathname === '/health') {
      return json(res, 200, { status: 'ok', peer: { id: PEER_ID, name: PEER_NAME }, peers: peers.size, messages: messages.length, encrypted: Boolean(PASSPHRASE) });
    }

    if (u.pathname === '/peers' && req.method === 'GET') {
      const now = Date.now();
      const list = [...peers.values()]
        .filter(p => now - p.lastSeen <= PEER_TTL)
        .map(p => ({ id: p.id, name: p.name, host: p.host, ageMs: now - p.lastSeen }));
      return json(res, 200, { self: { id: PEER_ID, name: PEER_NAME }, peers: list });
    }

    if (u.pathname === '/messages' && req.method === 'GET') {
      const since = Number(u.searchParams.get('since') || 0);
      const list = messages.filter(m => m.seq > since).slice(-100);
      return json(res, 200, { cursor: seqCounter, messages: list });
    }

    if (u.pathname === '/send' && req.method === 'POST') {
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { error: 'invalid json' }); }
      const text = String(body?.text ?? '').trim().slice(0, 2000);
      if (!text) return json(res, 400, { error: 'text required' });

      const seq = ++seqCounter;
      const entry = { seq, from: PEER_ID, fromName: PEER_NAME, text, ts: Date.now() };
      messages.push(entry);
      if (messages.length > MAX_HISTORY) messages.splice(0, messages.length - MAX_HISTORY);

      // Broadcast to the whole LAN segment — every peer receives it directly.
      sendAnnounce('message', { seq, text, ts: entry.ts });
      return json(res, 200, { ok: true, seq });
    }

    // Bundled sovereignty tool pages (static, cache disabled)
    if (PAGE_CACHE.has(u.pathname)) {
      const page = PAGE_CACHE.get(u.pathname);
      if (page) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(page);
      }
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    const status = err?.status || (err?.message === 'payload too large' ? 413 : 500);
    return json(res, status, { error: status === 500 ? 'internal error' : String(err?.message || 'error') });
  }
});

server.listen(PORT, () => {
  console.log(`sovereign-mesh: HTTP UI at http://localhost:${PORT}/`);
});
