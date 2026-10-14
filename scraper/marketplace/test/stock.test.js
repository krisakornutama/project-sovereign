// stock.test.js — moving stock without corrupting the count.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeOrder } from '../src/schema.js';
import { applyStock, restoreStock, OVERSELL_POLICY } from '../src/stock.js';

const catalogue = (spec = {}) =>
  new Map(
    Object.entries({ A1: { sku: 'A1', name: 'กาแฟ', onHand: 10, reserved: 0, reorderPoint: 3, costSatang: 5000 }, ...spec }).map(
      ([sku, v]) => [sku, { reserved: 0, reorderPoint: 0, costSatang: 0, name: sku, ...v }]
    )
  );

const order = (over = {}) =>
  makeOrder({
    channel: 'SHOPEE',
    orderNo: '2501AAA',
    status: 'READY_TO_SHIP',
    lines: [{ sku: 'A1', name: 'กาแฟ', qty: 2, unitPrice: 15000 }],
    ...over
  });

describe('deducting stock', () => {
  test('a real sale reduces on-hand by the quantity', () => {
    const stock = catalogue();
    const o = applyStock(order(), { stock, applied: new Set() });
    assert.equal(stock.get('A1').onHand, 8);
    assert.equal(o.stockLines[0].action, 'deducted');
  });

  test('reserved stock is not sellable', () => {
    const stock = catalogue({ A1: { sku: 'A1', name: 'กาแฟ', onHand: 10, reserved: 9, costSatang: 0 } });
    const o = applyStock(order(), { stock, applied: new Set() });
    // 10 on hand but 9 reserved → only 1 sellable, so a 2-unit order oversells.
    assert.equal(stock.get('A1').onHand, 8);
    assert.equal(o.stockLines[0].action, 'deducted-oversell');
    assert.ok(o.warnings.some((w) => w.includes('ขาดจริง')));
  });

  test('re-importing the same order does not deduct twice', () => {
    const stock = catalogue();
    const applied = new Set();
    applyStock(order(), { stock, applied });
    applyStock(order(), { stock, applied });
    assert.equal(stock.get('A1').onHand, 8, 'the second import must be a no-op');
  });

  test('an unknown SKU is a warning, not a failed import', () => {
    const stock = catalogue();
    const o = applyStock(
      order({ lines: [{ sku: 'NOPE', name: 'ของหาย', qty: 1, unitPrice: 100 }] }),
      { stock, applied: new Set() }
    );
    assert.equal(o.stockLines[0].action, 'unmatched');
    assert.ok(o.warnings.some((w) => w.includes('ไม่พบสินค้า')));
  });

  test('a line with no SKU is flagged, never silently skipped', () => {
    const stock = catalogue();
    const o = applyStock(
      order({ lines: [{ sku: null, name: 'สินค้าไม่มี SKU', qty: 1, unitPrice: 100 }] }),
      { stock, applied: new Set() }
    );
    assert.equal(o.stockLines[0].action, 'unmatched');
    assert.ok(o.warnings.some((w) => w.includes('ไม่มี SKU')));
  });

  test('block policy refuses to go past available', () => {
    const stock = catalogue({ A1: { sku: 'A1', onHand: 1, name: 'กาแฟ', costSatang: 0 } });
    const o = applyStock(order({ lines: [{ sku: 'A1', qty: 5, unitPrice: 100 }] }), {
      stock,
      applied: new Set(),
      policy: OVERSELL_POLICY.BLOCK
    });
    assert.equal(stock.get('A1').onHand, 1, 'stock must be untouched');
    assert.equal(o.stockLines[0].action, 'blocked');
  });

  test('dropping below the reorder point warns', () => {
    const stock = catalogue({ A1: { sku: 'A1', onHand: 4, name: 'กาแฟ', reorderPoint: 3, costSatang: 0 } });
    const o = applyStock(order(), { stock, applied: new Set() });
    assert.ok(o.warnings.some((w) => w.includes('สั่งซื้อ')));
  });
});

describe('statuses that do not count yet', () => {
  test('PENDING leaves stock alone and says why', () => {
    const stock = catalogue();
    const o = applyStock(order({ status: 'PENDING' }), { stock, applied: new Set() });
    assert.equal(stock.get('A1').onHand, 10, 'stock must not move on an unpaid order');
    assert.equal(o.stockApplied, false);
    assert.ok(o.warnings.some((w) => w.includes('ยังไม่นับขาย')));
  });
});

describe('cancellations', () => {
  test('cancelling restores what was deducted', () => {
    const stock = catalogue();
    const applied = new Set();
    const restored = new Set();
    applyStock(order(), { stock, applied });
    assert.equal(stock.get('A1').onHand, 8);

    restoreStock(order(), { stock, restored });
    assert.equal(stock.get('A1').onHand, 10, 'cancellation must put the goods back');
  });

  test('restoring twice does not inflate stock', () => {
    const stock = catalogue();
    const applied = new Set();
    const restored = new Set();
    applyStock(order(), { stock, applied });
    restoreStock(order(), { stock, restored });
    restoreStock(order(), { stock, restored });
    assert.equal(stock.get('A1').onHand, 10);
  });
});