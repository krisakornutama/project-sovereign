// validate.test.js — a renamed CSV column must fail loudly, not import zeros.

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCsv, assertImportable } from '../src/validate.js';
import { decodeBuffer } from '../src/parsers/csv.js';

const good = [
  'Order ID,Order Time,Status,Buyer Username,Order Amount,Shipping Fee,Shopee Fee,SKU,Product Name,Quantity,Unit Price',
  '2501AAA,2026-10-14 10:00:00,พร้อมจัดส่ง,buk,500,50,49,A1,กาแฟ,2,250'
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'mkt-validate-'));
const write = (name, content) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};

describe('header validation', () => {
  test('a well-formed Shopee export passes', () => {
    const v = validateCsv(good, 'shopee');
    assert.equal(v.ok, true);
    assert.equal(v.missingRequired.length, 0);
    assert.equal(v.missingImportant.length, 0);
  });

  test('a renamed order-number column stops the import', () => {
    // This is the failure that used to import silently with every amount 0.
    const renamed = good.replace('Order ID', 'Order Reference');
    const v = validateCsv(renamed, 'shopee');
    assert.equal(v.ok, false);
    assert.equal(v.missingRequired.length, 1);
    assert.match(v.message, /เลขที่คำสั่งซื้อ/);
    assert.throws(() => assertImportable(renamed, 'shopee'), /โครงสร้างไฟล์ไม่ถูกต้อง/);
  });

  test('a missing amount column is a warning, not a hard stop', () => {
    const noAmount = good.split('\n').map((l, i) => (i === 0 ? l.replace('Order Amount,', '') : l.split(',').filter((_, idx) => idx !== 4).join(','))).join('\n');
    const v = validateCsv(noAmount, 'shopee');
    assert.equal(v.ok, true, 'still importable');
    assert.ok(v.missingImportant.some((m) => m.key === 'gross'));
    assert.match(v.message, /จะเป็น 0/);
  });

  test('unknown columns are listed so they can be told apart from renamed ones', () => {
    // Append to the HEADER line only — appending to the whole file would put the
    // extra names on the data row, where they are not columns at all.
    const [header, ...rest] = good.split('\n');
    const v = validateCsv([header + ',Internal Remark,Mystery Field', ...rest].join('\n'), 'shopee');
    assert.ok(v.unmapped.includes('Internal Remark'));
    assert.ok(v.unmapped.includes('Mystery Field'));
    assert.equal(v.ok, true, 'extra columns must not block the import');
  });

  test('column matching ignores case, spaces and underscores', () => {
    const odd = good.replace('Order Amount', 'order_amount').replace('Order ID', 'ORDER_ID');
    const v = validateCsv(odd, 'shopee');
    assert.equal(v.ok, true);
    assert.equal(v.missingRequired.length, 0);
  });

  test('an empty file is rejected', () => {
    const v = validateCsv('', 'shopee');
    assert.equal(v.ok, false);
    assert.match(v.message, /ไฟล์ว่าง/);
  });

  test('Lazada columns are checked against its own names', () => {
    const lazada = 'Order Number,Status,SKU,Item Name,Quantity,Order Amount\nLA-1,รอจัดส่ง,A1,กาแฟ,1,100';
    assert.equal(validateCsv(lazada, 'lazada').ok, true);

    // Lazada does accept "Order ID" on some exports, so that must pass too.
    assert.equal(validateCsv('Order ID,SKU\nX,A1', 'lazada').ok, true);

    // A name neither platform uses must not slip through.
    const unknown = validateCsv('Transaction Ref,Line Item\nTR-1,A1', 'lazada');
    assert.equal(unknown.ok, false);
    assert.match(unknown.message, /เลขที่คำสั่งซื้อ/);
  });
});

describe('encoding', () => {
  test('reads plain UTF-8 as UTF-8', () => {
    const { text, encoding } = decodeBuffer(Buffer.from(good, 'utf8'));
    assert.equal(encoding, 'utf-8');
    assert.match(text, /พร้อมจัดส่ง/);
  });

  test('decodes Thai Excel output (windows-874) instead of mojibake', () => {
    // Built the way Thai Excel saves: codepage 874, not UTF-8. Read back as
    // UTF-8 this becomes U+FFFD, which is the signal the sniffer keys on.
    const source = 'Order ID,Status,Product Name\nTY-1,พร้อมจัดส่ง,ขนมไทย';
    const buf = Buffer.from(encodeWindows874(source), 'binary');

    // Prove the fixture is actually 874 — otherwise the test proves nothing.
    const asUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    assert.ok(asUtf8.includes('\uFFFD'), 'fixture must not be valid UTF-8');

    const { text, encoding } = decodeBuffer(buf);
    assert.equal(encoding, 'windows-874');
    assert.match(text, /พร้อมจัดส่ง/);
    assert.match(text, /ขนมไทย/);
    assert.equal(validateCsv(text, 'shopee').ok, true, 'the Thai rows must still be usable');
  });

  test('a UTF-8 file keeps its BOM out of the first header name', () => {
    const p = write('bom.csv', '\uFEFF' + good);
    const { text } = decodeBuffer(readFileSync(p));
    const v = validateCsv(text, 'shopee');
    assert.equal(v.ok, true, 'a BOM must not break the Order ID lookup');
  });
});

/**
 * Encode a string into Windows-874 bytes.
 *
 * Node ships the 874 decoder but not the encoder, so the mapping is derived by
 * walking the byte range and reading back what each one means. That keeps the
 * test honest: the fixture is generated by the same table the reader relies on.
 */
function encodeWindows874(str) {
  const map = new Map();
  const decoder = new TextDecoder('windows-874');
  for (let b = 0x80; b <= 0xff; b++) {
    const ch = decoder.decode(Uint8Array.from([b]));
    if (ch && ch !== '\uFFFD' && !map.has(ch)) map.set(ch, b);
  }
  return Array.from(str, (ch) => {
    // Use the 874 byte when there is one — Thai lives at 0xA1-0xFB, so a naive
    // "ASCII stays, everything else becomes ?" turns the whole Thai text into
    // question marks. Only an unmapped character beyond Latin-1 becomes '?'.
    const code = map.has(ch) ? map.get(ch) : ch.charCodeAt(0);
    return String.fromCharCode(code <= 0xff ? code : 0x3f);
  }).join('');
}