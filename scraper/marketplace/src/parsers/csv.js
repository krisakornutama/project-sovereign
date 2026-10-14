// parsers/csv.js — a small CSV reader.
//
// Both platforms export UTF-8 CSV with quoted fields that may contain commas,
// newlines and doubled quotes. Writing this by hand avoids a dependency for the
// whole project just to read two files a week.

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