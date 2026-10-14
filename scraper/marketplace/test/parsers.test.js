// parsers.test.js — folding multi-row exports into whole orders.
//
// Shopee and Lazada both export one PRODUCT PER ROW. Reading that file as
// one-order-per-row doubles revenue and triple-counts fees, so these tests pin
// the folding behaviour down.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toObjects, pick, num } from '../src/parsers/csv.js';
import { parseShopeeCsv } from '../src/parsers/shopee.js';
import { parseLazadaCsv } from '../src/parsers/lazada.js';

describe('csv reader', () => {
  test('handles quoted fields containing commas', () => {
    const rows = parseCsv('a,b\n"x,1",y');
    assert.deepEqual(rows, [['a', 'b'], ['x,1', 'y']]);
  });

  test('handles escaped double quotes', () => {
    const rows = parseCsv('a\n"he said ""hi"""');
    assert.equal(rows[1][0], 'he said "hi"');
  });

  test('handles CRLF and a missing trailing newline', () => {
    const rows = parseCsv('a,b\r\n1,2');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['1', '2']);
  });

  test('strips a UTF-8 BOM from the first header', () => {
    const rows = parseCsv('﻿Order ID\n2501AAA');
    assert.equal(rows[0][0], 'Order ID');
  });

  test('skips fully blank rows', () => {
    assert.equal(parseCsv('a,b\n1,2\n\n\n3,4').length, 3);
  });

  test('header matching ignores spaces, dashes and case', () => {
    const row = { 'Order ID': 'x', 'Seller-SKU': 'y' };
    assert.equal(pick(row, 'order id'), 'x');
    assert.equal(pick(row, 'Order_ID'), 'x');
    assert.equal(pick(row, 'seller sku'), 'y');
    assert.equal(pick(row, 'missing'), undefined);
  });

  test('num strips thousands separators and baht signs', () => {
    assert.equal(num('1,234.50'), 1234.5);
    assert.equal(num('฿99.00'), 99);
    assert.equal(num(''), 0);
    assert.equal(num(undefined), 0);
    assert.equal(num('abc'), 0);
  });
});

const shopeeCsv = [
  'Order ID,Order Time,Status,Buyer Username,Order Amount,Shipping Fee,Shopee Fee,Seller Voucher,SKU,Product Name,Quantity,Unit Price',
  '2501AAA,2026-10-14 10:00:00,พร้อมจัดส่ง,buk,500,50,49,0,A1,กาแฟ,2,250',
  '2501AAA,2026-10-14 10:00:00,พร้อมจัดส่ง,buk,500,50,49,0,B2,ขนมปัง,1,500',
  '2501BBB,2026-10-14 11:00:00,พร้อมจัดส่ง,som,300,40,29,0,A1,กาแฟ,1,300'
].join('\n');

describe('shopee parser', () => {
  test('folds repeated order numbers into one order', () => {
    const orders = parseShopeeCsv(shopeeCsv);
    assert.equal(orders.length, 2, 'two distinct orders');
    assert.equal(orders.find((o) => o.orderNo === '2501AAA').lines.length, 2);
  });

  test('takes the order total once, never sums repeated rows', () => {
    const o = parseShopeeCsv(shopeeCsv).find((x) => x.orderNo === '2501AAA');
    // 500฿ appears on both rows; summing would say 1000฿.
    assert.equal(o.grossSatang, 50000);
  });

  test('takes the platform fee once', () => {
    const o = parseShopeeCsv(shopeeCsv).find((x) => x.orderNo === '2501AAA');
    assert.equal(o.platformFeeSatang, 4900);
  });

  test('maps the Thai status', () => {
    const o = parseShopeeCsv(shopeeCsv)[0];
    assert.equal(o.status, 'READY_TO_SHIP');
    assert.equal(o.channel, 'SHOPEE');
  });

  test('survives a quoted comma without shifting columns', () => {
    const csv = [
      'Order ID,Status,Buyer Username,Order Amount,SKU,Product Name,Quantity,Unit Price',
      '2503DDD,พร้อมจัดส่ง,"buyer, nickname",250,A1,กาแฟ,1,250'
    ].join('\n');
    const o = parseShopeeCsv(csv)[0];
    assert.equal(o.orderNo, '2503DDD');
    assert.equal(o.grossSatang, 25000, 'the quoted comma must not shift the amount column');
    assert.equal(o.lines.length, 1);
    assert.equal(o.lines[0].sku, 'A1');
  });

  test('maps cancelled orders', () => {
    const cancelled = parseShopeeCsv(
      'Order ID,Status,Order Amount,SKU,Quantity\n2502CCC,ยกเลิก,100,A1,1'
    );
    assert.equal(cancelled[0].status, 'CANCELLED');
  });
});

const lazadaCsv = [
  'Order Number,Order Date,Status,Buyer Name,Order Amount,Shipping Fee,Fees,Seller Discount,Platform Discount,SKU,Product Name,Quantity,Price',
  'LA-001,2026-10-14T09:00:00Z,รอจัดส่ง,buyer,800,60,80,0,20,A1,กาแฟ,2,400',
  'LA-001,2026-10-14T09:00:00Z,รอจัดส่ง,buyer,800,60,80,0,20,C3,นม,1,800',
  'LA-002,2026-10-14T10:00:00Z,สำเร็จ,buyer2,250,45,25,10,0,A1,กาแฟ,1,250'
].join('\n');

describe('lazada parser', () => {
  test('folds rows per order', () => {
    const orders = parseLazadaCsv(lazadaCsv);
    assert.equal(orders.length, 2);
    assert.equal(orders.find((o) => o.orderNo === 'LA-001').lines.length, 2);
  });

  test('keeps seller and platform discounts apart', () => {
    const o = parseLazadaCsv(lazadaCsv).find((x) => x.orderNo === 'LA-002');
    assert.equal(o.voucherSellerSatang, 1000);
    assert.equal(o.discountPlatformSatang, 0);

    const first = parseLazadaCsv(lazadaCsv).find((x) => x.orderNo === 'LA-001');
    assert.equal(first.discountPlatformSatang, 2000, 'platform-funded must not count as our discount');
  });

  test('does not sum the order amount across rows', () => {
    const o = parseLazadaCsv(lazadaCsv).find((x) => x.orderNo === 'LA-001');
    assert.equal(o.grossSatang, 80000);
  });

  test('maps the Thai status', () => {
    const o = parseLazadaCsv(lazadaCsv).find((x) => x.orderNo === 'LA-002');
    assert.equal(o.status, 'DELIVERED');
  });
});

describe('dates', () => {
  test('normalises "Y-m-d H:i:s" to a sortable ISO string', () => {
    const o = parseShopeeCsv(shopeeCsv)[0];
    assert.match(o.orderDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('keeps an already-ISO date usable', () => {
    const o = parseLazadaCsv(lazadaCsv)[0];
    assert.equal(o.orderDate.slice(0, 10), '2026-10-14');
  });
});