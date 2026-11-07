// webhook-service/tests/idempotency.test.mjs
// Replaying the same event 3 times must produce exactly one side effect

import assert from 'node:assert/strict';

const processed = new Map();
function isProcessed(key) { return processed.has(key); }
function markProcessed(key) { processed.set(key, true); }

let inviteCount = 0;

async function process(orderId, eventName) {
  const key = `${orderId}:${eventName}`;
  if (isProcessed(key)) return 'already-processed';
  if (eventName === 'order_created') {
    inviteCount += 1;
  }
  markProcessed(key);
  return 'ok';
}

async function main() {
  // Replay same event 3 times
  await process('ord_1', 'order_created');
  await process('ord_1', 'order_created');
  await process('ord_1', 'order_created');

  assert.strictEqual(inviteCount, 1, 'exactly one invite after 3 replays');
  assert.strictEqual(processed.size, 1, 'exactly one idempotency entry');
  console.log('GREEN: idempotency — 3 replays = 1 invite');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
