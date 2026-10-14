// parsers/csv.js — a small CSV reader.
//
// Both platforms export UTF-8 CSV with quoted fields that may contain commas,
// newlines and doubled quotes. Writing this by hand avoids a dependency for the
// whole project just to read two files a week.
//
// Thai sellers export from Excel, which defaults to the Windows-874 (TIS-620)
// codepage rather than UTF-8. A file read as the wrong encoding gives mojibake
// and the SKU column silently matches nothing. decodeBuffer() sniffs for that.

import { readFileSync } from 'node:fs';

/**
 * Detect TIS-620/Windows-874 and decode to a proper JS string.
 *
 * A well-formed UTF-8 file decodes without replacement characters. Thai in
 * Windows-874 read as UTF-8 produces U+FFFD, so its presence means the file is
 * not UTF-8. Windows-874 and TIS-620 differ only in 0x80-0x9F, outside the Thai
 * range this reader handles.
 */
export function decodeBuffer(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('\uFFFD')) return { text: utf8, encoding: 'utf-8' };

  try {
    const thai = new TextDecoder('windows-874').decode(buf);
    if (/[\u0E00-\u0E7F]/.test(thai)) return { text: thai, encoding: 'windows-874' };
  } catch {
    // Decoder unavailable — fall through to whatever we have.
  }
  return { text: utf8, encoding: 'utf-8 (พบอักขระเพี้ยน — ไฟล์อาจไม่ใช่ UTF-8)' };
}

export function readCsvFile(path) {
  const { text, encoding } = decodeBuffer(readFileSync(path));
  return { text, encoding };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Strip a BOM, else the first header name comes back as "﻿Order ID".
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // Last row when the file has no trailing newline.
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Rows -> objects keyed by the header row. */
export function toObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
}

/** Header matching that tolerates spacing and case: "Order ID" ~ "orderid" */
export function pick(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const want = String(name).toLowerCase().replace(/[\s_-]/g, '');
    const hit = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, '') === want);
    if (hit !== undefined) return row[hit];
  }
  return undefined;
}

/** Numbers arrive as "1,234.00" or "" — turn them into a number. */
export function num(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/[,\s฿]/g, ''));
  return Number.isFinite(n) ? n : 0;
}