// ตรวจใบเสร็จโพสต์-ควอนตัม + แฟ้มเอกสารบัญชี — ทั้งหมดในเบราว์เซอร์ (Q-10 · local ล้วน)
// logic ตรวจตรงกับ sovereign-pq-identity/src/receipt.js + accounting.js:
//   bytes ที่ถูกเซ็น = canonical JSON ของแกน {id, issued_at, payload, alg_profile} (เรียงคีย์)
//   Ed25519 = WebCrypto · ML-DSA-44/SLH-DSA = @noble/post-quantum (context "sovereign-pq-receipt/v1")
import { sha256 } from '@noble/hashes/sha2.js';
import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_shake_128s } from '@noble/post-quantum/slh-dsa.js';

const ALG_PROFILE = 'sovereign.ed25519+ml_dsa44.v1';
const ALG_PROFILE_SLH = 'sovereign.ed25519+ml_dsa44+slh_dsa128s.v1';
const PQ_CONTEXT = new TextEncoder().encode('sovereign-pq-receipt/v1');
const ACCOUNTING_FORMAT = 'sovereign.accounting-ledger.v1';
const ACCOUNTING_VERSION = 1;
const ACCOUNTING_HEAD_NULL = '0'.repeat(64);
const ACCOUNTING_DOMAIN = 'sovereign-accounting-chain/v1';

const enc = new TextEncoder();
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256HexOf = (data) => hex(sha256(data));

// Canonical JSON — เรียงคีย์แล้วไม่มีช่องว่าง (เหมือน util.js ทุกบิต)
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

function coreBytes(e) {
  return enc.encode(canonical({ id: e.id, issued_at: e.issued_at, payload: e.payload, alg_profile: e.alg_profile }));
}

// ตรวจใบเสร็จ 1 ใบ — ผลรูปเดียวกับ verifyReceipt ของไลบรารี (ทุกชั้นของโปรไฟล์ต้องผ่าน)
async function verifyReceipt(e) {
  const out = { valid: false, ed25519: null, ml_dsa44: null, slh_dsa128s: null, problems: [] };
  if (!e || typeof e !== 'object') { out.problems.push('ไม่ใช่ object'); return out; }
  if (!e.id || !e.issued_at || e.payload === undefined) { out.problems.push('แกนของใบเสร็จขาด (id/issued_at/payload)'); return out; }
  const triple = e.alg_profile === ALG_PROFILE_SLH;
  if (e.alg_profile && e.alg_profile !== ALG_PROFILE && !triple) out.problems.push('alg_profile ไม่ตรงระบบนี้ (' + e.alg_profile + ')');

  const bytes = coreBytes(e);
  const sigs = e.signatures || {};

  // 1) Ed25519 — WebCrypto (กุญแจสาธารณะฝังในใบ)
  if (!sigs.ed25519?.pk_b64 || !sigs.ed25519?.sig_b64) {
    out.problems.push('ไม่มีลายเซ็น Ed25519');
  } else {
    try {
      // pk_b64 ในใบเสร็จเป็น SPKI DER 44 ไบต์ (เหมือน readEdPub ฝั่ง node:crypto) — ไม่ใช่ raw 32 ไบต์
      const key = await crypto.subtle.importKey('spki', b64ToBytes(sigs.ed25519.pk_b64), { name: 'Ed25519' }, false, ['verify']);
      out.ed25519 = await crypto.subtle.verify({ name: 'Ed25519' }, key, b64ToBytes(sigs.ed25519.sig_b64), bytes);
      if (!out.ed25519) out.problems.push('ลายเซ็น Ed25519 ไม่ตรงข้อมูล');
    } catch (err) {
      out.ed25519 = false;
      out.problems.push('Ed25519 ตรวจไม่สำเร็จ (เบราว์เซอร์อาจไม่รองรับ WebCrypto Ed25519): ' + err.message);
    }
  }

  // 2) ML-DSA-44 (FIPS 204)
  if (!sigs.ml_dsa44?.pk_b64 || !sigs.ml_dsa44?.sig_b64) {
    out.problems.push('ไม่มีลายเซ็น ML-DSA-44');
  } else {
    try {
      const pk = b64ToBytes(sigs.ml_dsa44.pk_b64);
      if (pk.length !== ml_dsa44.lengths.publicKey) {
        out.problems.push('ML-DSA pk ความยาว ' + pk.length + ' ≠ ' + ml_dsa44.lengths.publicKey);
      } else {
        out.ml_dsa44 = ml_dsa44.verify(b64ToBytes(sigs.ml_dsa44.sig_b64), bytes, pk, { context: PQ_CONTEXT });
        if (!out.ml_dsa44) out.problems.push('ลายเซ็น ML-DSA-44 ไม่ตรงข้อมูล');
      }
    } catch (err) { out.problems.push('ML-DSA ตรวจไม่สำเร็จ: ' + err.message); }
  }

  // 3) SLH-DSA-128s (FIPS 205) — เฉพาะโปรไฟล์สามชั้น (ขาด = ใบไม่สมบูรณ์)
  if (triple) {
    if (!sigs.slh_dsa128s?.pk_b64 || !sigs.slh_dsa128s?.sig_b64) {
      out.problems.push('ไม่มีลายเซ็น SLH-DSA-128s');
    } else {
      try {
        const pk = b64ToBytes(sigs.slh_dsa128s.pk_b64);
        if (pk.length !== slh_dsa_shake_128s.lengths.publicKey) {
          out.problems.push('SLH-DSA pk ความยาว ' + pk.length + ' ≠ ' + slh_dsa_shake_128s.lengths.publicKey);
        } else {
          out.slh_dsa128s = slh_dsa_shake_128s.verify(b64ToBytes(sigs.slh_dsa128s.sig_b64), bytes, pk, { context: PQ_CONTEXT });
          if (!out.slh_dsa128s) out.problems.push('ลายเซ็น SLH-DSA-128s ไม่ตรงข้อมูล');
        }
      } catch (err) { out.problems.push('SLH-DSA ตรวจไม่สำเร็จ: ' + err.message); }
    }
  }

  out.valid = out.ed25519 === true && out.ml_dsa44 === true && (triple ? out.slh_dsa128s === true : true);
  return out;
}

// hash หนึ่งบรรทัดของสายแฟ้มบัญชี — H(โดเมน ‖ 0x00 ‖ h_prev ‖ 0x00 ‖ canonical(เนื้อบรรทัด))
function accountingRowHash(head, body) {
  const parts = [enc.encode(ACCOUNTING_DOMAIN), new Uint8Array([0x00]), enc.encode(head), new Uint8Array([0x00]), enc.encode(canonical(body))];
  const b = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { b.set(p, o); o += p.length; }
  return sha256HexOf(b);
}

// ตรวจแฟ้มเอกสารบัญชี (สาย hash + โครง + จำนวน/ยอด) — รูปเดียวกับ verifyAccountingExport ของไลบรารี
function verifyAccountingExport(lines) {
  const problems = [];
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, problems: ['ไม่มีบรรทัดให้ตรวจ'], head: null, docs: 0, total_thb: null };
  const first = lines[0], last = lines[lines.length - 1];
  if (!first || first.line !== 'header') problems.push('บรรทัดแรกไม่ใช่ header');
  if (!last || last.line !== 'footer') problems.push('บรรทัดท้ายไม่ใช่ footer');
  if (first && first.h_prev !== ACCOUNTING_HEAD_NULL) problems.push('หัวสายแรกไม่ผูกจุดเริ่ม (h_prev ผิด)');

  const docs = [];
  let head = ACCOUNTING_HEAD_NULL;
  lines.forEach((l, i) => {
    if (!l || typeof l !== 'object') { problems.push('บรรทัดที่ ' + (i + 1) + ' ไม่ใช่ object'); return; }
    const { h_prev, hash, ...body } = l;
    if (l.h_prev !== head) problems.push('บรรทัดที่ ' + (i + 1) + ' h_prev ไม่ตรงหัวก่อนหน้า — ลำดับถูกสลับ/ตัดทอน');
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) { problems.push('บรรทัดที่ ' + (i + 1) + ' hash หาย/รูปผิด'); return; }
    if (accountingRowHash(l.h_prev, body) !== hash) problems.push('บรรทัดที่ ' + (i + 1) + ' hash ไม่ตรงเนื้อหา (บรรทัดถูกแก้)');
    head = hash;
    if (l.line === 'doc') docs.push(l);
  });

  docs.forEach((d, i) => {
    if (d.seq !== i + 1) problems.push('ใบที่ ' + (i + 1) + ' seq ไม่เรียง (' + String(d.seq) + ')');
    if (!d.receipt_id || !d.issued_at || !d.receipt) { problems.push('ใบที่ ' + (i + 1) + ' ข้อมูลไม่ครบ (receipt_id/issued_at/receipt)'); return; }
    if (d.receipt_id !== d.receipt.id) problems.push('ใบที่ ' + (i + 1) + ' receipt_id ไม่ตรงซองที่ฝัง');
    if (d.issued_at !== d.receipt.issued_at) problems.push('ใบที่ ' + (i + 1) + ' issued_at ไม่ตรงซองที่ฝัง');
    if (d.receipt_sha256 !== undefined) {
      if (!/^[0-9a-f]{64}$/.test(String(d.receipt_sha256))) problems.push('ใบที่ ' + (i + 1) + ' receipt_sha256 รูปผิด');
      else if (d.receipt_sha256 !== sha256HexOf(enc.encode(canonical(d.receipt)))) problems.push('ใบที่ ' + (i + 1) + ' receipt_sha256 ไม่ตรงซองที่ฝัง (ซองถูกสลับ/แก้)');
    }
  });

  if (first && first.format !== ACCOUNTING_FORMAT) problems.push('format ไม่ใช่แฟ้มเอกสารบัญชีของระบบนี้');
  if (first && first.version !== ACCOUNTING_VERSION) problems.push('version ไม่ตรงรูปแบบแฟ้ม (' + first.version + ' เทียบ ' + ACCOUNTING_VERSION + ')');
  const n = docs.length;
  if (first && first.receipts_count !== n) problems.push('header ประกาศ ' + first.receipts_count + ' ใบ แต่มีเอกสารจริง ' + n + ' ใบ');
  if (last && last.line === 'footer') {
    if (last.receipts_count !== n) problems.push('footer ประกาศ ' + last.receipts_count + ' ใบ แต่มีเอกสารจริง ' + n + ' ใบ');
    if (last.total_thb !== totalThbOf(docs.map((d) => d.receipt))) problems.push('footer ยอดรวมไม่ตรงผลรวมของเอกสารในแฟ้ม');
  }
  return { ok: problems.length === 0, problems, head: last && last.hash ? last.hash : head, docs: n, total_thb: last && last.line === 'footer' ? last.total_thb : null };
}

// ยอดรวมบัญชี — ทุกใบต้องมี payload.total_thb เป็นตัวเลข มิฉะนั้น null (ไม่เดา)
function totalThbOf(envelopes) {
  if (!Array.isArray(envelopes) || envelopes.length === 0) return 0;
  let sum = 0;
  for (const e of envelopes) {
    const t = e && e.payload ? e.payload.total_thb : undefined;
    if (typeof t !== 'number' || !Number.isFinite(t)) return null;
    sum += t;
  }
  return Number(sum.toFixed(2));
}

// ── UI ──
const results = document.getElementById('results');
const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const fmtThb = (v) => v === null ? '<span class="small">ไม่รวมอัตโนมัติ (มีใบไม่มียอด)</span>' : '฿' + Number(v).toFixed(2);
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString('th-TH', { hour12: false }); } catch { return String(iso); } };
function badge(ok, label) {
  if (ok === true) return '<span class="badge ok">✓ ' + label + '</span>';
  if (ok === false) return '<span class="badge bad">✗ ' + label + '</span>';
  return '<span class="badge na">– ' + label + '</span>';
}
function problemsList(p) { return p.length ? '<ul class="problems">' + p.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''; }
function lanes(out, triple) {
  const parts = [
    '<span class="layer ' + (out.ed25519 ? 'ok' : 'bad') + '">Ed25519 ' + (out.ed25519 ? '✓' : '✗') + '</span>',
    '<span class="layer ' + (out.ml_dsa44 ? 'ok' : 'bad') + '">ML-DSA-44 ' + (out.ml_dsa44 ? '✓' : '✗') + '</span>',
  ];
  if (triple) parts.push('<span class="layer ' + (out.slh_dsa128s ? 'ok' : 'bad') + '">SLH-DSA-128s ' + (out.slh_dsa128s ? '✓' : '✗') + '</span>');
  return '<div class="lane">' + parts.join('') + '</div>';
}

function cardReceipt(e, index) {
  const triple = e && e.alg_profile === ALG_PROFILE_SLH;
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.innerHTML = '<h2>ใบเสร็จ' + (index ? ' #' + index : '') + ' <span id="st' + index + '"></span></h2>';
  results.appendChild(wrap);
  return verifyReceipt(e).then((out) => {
    const head = wrap.querySelector('h2');
    head.innerHTML = 'ใบเสร็จ' + (index ? ' #' + index : '') + ' ' + badge(out.valid, out.valid ? 'ผ่านทุกชั้น' : 'ไม่ผ่าน');
    const rows = [
      ['หมายเลขใบ', esc(e.id || '—')],
      ['เวลาออก', esc(e.issued_at ? fmtWhen(e.issued_at) : '—')],
      ['โปรไฟล์', esc(e.alg_profile || '—')],
      ['ยอด (payload.total_thb)', typeof e.payload?.total_thb === 'number' ? '฿' + e.payload.total_thb.toFixed(2) : '<span class="small">ไม่มียอด</span>'],
      ['sha256(canonical ใบ)', sha256HexOf(enc.encode(canonical(e)))],
    ].map(([k, v]) => '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>').join('');
    wrap.innerHTML += rows + lanes(out, triple) + problemsList(out.problems) + details(e);
  });
}

function details(e) {
  return '<details><summary>ดูใบเสร็จ (payload + ลายเซ็นทุกชั้น)</summary><pre>' + esc(JSON.stringify(e, null, 2)).slice(0, 4000) + '</pre></details>';
}

async function handleFile(file) {
  results.innerHTML = '';
  const text = await file.text();
  const isJsonl = /\.jsonl$/i.test(file.name) || (file.name.endsWith('.json') === false && text.trimStart().startsWith('{') && text.includes('\n{'));
  try {
    if (isJsonl) return await handleAccounting(file.name, text);
    const e = JSON.parse(text);
    if (Array.isArray(e)) return await handleAccounting(file.name, JSON.stringify(e.map((x) => JSON.stringify(x)).join('\n')));
    return await cardReceipt(e, 0);
  } catch (err) {
    // .json ที่เนื้อจริงเป็น JSONL (หนึ่ง object ต่อบรรทัด) — ลองตรวจเป็นแฟ้มบัญชีต่อก่อนโยน error
    const ls = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (ls.length > 1 && ls.every((l) => l.startsWith('{') && l.endsWith('}'))) return await handleAccounting(file.name, ls.join('\n'));
    results.innerHTML = '<div class="summary bad">✗ อ่านแฟ้มไม่เป็น: ' + esc(err.message) + '</div>';
  }
}

async function handleAccounting(name, text) {
  let lines;
  try {
    lines = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
  } catch (err) {
    results.innerHTML = '<div class="summary bad">✗ แฟ้มไม่ใช่ JSONL ทุกบรรทัด: ' + esc(err.message) + '</div>';
    return;
  }
  if (lines.length === 0) { results.innerHTML = '<div class="summary bad">✗ แฟ้มว่าง</div>'; return; }
  if (lines[0].line !== 'header') {
    // ใบเสร็จหลายใบใน array (ไม่ใช่แฟ้มบัญชี)
    results.innerHTML = '<div class="summary bad">✗ แฟ้มไม่ใช่เอกสารบัญชี (บรรทัดแรกไม่ใช่ header แต่เป็น ' + esc(lines[0].line || 'object') + ')</div>';
    return;
  }
  const sum = document.createElement('div');
  sum.className = 'summary';
  sum.innerHTML = '<div class="small">' + esc(name) + ' · กำลังตรวจ…</div>';
  results.appendChild(sum);
  const v = verifyAccountingExport(lines);
  const sigJobs = [];
  const cards = [];
  lines.forEach((l, i) => {
    if (l.line === 'doc' && l.receipt) {
      const card = document.createElement('div');
      card.className = 'card';
      results.appendChild(card);
      cards.push({ card, doc: l, n: cards.length + 1 });
      sigJobs.push(cardReceiptInto(card, l, cards.length));
    }
  });
  const sigs = await Promise.all(sigJobs);
  const sigOk = sigs.filter((s) => s.valid === true).length;
  const sigBad = sigs.length - sigOk;
  const allOk = v.ok && sigBad === 0;
  sum.className = 'summary ' + (allOk ? 'ok' : 'bad');
  sum.innerHTML =
    (allOk ? '✓ <strong>แฟ้มบัญชีผ่านครบ</strong>' : '✗ <strong>แฟ้มบัญชีไม่ผ่าน</strong>') +
    ' — ' + v.docs + ' ใบ · head <code>' + esc(v.head ? v.head.slice(0, 16) + '…' : '(ไม่มี)') + '</code> · ยอดรวม: ' + fmtThb(v.total_thb) +
    '<br><span class="small">ลายเซ็นซองฝังตรวจใหม่: ' + sigOk + '/' + sigs.length + ' ใบผ่านครบทุกชั้น</span>' + problemsList(v.problems);
}

async function cardReceiptInto(card, doc, n) {
  const triple = doc.receipt && doc.receipt.alg_profile === ALG_PROFILE_SLH;
  const out = await verifyReceipt(doc.receipt);
  const shaOk = !doc.receipt_sha256 || doc.receipt_sha256 === sha256HexOf(enc.encode(canonical(doc.receipt)));
  card.innerHTML = '<h2>เอกสาร #' + n + ' · ' + esc(doc.receipt_id || '') + ' ' + badge(out.valid, out.valid ? 'ผ่าน' : 'ไม่ผ่าน') + (shaOk ? '' : ' <span class="badge bad">✗ receipt_sha256</span>') + '</h2>' +
    '<div class="row"><span class="k">seq / เวลาออก</span><span class="v">' + esc(String(doc.seq ?? '—')) + ' · ' + esc(doc.issued_at ? fmtWhen(doc.issued_at) : '—') + '</span></div>' +
    '<div class="row"><span class="k">ยอด</span><span class="v">' + (typeof doc.receipt?.payload?.total_thb === 'number' ? '฿' + doc.receipt.payload.total_thb.toFixed(2) : '<span class="small">ไม่มียอด</span>') + '</span></div>' +
    '<div class="row"><span class="k">receipt_sha256</span><span class="v">' + esc(String(doc.receipt_sha256 || '—')) + '</span></div>' +
    lanes(out, triple) + problemsList(out.problems) + details(doc.receipt);
  return out;
}

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (ev) => {
  ev.preventDefault(); drop.classList.remove('over');
  if (ev.dataTransfer.files[0]) handleFile(ev.dataTransfer.files[0]);
});

// hook ทดสอบเท่านั้น (ผู้ใช้ทั่วไปไม่ได้ใช้) — ให้เทสอัตโนมัติโทรตรวจด้วยข้อความแฟ้มแทน file chooser
window.__sovVerifyTest = { verifyReceipt, verifyAccountingExport, canonical, totalThbOf, handleText: (name, text) => handleFile(new File([text], name)) };
