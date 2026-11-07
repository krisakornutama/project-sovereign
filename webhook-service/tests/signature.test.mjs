// webhook-service/tests/signature.test.mjs
// HMAC-SHA256 signature verification — red test first, then green after implementation

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const SECRET = 'whsec_test_secret_12345';
const RAW_BODY = JSON.stringify({ event_name: 'order_created', id: 'ord_123' });

function expectedSignature(body, secret) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function run() {
  // ตั้งค่า secret ให้ server.js มองเห็น (ตาม .env.example)
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;

  let verify;
  try {
    const mod = await import('../server.js');
    verify = mod.default?.verifySignature || mod.verifySignature;
  } catch (e) {
    console.log('RED: verifySignature not exported yet (expected before implementation)');
    process.exitCode = 1;
    return;
  }

  // Test 1: valid signature returns true
  {
    const sig = expectedSignature(RAW_BODY, SECRET);
    assert.strictEqual(verify(Buffer.from(RAW_BODY), sig), true, 'valid signature should return true');
    console.log('GREEN: valid signature returns true');
  }

  // Test 2: tampered body returns false
  {
    const sig = expectedSignature(RAW_BODY, SECRET);
    const tampered = Buffer.from(RAW_BODY.replace('order_created', 'order_xxx'));
    assert.strictEqual(verify(tampered, sig), false, 'tampered body should return false');
    console.log('GREEN: tampered body returns false');
  }

  // Test 3: missing signature returns false
  {
    assert.strictEqual(verify(Buffer.from(RAW_BODY), undefined), false, 'missing signature should return false');
    console.log('GREEN: missing signature returns false');
  }
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
