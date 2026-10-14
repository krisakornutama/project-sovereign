// ssrfGuard.js — block requests to private / internal networks.
//
// The scraper fetches a URL the visitor typed. Without this guard the visitor
// can aim the server at the cloud metadata endpoint, the Railway private
// network, or a localhost admin port, and read the response back through the
// parsed title/description fields.
//
// Three layers, because each one alone can be bypassed:
//   1. hostname text check      — cheap, catches the obvious literals
//   2. DNS resolve + IP check   — catches a public name pointed at 127.0.0.1
//   3. pin the resolved IP      — defeats DNS rebinding between check and fetch
//
// IPv6 is covered: ::1, fc00::/7, fe80::/10, and IPv4-mapped ::ffff:a.b.c.d.

import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

// Numeric forms of private IPv4 are accepted by URL(), so catch them as text.
const BLOCKED_NUMERIC = [
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
  /^198\.18\./,                               // benchmarking 198.18/15
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^224\./,
  /^240\./,
];

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function isBlockedIPv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → refuse
  const first = (n >>> 24) & 0xff;
  const second = (n >>> 16) & 0xff;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;         // link-local + metadata
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 192 && second === 0 && (n & 0xffff) === 0) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first === 198 && second === 51) return true;
  if (first === 203 && second === 0) return true;
  if (first >= 224) return true;                            // multicast + reserved
  return false;
}

function isBlockedIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  // IPv4-mapped/compatible: ::ffff:127.0.0.1
  const mapped = lower.match(/::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  const head = lower.match(/^([0-9a-f]{1,4}):/);
  if (head) {
    const h = parseInt(head[1], 16);
    if ((h & 0xfe00) === 0xfc00) return true;  // fc00::/7 unique local
    if ((h & 0xffc0) === 0xfe80) return true;  // fe80::/10 link local
    if ((h & 0xff00) === 0xff00) return true;  // ff00::/8 multicast
  }
  return false;
}

export function isBlockedIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true;
}

/**
 * Full pre-flight check. Resolves the hostname and rejects if ANY answer is a
 * private address. Returns the first approved IP so the caller can pin the
 * connection to it (otherwise the name is resolved a second time by fetch()).
 */
export async function assertPublicUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw Object.assign(new Error('Invalid url.'), { status: 400 });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw Object.assign(new Error('Only http(s) is allowed.'), { status: 400 });
  }

  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) throw Object.assign(new Error('Invalid url.'), { status: 400 });
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw Object.assign(new Error('That host is not allowed.'), { status: 400 });
  }

  // Literal IP in the URL — no DNS needed.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw Object.assign(new Error('That address is not allowed.'), { status: 400 });
    }
    return { ip: host, host };
  }

  let answers;
  try {
    answers = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw Object.assign(new Error('Host not found.'), { status: 502 });
  }
  if (!answers.length) {
    throw Object.assign(new Error('Host not found.'), { status: 502 });
  }
  // Any private answer poisons the whole name → reject outright.
  for (const a of answers) {
    if (isBlockedIp(a.address)) {
      throw Object.assign(new Error('That address is not allowed.'), { status: 400 });
    }
  }
  return { ip: answers[0].address, host };
}