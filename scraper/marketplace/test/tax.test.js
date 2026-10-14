// tax.test.js — VAT maths for marketplace orders.
//
// The failure these guard against is silent: the order imports, the numbers look
// plausible, and ภ.พ.30 is simply wrong by some amount nobody notices until the
// Revenue Department does.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeOrder, toSatang } from '../src/schema.js';
import { computeTax, extractVat, pp30Line } from '../src/tax.js';

// makeOrder() takes amounts in BAHT and converts to satang itself; the
// *_Satang values on the result are integers. Write the fixture in baht so the
// conversion path itself stays under test:
//   gross 1000฿ → 100000 satang → net 93458 + VAT 6542
const baseOrder = (over = {}) =>
  makeOrder({
    channel: 'SHOPEE',
    orderNo: '2501AAA',
    gross: 1000,
    shipping: 50,
    platformFee: 100,
    lines: [{ sku: 'A1', name: 'สินค้า', qty: 1, unitPrice: 1000, costKnown: true, unitCost: 600 }],
    ...over
  });

describe('extractVat', () => {
  test('splits a VAT-inclusive total by dividing, not multiplying', () => {
    // ฿107 gross = ฿100 net + ฿7 VAT. Multiplying by 1.07 would give ฿114.49.
    const r = extractVat(10700);
    assert.equal(r.netSatang, 10000);
    assert.equal(r.taxSatang, 700);
    assert.equal(r.grossSatang, 10700);
  });

  test('the residual always sums back to the gross (no lost satang)', () => {
    for (const baht of [0.01, 1, 99.99, 1234.56, 99999.99]) {
      const r = extractVat(toSatang(baht));
      assert.equal(r.netSatang + r.taxSatang, r.grossSatang, `${baht}฿ must balance`);
    }
  });

  test('a zero rate yields no tax', () => {
    const r = extractVat(10000, 0);
    assert.equal(r.netSatang, 10000);
    assert.equal(r.taxSatang, 0);
  });
});

describe('computeTax — revenue', () => {
  test('gross from the buyer is VAT-inclusive', () => {
    const o = computeTax(baseOrder({ platformFee: 0 }));
    const t = o.taxBreakdown;
    // ฿1000 gross → net ฿934.58 + VAT ฿65.42 = ฿1000 exactly.
    assert.equal(t.netGoodsSatang, 93458);
    assert.equal(t.outputVatSatang, 6542);
    assert.equal(t.netGoodsSatang + t.outputVatSatang, 100000, 'must balance to the gross');
  });

  test('platform fee counts as revenue and is taxed', () => {
    const o = computeTax(baseOrder({ platformFee: 105 }));
    const t = o.taxBreakdown;
    // 105฿ = 10500 satang. Platform quotes VAT-inclusive → net 9813 + VAT 687.
    assert.equal(t.feeAsRevenueSatang, 10500);
    assert.equal(t.feeVatSatang, 687);
    assert.equal(t.feeAsRevenueSatang - t.feeVatSatang, 9813, 'the fee must split cleanly');
    // Net sales = net goods 93458 + shipping net 4673 + fee 10500. Shipping is
    // VAT-inclusive (107฿), so its net part is 4673, not 5000.
    assert.equal(t.netSalesSatang, 93458 + 4673 + 10500);
  });

  test('platform-funded discount is NOT our revenue', () => {
    const withPlat = computeTax(baseOrder({ voucherPlatform: 200 }));
    const without = computeTax(baseOrder());
    // The buyer paid the same gross either way, so net sales must not move.
    assert.equal(withPlat.taxBreakdown.netSalesSatang, without.taxBreakdown.netSalesSatang);
  });

  test('seller voucher reduces revenue', () => {
    const plain = computeTax(baseOrder());
    const discounted = computeTax(baseOrder({ voucherSeller: 100 }));
    assert.ok(
      discounted.taxBreakdown.netSalesSatang < plain.taxBreakdown.netSalesSatang,
      'giving a voucher away must lower net sales'
    );
  });

  test('shipping is excluded from VAT unless the platform charges it', () => {
    const free = computeTax(baseOrder({ shipping: 0 }));
    assert.equal(free.taxBreakdown.shippingVatSatang, 0);

    // 107฿ VAT-inclusive → net 100฿ + VAT 7฿.
    const taxed = computeTax(baseOrder({ shipping: 107 }), { platformVatOnShipping: true });
    assert.equal(taxed.taxBreakdown.shippingVatSatang, 700);
    assert.equal(taxed.taxBreakdown.shippingNetSatang, 10000);
  });
});

describe('computeTax — input side', () => {
  test('input VAT comes from known costs', () => {
    const o = computeTax(baseOrder({ platformFee: 0 }));
    // cost 600฿ = 560.75 net + 39.25 VAT → 56075/107*7 = 3667
    assert.ok(o.taxBreakdown.inputVatSatang > 0, 'a known cost must produce input VAT');
  });

  test('unknown cost yields no input VAT and says so', () => {
    const o = computeTax(
      baseOrder({
        platformFee: 0,
        lines: [{ sku: 'A1', name: 'สินค้า', qty: 1, unitPrice: 1000, costKnown: false }]
      })
    );
    assert.equal(o.taxBreakdown.inputVatSatang, 0);
    assert.equal(o.taxBreakdown.profitSatang, null, 'profit is unknown without cost');
    assert.ok(o.warnings.some((w) => w.includes('ต้นทุน')), 'must warn about the unknown cost');
  });

  test('payable VAT never goes negative', () => {
    const o = computeTax(baseOrder({ gross: 100, platformFee: 0 }));
    assert.ok(o.taxBreakdown.payableVatSatang >= 0);
  });

  test('a discount lowers the claimed input VAT proportionally', () => {
    const plain = computeTax(baseOrder({ voucherSeller: 0 }));
    const cut = computeTax(baseOrder({ voucherSeller: 500 }));
    assert.ok(
      cut.taxBreakdown.inputVatSatang < plain.taxBreakdown.inputVatSatang,
      'a smaller invoice cannot support a bigger tax claim'
    );
  });
});

describe('pp30Line', () => {
  test('produces one line per order with the day in YYYY-MM-DD', () => {
    const o = computeTax(baseOrder({ orderDate: '2026-10-14T03:20:00.000Z' }));
    const line = pp30Line(o);
    assert.equal(line.day, '2026-10-14');
    assert.equal(line.taxableSalesSatang, o.taxBreakdown.netSalesSatang);
    assert.equal(
      line.netPayableVatSatang,
      Math.max(0, line.outputVatSatang - line.inputVatSatang)
    );
  });

  test('refuses to run before tax is computed', () => {
    const o = baseOrder();
    assert.throws(() => pp30Line(o), /computeTax/);
  });
});

describe('profit', () => {
  test('profit subtracts platform fees and seller discounts', () => {
    const plain = computeTax(baseOrder({ platformFee: 0, voucherSeller: 0 }));
    const loaded = computeTax(baseOrder({ platformFee: 100, voucherSeller: 50 }));
    assert.ok(
      loaded.taxBreakdown.profitSatang < plain.taxBreakdown.profitSatang,
      'fees and discounts must reduce profit'
    );
  });

  test('quantity multiplies both price and cost', () => {
    const one = computeTax(
      baseOrder({ platformFee: 0, lines: [{ sku: 'A', qty: 1, unitPrice: 100, costKnown: true, unitCost: 60 }] })
    );
    const three = computeTax(
      baseOrder({ platformFee: 0, lines: [{ sku: 'A', qty: 3, unitPrice: 100, costKnown: true, unitCost: 60 }] })
    );
    assert.equal(three.taxBreakdown.profitSatang, one.taxBreakdown.profitSatang * 3);
  });
});