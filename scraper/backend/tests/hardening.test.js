import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/rateLimit.js';
import { scrapeUrl, MAX_HTML_BYTES } from '../src/scraper.js';
import { isBlockedIp, assertPublicUrl } from '../src/ssrfGuard.js';
import {
  issueCustomerToken,
  readCustomerToken,
  hasTokenSecret
} from '../src/customerToken.js';

function runMw(mw, ip) {
  return new Promise((resolve) => {
    mw({ ip }, {}, (err) => resolve(err));
  });
}

describe('rate limiter', () => {
  test('rejects past max with 429', async () => {
    const mw = createRateLimiter({ windowMs: 60_000, max: 2 });
    assert.equal(await runMw(mw, '10.0.0.1'), undefined);
    assert.equal(await runMw(mw, '10.0.0.1'), undefined);
    const err = await runMw(mw, '10.0.0.1');
    assert.equal(err?.status, 429);
  });

  test('bounds tracked keys under pressure', async () => {
    const mw = createRateLimiter({ windowMs: 60_000, max: 1000, maxKeys: 2 });
    await runMw(mw, '10.0.0.1');
    await runMw(mw, '10.0.0.2');
    await runMw(mw, '10.0.0.3');
    assert.ok(mw._hits.size <= 2, `expected <=2 keys, got ${mw._hits.size}`);
  });
});

describe('scraper size guard', () => {
  test('rejects oversize content-length without reading body', async () => {
    let read = false;
    const fakeFetch = async () => ({
      ok: true,
      headers: { get: (k) => (k === 'content-length' ? String(MAX_HTML_BYTES + 1) : null) },
      text: async () => {
        read = true;
        return 'x';
      }
    });
    await assert.rejects(
      () => scrapeUrl('https://example.com/big', fakeFetch, { skipSsrfCheck: true }),
      /too large/
    );
    assert.equal(read, false);
  });

  test('truncates huge bodies before parsing', async () => {
    const words = 600_000;
    const html = `<html><head><title>Capped</title></head><body>${'word '.repeat(words)}</body></html>`;
    assert.ok(html.length > MAX_HTML_BYTES, 'fixture must exceed the cap');
    const fakeFetch = async () => ({
      ok: true,
      headers: { get: () => null },
      text: async () => html
    });
    const doc = await scrapeUrl('https://example.com/huge', fakeFetch, { skipSsrfCheck: true });
    assert.equal(doc.title, 'Capped');
    assert.ok(doc.wordCount < words, `expected <${words} words, got ${doc.wordCount}`);
  });
});

describe('ssrf guard', () => {
  const blocked = [
    '127.0.0.1',
    '127.0.0.53',
    '10.0.0.5',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '255.255.255.255',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1'
  ];

  test('private and reserved addresses are blocked', () => {
    for (const ip of blocked) {
      assert.equal(isBlockedIp(ip), true, `${ip} must be blocked`);
    }
  });

  test('public addresses are allowed', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) {
      assert.equal(isBlockedIp(ip), false, `${ip} must be allowed`);
    }
  });

  test('literal private targets are refused before any fetch', async () => {
    for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.0.5', '192.168.0.1']) {
      await assert.rejects(
        () => assertPublicUrl(`http://${ip}/latest/meta-data/`),
        /not allowed/,
        `${ip} must be refused`
      );
    }
  });

  test('localhost and metadata hostnames are refused', async () => {
    await assert.rejects(() => assertPublicUrl('http://localhost:3001/admin'), /not allowed/);
    await assert.rejects(
      () => assertPublicUrl('http://metadata.google.internal/computeMetadata/v1/'),
      /not allowed/
    );
  });

  test('non-http protocols are refused', async () => {
    await assert.rejects(() => assertPublicUrl('file:///etc/passwd'), /http/);
    await assert.rejects(() => assertPublicUrl('gopher://1.1.1.1/'), /http/);
  });

  test('scrapeUrl refuses a private target without calling fetch', async () => {
    let called = false;
    const fakeFetch = async () => {
      called = true;
      throw new Error('should never run');
    };
    await assert.rejects(
      () => scrapeUrl('http://169.254.169.254/latest/meta-data/', fakeFetch),
      /not allowed/
    );
    assert.equal(called, false, 'fetch must not be reached for a blocked target');
  });
});

describe('customer token', () => {
  test('fails closed when no secret is configured', () => {
    const saved = process.env.CUSTOMER_TOKEN_SECRET;
    delete process.env.CUSTOMER_TOKEN_SECRET;
    try {
      assert.equal(hasTokenSecret(), false);
      assert.throws(() => issueCustomerToken(), /not configured/);
      // A token minted elsewhere must not be accepted without a secret.
      assert.equal(readCustomerToken('a'.repeat(32) + '.' + 'b'.repeat(64)), undefined);
    } finally {
      if (saved !== undefined) process.env.CUSTOMER_TOKEN_SECRET = saved;
    }
  });

  test('round-trips a valid token', () => {
    const saved = process.env.CUSTOMER_TOKEN_SECRET;
    process.env.CUSTOMER_TOKEN_SECRET = 'x'.repeat(48);
    try {
      const token = issueCustomerToken();
      const id = readCustomerToken(token);
      assert.ok(id, 'a fresh token must resolve to an id');
      assert.equal(id.length, 32);
    } finally {
      if (saved === undefined) delete process.env.CUSTOMER_TOKEN_SECRET;
      else process.env.CUSTOMER_TOKEN_SECRET = saved;
    }
  });

  test('rejects forged and tampered tokens', () => {
    const saved = process.env.CUSTOMER_TOKEN_SECRET;
    process.env.CUSTOMER_TOKEN_SECRET = 'y'.repeat(48);
    try {
      const token = issueCustomerToken();
      const id = readCustomerToken(token);
      const forged = readCustomerToken(`${id}.${'0'.repeat(64)}`);
      assert.equal(forged, undefined, 'a bad signature must not resolve');

      // Swapping in another id while keeping the signature must fail.
      const other = 'f'.repeat(32);
      assert.equal(readCustomerToken(`${other}.${token.split('.')[1]}`), undefined);

      // Malformed shapes.
      assert.equal(readCustomerToken('nope'), undefined);
      assert.equal(readCustomerToken(`${id}`), undefined);
      assert.equal(readCustomerToken(`${id}.short`), undefined);
    } finally {
      if (saved === undefined) delete process.env.CUSTOMER_TOKEN_SECRET;
      else process.env.CUSTOMER_TOKEN_SECRET = saved;
    }
  });

  test('a token from a different secret is rejected', () => {
    const saved = process.env.CUSTOMER_TOKEN_SECRET;
    process.env.CUSTOMER_TOKEN_SECRET = 'z'.repeat(48);
    const token = issueCustomerToken();
    process.env.CUSTOMER_TOKEN_SECRET = 'w'.repeat(48);
    try {
      assert.equal(readCustomerToken(token), undefined);
    } finally {
      if (saved === undefined) delete process.env.CUSTOMER_TOKEN_SECRET;
      else process.env.CUSTOMER_TOKEN_SECRET = saved;
    }
  });
});
