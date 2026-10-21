/**
 * Web App Laporan Produksi QA  •  PT. Takai Seiki Indonesia
 *
 * Semua kode ada di file ini saja (tidak perlu file HTML terpisah).
 *
 * Alur:
 *  1. Member mengirim laporan (banyak part dan lost time sekaligus).
 *     Kiriman masuk ke tab "Antrian Validasi" dengan status Menunggu.
 *  2. Leader membuka halaman leader (link web app + ?page=leader),
 *     masuk dengan nama dan PIN dari tab "Leader", lalu Setujui / Tolak.
 *  3. Kiriman yang disetujui ditulis ke "Input - Production" (satu baris
 *     per part) dan "Input - Lost Time" (satu baris per lost time),
 *     sehingga Dashboard dan semua Report ikut terhitung.
 *
 * Daftar member, kategori, part, MC, jenis NG dan jenis lost time dibaca
 * langsung dari tab "Master Data" setiap kali web app dibuka.
 *
 * Riwayat versi (tampil di bawah judul form, naikkan setiap ada perubahan kode):
 *  v1.6  21 Okt 2026  API JSON (doPost) untuk tampilan baru di Vercel: login NIK + PIN
 *                     dari tab "Users", master, kirim, antrian, approve/reject, data report.
 *  v1.5  21 Okt 2026  Riwayat 7 hari & edit kiriman oleh member, edit oleh leader,
 *                     lost time harian otomatis (5S, Briefing Pagi, Input Laporan),
 *                     perbaiki & kirim ulang kiriman yang ditolak.
 *  v1.4  20 Okt 2026  Form lebih cepat dibuka, pilihan MC per part, grup lost time.
 */
const APP_VERSION = 'v1.6 • 21 Okt 2026';

const SHEET_MASTER = 'Master Data';
const SHEET_PROD = 'Input - Production';
const SHEET_LT = 'Input - Lost Time';
const SHEET_QUEUE = 'Antrian Validasi';
const SHEET_LEADER = 'Leader';
const SHEET_USERS = 'Users';
const FIRST_DATA_ROW = 7;
const PROD_WIDTH = 22;   // kolom B..W (kolom input)
const LT_WIDTH = 5;      // kolom B..F
const QUEUE_HEADERS = ['ID', 'Waktu Kirim', 'Tanggal', 'Member', 'Jumlah Part', 'Total Qty',
  'Lost Time (menit)', 'Status', 'Leader', 'Waktu Validasi', 'Catatan Leader', 'Data (jangan diubah)'];
const ST_WAIT = 'Menunggu', ST_OK = 'Disetujui', ST_NO = 'Ditolak';

function doGet(e) {
  // Data Master & URL langsung disisipkan ke halaman, supaya form tidak perlu
  // menunggu panggilan server tambahan saat pertama dibuka.
  let boot = { page: (e && e.parameter && e.parameter.page) || '', url: '' };
  try { boot.url = ScriptApp.getService().getUrl(); boot.m = getMasterData(); } catch (err) {}
  const json = JSON.stringify(boot).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(PAGE_HTML.replace('%%VERSI%%', APP_VERSION).replace('<head>', '<head><script>window.BOOT=' + json + ';</script>'))
    .setTitle('Laporan Produksi QA • Takai')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Laporan QA')
    .addItem('Siapkan tab Antrian Validasi & Leader', 'siapkanTab')
    .addItem('Buat API key untuk Vercel', 'buatApiKey')
    .addToUi();
}

function ss_() {
  return SpreadsheetApp.getActive() ||
    SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SS_ID'));
}

/* ---------- Tab pendukung ---------- */

function siapkanTab() {
  queueSheet_();
  leaderSheet_();
}

function queueSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_QUEUE);
  if (!sh) {
    sh = ss.insertSheet(SHEET_QUEUE);
    sh.getRange(1, 1, 1, QUEUE_HEADERS.length).setValues([QUEUE_HEADERS])
      .setFontWeight('bold').setBackground('#16181D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('dd-mmm-yy hh:mm');
    sh.getRange('C:C').setNumberFormat('dd-mmm-yy');
    sh.getRange('J:J').setNumberFormat('dd-mmm-yy hh:mm');
    sh.setColumnWidth(12, 120);
  }
  return sh;
}

function leaderSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_LEADER);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LEADER);
    sh.getRange(1, 1, 1, 3).setValues([['Nama Leader', 'PIN', 'Keterangan']])
      .setFontWeight('bold').setBackground('#16181D').setFontColor('#FFFFFF');
    sh.getRange('B:B').setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leaders_() {
  const sh = leaderSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getDisplayValues()
    .filter(r => r[0] && r[1]).map(r => ({ name: String(r[0]).trim(), pin: String(r[1]).trim() }));
}

function cekLeader_(name, pin) {
  const ok = leaders_().some(l => l.name === name && l.pin === String(pin || '').trim());
  if (!ok) throw new Error('Nama leader atau PIN salah.');
}

/* ---------- Data untuk web app ---------- */

const MD_CACHE = 'master-data-v3';

/** Simple trigger: cache Master Data dikosongkan begitu Master Data / Leader diedit. */
function onEdit(e) {
  const n = e && e.range && e.range.getSheet().getName();
  if (n === SHEET_MASTER || n === SHEET_LEADER) CacheService.getScriptCache().remove(MD_CACHE);
}

/** Master Data disimpan di cache 10 menit, jadi form terbuka lebih cepat. */
function getMasterData() {
  const ss = ss_();
  const cache = CacheService.getScriptCache();
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const hit = cache.get(MD_CACHE);
  if (hit) { const m = JSON.parse(hit); m.today = today; return m; }
  const m = bacaMasterData_(ss);
  m.today = today;
  const str = JSON.stringify(m);
  if (str.length < 90000) cache.put(MD_CACHE, str, 600);
  return m;
}

function bacaMasterData_(ss) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SS_ID') !== ss.getId()) props.setProperty('SS_ID', ss.getId());
  const sh = ss.getSheetByName(SHEET_MASTER);
  const last = sh.getLastRow();
  const vals = (a1) => sh.getRange(a1 + last).getDisplayValues();
  const aktif = (s) => s !== 'Inactive' && s !== 'Tidak Aktif';

  const members = vals('C7:D').filter(r => r[0] && aktif(r[1])).map(r => r[0]);

  const pCol = sh.getRange('P1:Q' + last).getDisplayValues();
  const categories = [];
  for (let i = 6; i < pCol.length && pCol[i][0] && pCol[i][0] !== 'Lost Time Type'; i++) {
    categories.push({ name: pCol[i][0], process: pCol[i][1], parts: [], machines: [], ng: [] });
  }
  const lostTypes = [], lostGroups = {};
  const lt = pCol.findIndex(r => r[0] === 'Lost Time Type');
  if (lt >= 0) for (let i = lt + 1; i < pCol.length && pCol[i][0]; i++) {
    lostTypes.push(pCol[i][0]);
    if (pCol[i][1]) lostGroups[pCol[i][0]] = pCol[i][1];
  }

  const byName = {};
  categories.forEach(c => byName[c.name] = c);

  const partIdx = {};
  for (const r of vals('G7:K')) {
    const [cat, , part, type] = r;
    const c = byName[cat];
    if (!c || !part) continue;
    const key = cat + '|' + part;
    if (!partIdx[key]) { partIdx[key] = { name: part, types: [] }; c.parts.push(partIdx[key]); }
    if (type && !partIdx[key].types.includes(type)) partIdx[key].types.push(type);
  }

  // Kolom tabel mesin & NG dicari dari judul di baris 6, jadi aman bila kolom disisipkan.
  const head = sh.getRange(6, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const col = (name, from) => head.indexOf(name, from || 0);
  const mcCol = col('MC No');
  const block = (c0, c1, r1) => sh.getRange(7, c0 + 1, (r1 || last) - 6, c1 - c0 + 1).getDisplayValues();
  if (mcCol > 0) {
    const stCol = col('Status', mcCol), lnCol = col('Line', mcCol), mainCol = col('Part utama', mcCol), altCol = col('Bisa ganti ke', mcCol);
    const lastMc = Math.max(stCol, lnCol, mainCol, altCol);
    for (const r of block(mcCol - 1, lastMc)) {
      const cat = r[0], mc = r[1], g = (c) => c > 0 ? String(r[c - mcCol + 1] || '').trim() : '';
      if (!byName[cat] || !mc || !aktif(g(stCol))) continue;
      byName[cat].machines.push(mc);
      (byName[cat].mcInfo = byName[cat].mcInfo || {})[mc] = { line: g(lnCol), main: g(mainCol), alt: g(altCol) };
    }
  }

  const ngNames = {};
  const codeCol = col('Code');
  if (codeCol > 0) for (const r of block(codeCol, codeCol + 2, 26)) {
    if (r[1]) (ngNames[r[1]] = ngNames[r[1]] || []).push(r[2]);
  }
  const grpCol = col('NG Group', codeCol + 2);
  if (grpCol > 0) for (const r of block(grpCol - 1, grpCol, 20)) {
    if (byName[r[0]]) { byName[r[0]].ngGroup = r[1]; byName[r[0]].ng = ngNames[r[1]] || []; }
  }

  const setting = (label, def) => {
    const row = sh.getRange('S7:T20').getValues().find(r => String(r[0]).indexOf(label) === 0);
    return row && row[1] !== '' ? Number(row[1]) : def;
  };

  return {
    members, categories, lostTypes, lostGroups,
    leaders: leaders_().map(l => l.name),
    normalMin: setting('Normal working time', 480),
    otLimitHrs: setting('OT limit', 4),
    today: Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd')
  };
}

/** Ringkasan laporan member pada tanggal itu: baris yang sudah masuk + status kiriman. */
function cekLaporan(dateStr, member) {
  if (!dateStr || !member) return { prod: 0, lt: 0, subs: [] };
  const ss = ss_();
  const tz = ss.getSpreadsheetTimeZone();
  const count = (name) => {
    const sh = ss.getSheetByName(name);
    const n = sh.getLastRow() - FIRST_DATA_ROW + 1;
    if (n < 1) return 0;
    return sh.getRange(FIRST_DATA_ROW, 2, n, 2).getValues().filter(r =>
      r[1] === member && r[0] instanceof Date && Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') === dateStr).length;
  };
  const subs = bacaAntrian_().filter(s => s.date === dateStr && s.member === member)
    .map(s => ({ id: s.id, status: s.status, sent: s.sent, parts: s.parts, note: s.note, leader: s.leader,
      items: s.status === ST_NO ? s.items : [], lostTimes: s.status === ST_NO ? s.lostTimes : [] }));
  return { prod: count(SHEET_PROD), lt: count(SHEET_LT), subs };
}

/* ---------- Kirim laporan (masuk antrian) ---------- */

function bangunBaris_(payload, m) {
  const p = String(payload.date || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) throw new Error('Tanggal belum diisi.');
  if (!m.members.includes(payload.member)) throw new Error('Nama member tidak ada di Master Data.');
  const items = payload.items || [];
  const lost = payload.lostTimes || [];
  if (!items.length && !lost.length) throw new Error('Belum ada part atau lost time yang diisi.');

  const cats = {};
  m.categories.forEach(c => cats[c.name] = c);
  const num = (v) => (v === '' || v === null || v === undefined) ? '' : Number(v);
  const txt = (v) => (v === null || v === undefined) ? '' : String(v).trim();
  const dateFormula = '=DATE(' + p[0] + ',' + p[1] + ',' + p[2] + ')';

  const prodRows = items.map((it, i) => {
    const c = cats[it.category];
    if (!c) throw new Error('Part #' + (i + 1) + ': kategori tidak dikenal.');
    if (!c.parts.some(x => x.name === it.part)) throw new Error('Part #' + (i + 1) + ': part tidak ada di kategori ' + c.name + '.');
    const ng = [];
    for (let k = 0; k < 10; k++) ng.push(num((it.ng || [])[k]));
    return [dateFormula, payload.member, c.name, it.part, txt(it.type),
      num(it.normalQty), num(it.normalMin), num(it.otQty), num(it.otMin),
      txt(it.lot), txt(it.oiban), txt(it.mc)].concat(ng);
  });
  const ltRows = lost.map((l, i) => {
    if (!m.lostTypes.includes(l.type)) throw new Error('Lost time #' + (i + 1) + ': jenis tidak dikenal.');
    return [dateFormula, payload.member, l.type, num(l.minutes), txt(l.remarks)];
  });
  return { prodRows, ltRows };
}

function submitReport(payload) {
  const m = getMasterData();
  const rows = bangunBaris_(payload, m);   // validasi sekarang, tulis ke Input setelah disetujui
  const items = payload.items || [], lost = payload.lostTimes || [];
  const n = (v) => Number(v) || 0;
  const totalQty = items.reduce((a, it) => a + n(it.normalQty) + n(it.otQty), 0);
  const ltMin = lost.reduce((a, l) => a + n(l.minutes), 0);
  const p = payload.date.split('-').map(Number);
  const id = 'QA' + Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'yyMMddHHmmss') +
    Math.floor(Math.random() * 90 + 10);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = queueSheet_();
    const rec = { date: payload.date, member: payload.member, items, lostTimes: lost };
    if (payload.meta) rec.meta = payload.meta;   // dari web Vercel: peringatan, perlu dicek, pengirim
    const data = JSON.stringify(rec);
    if (payload.replaceId) {
      // Member mengedit kiriman sendiri yang masih Menunggu: baris lama diganti, bukan ditambah.
      const s = bacaAntrian_().find(x => x.id === payload.replaceId);
      if (!s || s.member !== payload.member) throw new Error('Kiriman yang diedit tidak ditemukan.');
      if (s.status !== ST_WAIT) throw new Error('Kiriman ini sudah ' + s.status.toLowerCase() + ' leader, jadi tidak bisa diedit lagi.');
      sh.getRange(s.row, 2, 1, 6).setValues([[new Date(), new Date(p[0], p[1] - 1, p[2]), payload.member, items.length, totalQty, ltMin]]);
      sh.getRange(s.row, 11, 1, 2).setValues([['Diedit member', data]]);
      return { id: s.id, prod: rows.prodRows.length, lt: rows.ltRows.length, pending: true, replaced: true };
    }
    sh.appendRow([id, new Date(), new Date(p[0], p[1] - 1, p[2]), payload.member, items.length, totalQty,
      ltMin, ST_WAIT, '', '', '', data]);
  } finally {
    lock.releaseLock();
  }
  return { id: id, prod: rows.prodRows.length, lt: rows.ltRows.length, pending: true };
}

/** Riwayat kiriman member 7 hari terakhir (terbaru dulu). */
function riwayatMember(member) {
  if (!member) return [];
  const tz = ss_().getSpreadsheetTimeZone();
  const batas = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), tz, 'yyyy-MM-dd');
  return bacaAntrian_().filter(s => s.member === member && s.date >= batas)
    .sort((a, b) => (a.date === b.date ? (a.sent < b.sent ? 1 : -1) : (a.date < b.date ? 1 : -1)))
    .slice(0, 40)
    .map(s => ({ id: s.id, date: s.date, sent: s.sent, status: s.status, qty: s.qty, ltMin: s.ltMin,
      note: s.note, leader: s.leader, items: s.items, lostTimes: s.lostTimes }));
}

/* ---------- Halaman leader ---------- */

function bacaAntrian_() {
  const sh = queueSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = ss_().getSpreadsheetTimeZone();
  const fmt = (d, f) => d instanceof Date ? Utilities.formatDate(d, tz, f) : String(d || '');
  return sh.getRange(2, 1, n, QUEUE_HEADERS.length).getValues().map((r, i) => {
    let data = {};
    try { data = JSON.parse(r[11] || '{}'); } catch (e) {}
    return {
      row: i + 2, id: String(r[0]), sent: fmt(r[1], 'yyyy-MM-dd HH:mm'),
      date: data.date || fmt(r[2], 'yyyy-MM-dd'), member: String(r[3]), parts: Number(r[4]) || 0,
      qty: Number(r[5]) || 0, ltMin: Number(r[6]) || 0, status: String(r[7] || ST_WAIT),
      leader: String(r[8] || ''), decided: fmt(r[9], 'yyyy-MM-dd HH:mm'), note: String(r[10] || ''),
      items: data.items || [], lostTimes: data.lostTimes || [], edited: data.editedBy || '',
      meta: data.meta || null
    };
  }).filter(s => s.id);
}

function leaderLogin(name, pin) {
  cekLeader_(name, pin);
  return { name: name };
}

/** status: Menunggu | Disetujui | Ditolak. dateStr opsional (yyyy-MM-dd). */
function getAntrian(name, pin, status, dateStr) {
  cekLeader_(name, pin);
  const all = bacaAntrian_();
  const counts = { [ST_WAIT]: 0, [ST_OK]: 0, [ST_NO]: 0 };
  all.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
  let list = all.filter(s => s.status === status && (!dateStr || s.date === dateStr));
  list.sort((a, b) => status === ST_WAIT ? (a.sent < b.sent ? -1 : 1) : (a.decided > b.decided ? -1 : 1));
  if (status !== ST_WAIT) list = list.slice(0, 100);
  return { counts, list: list.map(s => { delete s.row; return s; }) };
}

/** action: 'ok' atau 'no'. ids: daftar ID kiriman. */
function putuskan(name, pin, ids, action, note) {
  cekLeader_(name, pin);
  return putuskan_(name, ids, action, note);
}

/** Dipakai halaman leader lama (dengan PIN) dan API Vercel (leader sudah login di Vercel). */
function putuskan_(name, ids, action, note) {
  if (action === 'no' && !String(note || '').trim()) throw new Error('Isi alasan penolakan.');
  const m = action === 'ok' ? getMasterData() : null;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const hasil = { ok: 0, skip: 0, errors: [], detail: [] };
  try {
    const sh = queueSheet_();
    const ss = ss_();
    const byId = {};
    bacaAntrian_().forEach(s => byId[s.id] = s);
    for (const id of ids) {
      const s = byId[id];
      if (!s || s.status !== ST_WAIT) {
        hasil.skip++;
        hasil.detail.push({ id, ok: false, message: s ? 'Sudah diputuskan sebelumnya.' : 'Kiriman tidak ditemukan.' });
        continue;
      }
      if (action === 'ok') {
        try {
          const rows = bangunBaris_({ date: s.date, member: s.member, items: s.items, lostTimes: s.lostTimes }, m);
          if (rows.prodRows.length) tulis_(ss.getSheetByName(SHEET_PROD), rows.prodRows, PROD_WIDTH);
          if (rows.ltRows.length) tulis_(ss.getSheetByName(SHEET_LT), rows.ltRows, LT_WIDTH);
        } catch (e) {
          hasil.errors.push(s.member + ': ' + e.message);
          hasil.detail.push({ id, ok: false, message: e.message });
          continue;
        }
      }
      sh.getRange(s.row, 8, 1, 4).setValues([[action === 'ok' ? ST_OK : ST_NO, name, new Date(), String(note || '').trim() || (action === 'ok' ? s.note : '')]]);
      hasil.ok++;
      hasil.detail.push({ id, ok: true });
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return hasil;
}

/** Leader memperbaiki isi kiriman yang masih Menunggu. Data asli disimpan di JSON (original). */
function editKiriman(name, pin, id, data) {
  cekLeader_(name, pin);
  const m = getMasterData();
  const items = (data && data.items) || [], lost = (data && data.lostTimes) || [];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = bacaAntrian_().find(x => x.id === id);
    if (!s) throw new Error('Kiriman tidak ditemukan.');
    if (s.status !== ST_WAIT) throw new Error('Kiriman ini sudah ' + s.status.toLowerCase() + '.');
    bangunBaris_({ date: s.date, member: s.member, items, lostTimes: lost }, m);
    const n = (v) => Number(v) || 0;
    const totalQty = items.reduce((a, it) => a + n(it.normalQty) + n(it.otQty), 0);
    const ltMin = lost.reduce((a, l) => a + n(l.minutes), 0);
    const sh = queueSheet_();
    let old = {};
    try { old = JSON.parse(sh.getRange(s.row, 12).getValue() || '{}'); } catch (e) {}
    const rec = { date: s.date, member: s.member, items, lostTimes: lost,
      original: old.original || { items: old.items || [], lostTimes: old.lostTimes || [] },
      editedBy: name, editedAt: Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm') };
    sh.getRange(s.row, 5, 1, 3).setValues([[items.length, totalQty, ltMin]]);
    sh.getRange(s.row, 11).setValue('Diedit oleh ' + name);
    sh.getRange(s.row, 12).setValue(JSON.stringify(rec));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/* ---------- Tulis ke tab Input ---------- */

// Tulis baris setelah baris terakhir yang terisi di kolom input.
function tulis_(sh, rows, width) {
  const maxRows = sh.getMaxRows();
  const data = sh.getRange(FIRST_DATA_ROW, 2, maxRows - FIRST_DATA_ROW + 1, width).getValues();
  let lastFilled = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].some(v => v !== '' && v !== null)) { lastFilled = i; break; }
  }
  const start = FIRST_DATA_ROW + lastFilled + 1;
  const need = start + rows.length - 1 - maxRows;
  if (need > 0) {
    const add = Math.max(need, 200);
    sh.insertRowsAfter(maxRows, add);
    sh.getRange(maxRows, 1, 1, sh.getMaxColumns()).copyTo(sh.getRange(maxRows + 1, 1, add, sh.getMaxColumns()));
    sh.getRange(maxRows + 1, 2, add, width).clearContent();
  }
  sh.getRange(start, 2, rows.length, width).setValues(rows);
}

/* ---------- API untuk tampilan web di Vercel ----------
 *
 * Vercel (server) memanggil URL /exec yang sama dengan metode POST:
 *   { "key": "<API key>", "action": "master", "args": { ... } }
 * Jawaban: { "ok": true, "data": ... } atau { "ok": false, "error": "pesan" }.
 * API key dibuat lewat menu Laporan QA > Buat API key untuk Vercel, lalu diisi
 * di Vercel sebagai APPS_SCRIPT_KEY. Tanpa key yang benar, API menolak semua akses.
 */

const API_ACTIONS = {
  ping: () => ({ version: APP_VERSION }),
  master: () => apiMaster_(),
  login: (a) => apiLogin_(a.nik, a.pin),
  queue: (a) => apiQueue_(a),
  submit: (a) => submitReport(a.payload || {}),
  decide: (a) => {
    if (!String(a.leader || '').trim()) throw new Error('Nama leader kosong.');
    return putuskan_(String(a.leader).trim(), a.ids || [], a.action, a.note);
  },
  rows: (a) => apiRows_(a.from, a.to)
};

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || req.key !== key) throw new Error('API key salah atau belum dibuat.');
    const fn = API_ACTIONS[req.action];
    if (!fn) throw new Error('Aksi tidak dikenal: ' + req.action);
    out = { ok: true, data: fn(req.args || {}) };
  } catch (err) {
    out = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function buatApiKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  SpreadsheetApp.getUi().alert('API key baru (salin ke Vercel sebagai APPS_SCRIPT_KEY):\n\n' + key +
    '\n\nKey lama otomatis tidak berlaku lagi.');
}

/** Master Data lengkap untuk Vercel: sama dengan form, ditambah NIK, STKI, grup lost time dan setting. */
function apiMaster_() {
  const m = getMasterData();
  const ss = ss_();
  const sh = ss.getSheetByName(SHEET_MASTER);
  const last = sh.getLastRow();
  const members = sh.getRange('B7:D' + last).getDisplayValues()
    .filter(r => r[1] && r[2] !== 'Inactive' && r[2] !== 'Tidak Aktif')
    .map(r => ({ nik: String(r[0]).trim(), name: String(r[1]).trim() }));
  const stki = {};
  sh.getRange('G7:K' + last).getValues().forEach(r => {
    if (r[0] && r[2]) stki[r[0] + '|' + r[2] + '|' + r[3]] = Number(r[4]) || 0;
  });
  const parts = [];
  m.categories.forEach(c => c.parts.forEach(p => {
    const types = p.types.length ? p.types : [''];
    types.forEach(t => parts.push({ category: c.name, name: p.name, type: t, stki: stki[c.name + '|' + p.name + '|' + t] || 0 }));
  }));
  const machines = [];
  m.categories.forEach(c => c.machines.forEach(mc => {
    const f = (c.mcInfo || {})[mc] || {};
    machines.push({ category: c.name, mc, line: f.line || '', main: f.main || '', alt: f.alt || '' });
  }));
  const set = {};
  sh.getRange('S7:T20').getValues().forEach(r => { if (r[0] !== '') set[String(r[0])] = r[1]; });
  const val = (label, def, pct) => {
    const k = Object.keys(set).find(x => x.indexOf(label) === 0);
    if (!k || set[k] === '') return def;
    const v = Number(set[k]);
    return pct && v <= 5 ? v * 100 : v;   // 100% tersimpan sebagai 1
  };
  return {
    today: m.today,
    members,
    categories: m.categories.map(c => ({ name: c.name, process: c.process, ngGroup: c.ngGroup || '', ng: c.ng || [] })),
    parts,
    machines,
    lostTypes: m.lostTypes.map(t => ({ name: t, group: m.lostGroups[t] || 'Lost Time' })),
    settings: {
      normalMin: m.normalMin, otLimitHrs: m.otLimitHrs,
      target: val('Achievement target', 100, true),
      gradeA: val('Grade A', 100, true), gradeB: val('Grade B', 90, true), gradeC: val('Grade C', 80, true)
    }
  };
}

/** Tab Users: NIK | Nama | Peran | PIN | Status | Keterangan. Peran: operator, leader, manajemen, admin. */
function usersSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_USERS);
    sh.getRange(1, 1, 1, 6).setValues([['NIK', 'Nama', 'Peran', 'PIN', 'Status', 'Keterangan']])
      .setFontWeight('bold').setBackground('#16181D').setFontColor('#FFFFFF');
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('D:D').setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  return sh;
}

function apiLogin_(nik, pin) {
  nik = String(nik || '').trim();
  pin = String(pin || '').trim();
  if (!nik || !pin) throw new Error('Isi NIK dan PIN.');
  const sh = usersSheet_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 5).getDisplayValues() : [];
  const u = rows.find(r => String(r[0]).trim() === nik);
  if (!u || String(u[3]).trim() !== pin) return { ok: false };
  if (/^(nonaktif|tidak aktif|inactive)$/i.test(String(u[4]).trim())) return { ok: false, inactive: true };
  const peran = String(u[2]).trim().toLowerCase();
  const role = peran === 'admin' ? 'admin' : peran === 'leader' ? 'leader'
    : (peran === 'manajemen' || peran === 'manager') ? 'manager' : 'operator';
  return { ok: true, nik, name: String(u[1]).trim(), role };
}

/** Antrian kiriman untuk Vercel. Filter opsional: status (Menunggu/Disetujui/Ditolak), date, member. */
function apiQueue_(a) {
  return bacaAntrian_().filter(s =>
    (!a.status || s.status === a.status) && (!a.date || s.date === a.date) && (!a.member || s.member === a.member)
  ).map(s => { delete s.row; return s; });
}

/** Baris Input - Production dan Input - Lost Time pada rentang tanggal (yyyy-MM-dd), untuk semua report. */
function apiRows_(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw new Error('Rentang tanggal tidak valid.');
  const ss = ss_();
  const tz = ss.getSpreadsheetTimeZone();
  const day = (d) => d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
  const num = (v) => Number(v) || 0;
  const read = (name, width) => {
    const sh = ss.getSheetByName(name);
    const n = sh.getLastRow() - FIRST_DATA_ROW + 1;
    return n > 0 ? sh.getRange(FIRST_DATA_ROW, 2, n, width).getValues() : [];
  };
  // B..AJ: B tanggal input, C..W isi, AA STKI, AH/AI/AJ tanggal/member/kategori (sudah diturunkan dari baris atas).
  const prod = [];
  read(SHEET_PROD, 35).forEach(r => {
    const d = day(r[32]) || day(r[0]);
    if (!d || d < from || d > to || !r[3]) return;
    prod.push([d, String(r[33] || r[1]), String(r[34] || r[2]), String(r[3]), String(r[4] || ''),
      num(r[5]), num(r[6]), num(r[7]), num(r[8]), String(r[9] || ''), String(r[10] || ''), String(r[11] || '')]
      .concat(r.slice(12, 22).map(num)).concat([num(r[25])]));
  });
  // B..I: B tanggal input, C member, D jenis, E menit, F keterangan, H/I tanggal/member otomatis.
  const lost = [];
  read(SHEET_LT, 8).forEach(r => {
    const d = day(r[6]) || day(r[0]);
    if (!d || d < from || d > to || !r[2]) return;
    lost.push([d, String(r[7] || r[1]), String(r[2]), num(r[3]), String(r[4] || '')]);
  });
  return {
    cols: ['date', 'member', 'category', 'part', 'type', 'normalQty', 'normalMin', 'otQty', 'otMin', 'lot', 'oiban', 'mc',
      'ng1', 'ng2', 'ng3', 'ng4', 'ng5', 'ng6', 'ng7', 'ng8', 'ng9', 'ng10', 'stki'],
    prod, lost
  };
}

/* ---------- Tampilan web app (jangan diubah) ---------- */

const PAGE_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<base target="_top">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Laporan Produksi QA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<style>
:root{
  --red:#E10F1E; --red-d:#B80A17; --red-soft:#FDECEE;
  --ink:#16181D; --ink2:#4A4F5A; --muted:#8A909C; --line:#E7E8EC; --line2:#F0F1F4;
  --bg:#F5F6F8; --card:#FFFFFF; --ok:#12805C; --ok-soft:#E7F6EF; --warn:#B4600B; --warn-soft:#FFF4E5;
  --r:16px; --shadow:0 1px 2px rgba(16,24,40,.04),0 4px 16px rgba(16,24,40,.06);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.45}
button,input,textarea{font:inherit;color:inherit}
.wrap{max-width:760px;margin:0 auto;padding:0 16px 150px}
/* Header */
.hero{background:#fff;border-bottom:1px solid var(--line)}
.hero-in{max-width:760px;margin:0 auto;padding:18px 16px 16px;display:flex;align-items:center;gap:14px}
.hero img{height:40px;width:auto}
.hero .t{border-left:1px solid var(--line);padding-left:14px}
.hero h1{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em}
.hero p{margin:2px 0 0;color:var(--muted);font-size:13px}
.accent{height:3px;background:linear-gradient(90deg,var(--red) 0,var(--red) 40%,#16181D 40%,#16181D 100%)}
/* Sections */
.sec-h{display:flex;align-items:center;justify-content:space-between;margin:26px 2px 10px}
.sec-h h2{margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.sec-h .cnt{font-size:12px;color:var(--muted);font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:16px}
.grid{display:grid;gap:12px}
.g2{grid-template-columns:1fr 1fr}
.g4{grid-template-columns:repeat(4,1fr)}
@media(max-width:560px){.g4{grid-template-columns:1fr 1fr}}
label.f{display:block}
.lb{display:block;font-size:12px;font-weight:600;color:var(--ink2);margin:0 0 6px}
.lb .req{color:var(--red)}
.in,.pick{width:100%;height:48px;border:1.5px solid var(--line);border-radius:12px;background:#fff;padding:0 14px;outline:none;transition:border-color .15s,box-shadow .15s;font-size:15px}
.in:focus,.pick:focus{border-color:var(--ink);box-shadow:0 0 0 4px rgba(22,24,29,.06)}
textarea.in{height:auto;min-height:48px;padding:12px 14px;resize:vertical}
.in.num{font-variant-numeric:tabular-nums;font-weight:600}
.pick{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer}
.pick span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pick .ph{color:var(--muted);font-weight:400}
.pick svg{flex:none;color:var(--muted)}
.pick:disabled{background:var(--line2);cursor:not-allowed}
.err .in,.err .pick{border-color:var(--red);background:#FFFAFA}
.hint{font-size:12px;color:var(--muted);margin-top:6px}
.notice{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;border-radius:12px;font-size:13px;background:var(--warn-soft);color:var(--warn)}
.notice.ok{background:var(--ok-soft);color:var(--ok)}
/* Segmented */
.seg{display:flex;gap:6px;flex-wrap:wrap}
.seg button{height:40px;min-width:56px;padding:0 14px;border-radius:10px;border:1.5px solid var(--line);background:#fff;font-weight:700;cursor:pointer}
.seg button.on{background:var(--ink);border-color:var(--ink);color:#fff}
/* Item cards */
.item{padding:0;overflow:hidden;margin-bottom:12px}
.item-h{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none}
.badge{flex:none;width:30px;height:30px;border-radius:9px;background:var(--red);color:#fff;font-weight:800;font-size:13px;display:grid;place-items:center}
.item-h .ttl{flex:1;min-width:0}
.item-h .ttl b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item-h .ttl small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icon-btn{flex:none;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:var(--ink2);display:grid;place-items:center;cursor:pointer}
.icon-btn:hover{background:var(--line2)}
.chev{transition:transform .2s}
.item.closed .chev{transform:rotate(-90deg)}
.item-b{padding:4px 16px 16px;border-top:1px solid var(--line2)}
.item.closed .item-b{display:none}
.item.invalid{border-color:var(--red)}
.sub{margin:18px 0 10px;font-size:12px;font-weight:700;color:var(--ink2);display:flex;align-items:center;gap:8px}
.sub::after{content:"";flex:1;height:1px;background:var(--line2)}
.pair{border:1px solid var(--line2);border-radius:12px;padding:12px;background:#FAFAFB}
.pair .ph{font-size:12px;font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between}
.pair .ph em{font-style:normal;color:var(--muted);font-weight:600}
.ng-t{width:100%;display:flex;align-items:center;justify-content:space-between;background:#FAFAFB;border:1px dashed var(--line);border-radius:12px;padding:12px 14px;cursor:pointer;font-weight:600;margin-top:14px}
.ng-t .tot{font-size:12px;padding:3px 9px;border-radius:99px;background:var(--line2);color:var(--ink2)}
.ng-t .tot.has{background:var(--red-soft);color:var(--red-d)}
.ng-g{display:none;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
.ng-g.open{display:grid}
@media(min-width:561px){.ng-g{grid-template-columns:repeat(5,1fr)}}
.ng-g .lb{font-size:11px;min-height:28px;line-height:1.25}
.add{width:100%;height:56px;border-radius:var(--r);border:1.5px dashed #C9CCD3;background:transparent;font-weight:700;color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
.add:hover{border-color:var(--ink);color:var(--ink);background:#fff}
.lt-row{display:grid;grid-template-columns:1fr 110px 36px;gap:10px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line2)}
.lt-row:first-child{padding-top:0}
.lt-row .rm{grid-column:1/3}
@media(max-width:560px){.lt-row{grid-template-columns:1fr 92px 36px}}
.empty{color:var(--muted);font-size:13px;text-align:center;padding:4px 0 12px}
/* Bottom bar */
.bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);z-index:20}
.bar-in{max-width:760px;margin:0 auto;padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:14px}
.stats{flex:1;display:flex;gap:18px;min-width:0;overflow-x:auto}
.stat small{display:block;font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}
.stat b{font-size:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.stat b.over{color:var(--warn)}
.btn{height:50px;padding:0 22px;border-radius:14px;border:none;background:var(--red);color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 6px 16px rgba(225,15,30,.25);white-space:nowrap}
.btn:hover{background:var(--red-d)}
.btn:disabled{opacity:.5;box-shadow:none;cursor:default}
.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
@media(max-width:420px){.stats{gap:12px}.stat b{font-size:14px}.btn{padding:0 16px}}
/* Sheets / modal */
.ov{position:fixed;inset:0;background:rgba(16,18,24,.45);z-index:40;display:none;align-items:flex-end;justify-content:center}
.ov.open{display:flex}
.sheet{background:#fff;width:100%;max-width:560px;max-height:86vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:up .22s ease}
@media(min-width:640px){.ov{align-items:center}.sheet{border-radius:20px;max-height:80vh}}
@keyframes up{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}
.sheet-h{padding:18px 18px 10px}
.sheet-h h3{margin:0 0 12px;font-size:17px}
.search{position:relative}
.search input{padding-left:42px}
.search svg{position:absolute;left:14px;top:14px;color:var(--muted)}
.opts{overflow:auto;padding:4px 10px 16px}
.opt{width:100%;text-align:left;padding:13px 12px;border:none;background:none;border-radius:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:15px}
.opt:hover,.opt.hl{background:var(--line2)}
.opt.sel{font-weight:700;color:var(--red-d)}
.opt small{color:var(--muted);font-size:12px;font-weight:500;text-align:right}
.opt>span{white-space:nowrap}
.opt-h{padding:12px 12px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.opt small.alt{color:var(--warn)}
.sheet-f{padding:14px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end}
.rv{padding:0 18px 8px;overflow:auto}
.rv table{width:100%;border-collapse:collapse;font-size:13px}
.rv th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 6px;border-bottom:1px solid var(--line)}
.rv td{padding:9px 6px;border-bottom:1px solid var(--line2);vertical-align:top}
.rv td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rv .meta{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:0 0 12px;color:var(--ink2)}
.rv .warns{margin:10px 0 4px}
/* Done */
.done{display:none;text-align:center;padding:60px 16px}
.done .ck{width:76px;height:76px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center;margin:0 auto 18px;animation:pop .35s ease}
@keyframes pop{from{transform:scale(.6)}to{transform:none}}
.done h2{margin:0 0 6px;font-size:22px}
.done p{color:var(--ink2);margin:0 0 24px}
.done .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.loading{padding:80px 16px;text-align:center;color:var(--muted)}
.spin{width:28px;height:28px;border:3px solid var(--line);border-top-color:var(--red);border-radius:50%;animation:sp 0.8s linear infinite;margin:0 auto 12px}
.btn .spin{width:18px;height:18px;margin:0;border-color:rgba(255,255,255,.35);border-top-color:#fff}
@keyframes sp{to{transform:rotate(360deg)}}
.hero-in .mode{margin-left:auto;font-size:13px;font-weight:700;color:var(--ink2);text-decoration:none;border:1.5px solid var(--line);border-radius:10px;padding:8px 12px;white-space:nowrap}
.hero-in .mode:hover{border-color:var(--ink);color:var(--ink)}
.subs{margin-top:12px;display:grid;gap:8px}
.subrow{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:12px;background:#FAFAFB;border:1px solid var(--line2);font-size:13px}
.subrow .grow{flex:1;min-width:0}
.pill{flex:none;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:var(--line2);color:var(--ink2);white-space:nowrap}
.pill.w{background:var(--warn-soft);color:var(--warn)}.pill.ok{background:var(--ok-soft);color:var(--ok)}.pill.no{background:var(--red-soft);color:var(--red-d)}
.tabs{display:flex;gap:6px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:5px;margin-top:20px}
.tabs button{flex:1;height:42px;border:none;background:none;border-radius:10px;font-weight:700;color:var(--ink2);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.tabs button.on{background:var(--ink);color:#fff}
.tabs .c{font-size:11px;padding:2px 7px;border-radius:99px;background:var(--line2);color:var(--ink2)}
.tabs button.on .c{background:rgba(255,255,255,.2);color:#fff}
.lbar{display:flex;gap:10px;align-items:center;margin:14px 0 10px;flex-wrap:wrap}
.lbar .in{width:auto;height:42px;flex:1;min-width:150px}
.sc{margin-bottom:12px;padding:0;overflow:hidden}
.sc-h{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;cursor:pointer}
.sc-h input[type=checkbox]{width:20px;height:20px;margin:6px 0 0;accent-color:var(--red);flex:none}
.sc-h .ttl{flex:1;min-width:0}
.sc-h .ttl b{display:block;font-size:15px}
.sc-h .ttl small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{font-size:12px;font-weight:600;padding:4px 9px;border-radius:8px;background:var(--line2);color:var(--ink2)}
.sc-b{display:none;border-top:1px solid var(--line2);padding:12px 16px 16px}
.sc.open .sc-b{display:block}
.sc-b .rv{padding:0}
.sc-f{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
.sc-f .btn{height:44px;padding:0 18px;font-size:14px}
.btn.dark{background:var(--ink);box-shadow:none}
.ed-it{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:12px}
.ed-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ed-h .grow{flex:1;min-width:0}.ed-h small{display:block;color:var(--muted);font-size:12px}
.ed-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ed-sec{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
.ed-f .btn{padding:0 14px;font-size:14px;height:46px}
#hist:empty{display:none}
.hist-t{width:100%;display:flex;align-items:center;gap:8px;border:none;background:none;padding:6px 0;font-weight:700;font-size:14px;color:var(--ink);cursor:pointer;text-align:left}
.hist-t span:first-child{flex:1}.hist-t .cnt{font-size:12px;color:var(--muted);font-weight:600}
.ver{display:block;font-size:11px;font-weight:600;color:var(--muted);margin-top:2px;letter-spacing:.02em}
.sm-btn{height:36px;padding:0 12px;font-size:13px;margin-top:8px;box-shadow:none}
.login{max-width:420px;margin:40px auto 0}
.login h2{margin:0 0 4px;font-size:20px}
.login p{margin:0 0 18px;color:var(--muted);font-size:13px}
@media(max-width:480px){.hero p{display:none}.hero h1{font-size:16px}.hero img{height:30px}.hero .t{padding-left:12px}.hero-in{gap:12px}.hero-in .mode{padding:7px 10px;font-size:12px}}
.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;z-index:60;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw}
.toast.show{opacity:1}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-in">
    <img src="data:image/png;base64,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" alt="Takai">
    <div class="t"><h1 id="hTitle">Laporan Produksi QA</h1><p id="hSub">Quality Assurance • Input harian</p><small class="ver">%%VERSI%%</small></div>
    <a class="mode" id="modeLink" href="#" target="_top" style="display:none"></a>
  </div>
  <div class="accent"></div>
</header>

<main class="wrap" id="app"><div class="loading"><div class="spin"></div>Memuat data master…</div></main>

<section class="done" id="done">
  <div class="ck"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <h2>Laporan terkirim</h2>
  <p id="doneMsg"></p>
  <div class="row">
    <button class="btn ghost" onclick="newReport(true)">Laporan member lain</button>
    <button class="btn" onclick="newReport(false)">Tambah laporan lagi</button>
  </div>
</section>

<div class="bar" id="bar" style="display:none">
  <div class="bar-in">
    <div class="stats">
      <div class="stat"><small>Part</small><b id="sParts">0</b></div>
      <div class="stat"><small>Total Qty</small><b id="sQty">0</b></div>
      <div class="stat"><small>Menit normal</small><b id="sMin">0</b></div>
      <div class="stat"><small>Jam OT</small><b id="sOt">0</b></div>
    </div>
    <button class="btn" id="btnSend" onclick="openReview()">Kirim
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
</div>

<div class="ov" id="pickOv" onclick="if(event.target===this)closePick()">
  <div class="sheet">
    <div class="sheet-h"><h3 id="pickTitle"></h3>
      <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input class="in" id="pickQ" placeholder="Cari…" autocomplete="off"></div></div>
    <div class="opts" id="pickList"></div>
  </div>
</div>

<div class="ov" id="revOv" onclick="if(event.target===this)closeReview()">
  <div class="sheet">
    <div class="sheet-h"><h3>Periksa sebelum kirim</h3></div>
    <div class="rv" id="rvBody"></div>
    <div class="sheet-f">
      <button class="btn ghost" onclick="closeReview()">Ubah</button>
      <button class="btn" id="btnConfirm" onclick="send()">Kirim laporan</button>
    </div>
  </div>
</div>

<div class="ov" id="edOv" onclick="if(event.target===this)closeEdit()">
  <div class="sheet">
    <div class="sheet-h"><h3>Edit laporan</h3></div>
    <div class="rv" id="edBody"></div>
    <div class="sheet-f ed-f">
      <button class="btn ghost" onclick="closeEdit()">Batal</button>
      <button class="btn dark" id="btnEdSave" onclick="saveEdit(false)">Simpan</button>
      <button class="btn" id="btnEdOk" onclick="saveEdit(true)">Simpan &amp; setujui</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
var M = null;                 // master data
var S = null;                 // state laporan
var uid = 0;
var DRAFT_KEY = 'qa-draft-v1', MEMBER_KEY = 'qa-member-v1';
var IC = {
  chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  dn:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  copy:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  del:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  warn:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
};

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function $(id){return document.getElementById(id);}
function n(v){var x=parseFloat(String(v).replace(',','.'));return isNaN(x)?0:x;}
function fmt(x){return (Math.round(x*100)/100).toLocaleString('id-ID');}
function toast(msg){var t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('show');},2600);}
function cat(name){for(var i=0;i<M.categories.length;i++)if(M.categories[i].name===name)return M.categories[i];return null;}
function partOf(c,name){if(!c)return null;for(var i=0;i<c.parts.length;i++)if(c.parts[i].name===name)return c.parts[i];return null;}

/* ---------- server ---------- */
function call(fn,args,ok,fail){
  if(window.google&&google.script&&google.script.run){
    var r=google.script.run.withSuccessHandler(ok).withFailureHandler(function(e){(fail||showErr)(e&&e.message?e.message:String(e));});
    r[fn].apply(r,args||[]);
  } else { window.MOCK[fn].apply(null,(args||[]).concat([ok])); }
}
function showErr(m){toast(m);}

/* ---------- state ---------- */
function newItem(category){return {id:++uid,category:category||'',part:'',type:'',mc:'',normalQty:'',normalMin:'',otQty:'',otMin:'',lot:'',oiban:'',ng:['','','','','','','','','',''],open:true,ngOpen:false};}
function newLt(){return {id:++uid,type:'',minutes:'',remarks:''};}
// Lost time harian yang langsung terisi di form baru (masih bisa diubah atau dihapus).
var DEF_LT=[['5S',10],['Briefing Pagi',5],['Input Laporan',5]];
function defLost(){return DEF_LT.filter(function(d){return M.lostTypes.indexOf(d[0])>=0;}).map(function(d){var l=newLt();l.type=d[0];l.minutes=String(d[1]);l.auto=true;return l;});}
function freshState(keepMember){
  return {date:M.today,member:keepMember&&S?S.member:savedMember(),items:[newItem()],lost:defLost()};
}
function savedMember(){try{var m=localStorage.getItem(MEMBER_KEY)||'';return M.members.indexOf(m)>=0?m:'';}catch(e){return '';}}
function saveMember(m){try{localStorage.setItem(MEMBER_KEY,m);}catch(e){}
}
function saveDraft(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(S));}catch(e){}}
function loadDraft(){try{var d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(d&&d.items){d.items.forEach(function(i){uid=Math.max(uid,i.id);});(d.lost||[]).forEach(function(i){uid=Math.max(uid,i.id);});return d;}}catch(e){}return null;}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch(e){}}

/* ---------- render ---------- */
function render(){
  var h='';
  h+='<div class="sec-h"><h2>Data laporan</h2></div>';
  h+='<div class="card"><div class="grid g2">';
  h+='<label class="f" data-k="date"><span class="lb">Tanggal <span class="req">*</span></span><input class="in" type="date" value="'+esc(S.date)+'" onchange="S.date=this.value;changed(true)"></label>';
  h+='<div class="f" data-k="member"><span class="lb">Nama member <span class="req">*</span></span>'+pickBtn(S.member,'Pilih nama','pickMember()')+'</div>';
  h+='</div><div id="existing"></div><div id="hist" class="subs"></div></div>';
  if(S.editId)h+='<div class="notice" style="margin-top:14px">'+IC.warn+'<div style="flex:1"><b>Sedang mengedit kiriman '+esc(fmtDate(S.date))+'</b> yang masih menunggu leader. Simpan untuk mengganti kiriman lama.<br><button class="btn ghost sm-btn" onclick="batalEdit()">Batal edit</button></div></div>';

  h+='<div class="sec-h"><h2>Pekerjaan produksi</h2><span class="cnt">'+S.items.length+' part</span></div>';
  S.items.forEach(function(it,ix){h+=itemHtml(it,ix);});
  h+='<button class="add" onclick="addItem()">'+IC.plus+' Tambah part</button>';

  h+='<div class="sec-h" id="ltSec"><h2>Lost time / Another job</h2><span class="cnt">'+(S.lost.length?S.lost.length+' catatan':'wajib bila waktu kerja kurang dari '+M.normalMin+' menit')+'</span></div>';
  h+='<div class="card"><div id="ltGap"></div>';
  if(!S.lost.length)h+='<div class="empty">Belum ada lost time.</div>';
  S.lost.forEach(function(l,ix){
    h+='<div class="lt-row" id="lt'+l.id+'">'
      +'<div class="f" data-k="type"><span class="lb">Jenis</span>'+pickBtn(l.type,'Pilih jenis','pickLt('+ix+')')+'</div>'
      +'<label class="f" data-k="minutes"><span class="lb">Menit</span><input class="in num" inputmode="decimal" value="'+esc(l.minutes)+'" oninput="S.lost['+ix+'].minutes=this.value;S.lost['+ix+'].auto=false;changed()"></label>'
      +'<button class="icon-btn" title="Hapus" onclick="S.lost.splice('+ix+',1);changed();render()">'+IC.del+'</button>'
      +'<label class="f rm"><input class="in" placeholder="Keterangan (opsional)" value="'+esc(l.remarks)+'" oninput="S.lost['+ix+'].remarks=this.value;changed()"></label>'
      +'</div>';
  });
  h+='<button class="add" style="height:48px;margin-top:'+(S.lost.length?'14':'0')+'px" onclick="S.lost.push(newLt());changed();render()">'+IC.plus+' Tambah lost time</button>';
  h+='</div>';
  $('app').innerHTML=h;
  updateBar();
  checkExisting();
  loadHist();
}
function pickBtn(val,ph,onclick,disabled){
  return '<button type="button" class="pick" '+(disabled?'disabled ':'')+'onclick="'+onclick+'"><span'+(val?'':' class="ph"')+'>'+esc(val||ph)+'</span>'+IC.dn+'</button>';
}
function itemSummary(it){
  var q=n(it.normalQty)+n(it.otQty), m=n(it.normalMin)+n(it.otMin), bits=[];
  if(it.category)bits.push(it.category);
  if(q)bits.push(fmt(q)+' pcs');
  if(m)bits.push(fmt(m)+' mnt');
  return bits.join(' • ')||'Belum diisi';
}
function itemHtml(it,ix){
  var c=cat(it.category), p=partOf(c,it.part), types=p?p.types:[];
  var ngTot=it.ng.reduce(function(a,b){return a+n(b);},0);
  var h='<div class="card item'+(it.open?'':' closed')+'" id="it'+it.id+'">';
  h+='<div class="item-h" onclick="toggleItem('+ix+')"><div class="badge">'+(ix+1)+'</div>'
    +'<div class="ttl"><b>'+esc(it.part||'Part baru')+(it.type&&it.type!=='-'?' <span style="color:var(--muted);font-weight:600">'+esc(it.type)+'</span>':'')+'</b><small>'+esc(itemSummary(it))+'</small></div>'
    +'<button class="icon-btn" title="Duplikat (kategori sama)" onclick="event.stopPropagation();dupItem('+ix+')">'+IC.copy+'</button>'
    +(S.items.length>1?'<button class="icon-btn" title="Hapus" onclick="event.stopPropagation();delItem('+ix+')">'+IC.del+'</button>':'')
    +'<span class="icon-btn">'+IC.chev+'</span></div>';
  h+='<div class="item-b">';
  h+='<div class="grid g2" style="margin-top:12px">';
  h+='<div class="f" data-k="category"><span class="lb">Kategori <span class="req">*</span></span>'+pickBtn(it.category,'Pilih kategori','pickCat('+ix+')')+'</div>';
  h+='<div class="f" data-k="part"><span class="lb">Part name <span class="req">*</span></span>'+pickBtn(it.part,c?'Pilih part':'Pilih kategori dulu','pickPart('+ix+')',!c)+'</div>';
  h+='</div>';
  if(p&&types.length){
    h+='<div class="grid'+(c&&c.machines.length?' g2':'')+'" style="margin-top:12px">';
    h+='<div class="f" data-k="type"><span class="lb">Type <span class="req">*</span></span><div class="seg">';
    types.forEach(function(t){h+='<button type="button" class="'+(it.type===t?'on':'')+'" onclick="setF('+ix+',\\'type\\',\\''+esc(t)+'\\',true)">'+esc(t)+'</button>';});
    h+='</div></div>';
    if(c.machines.length)h+='<div class="f" data-k="mc"><span class="lb">MC No <span class="req">*</span></span>'+pickBtn(it.mc,'Pilih MC','pickMc('+ix+')')+'</div>';
    h+='</div>';
  } else if(c&&c.machines.length){
    h+='<div class="f" data-k="mc" style="margin-top:12px"><span class="lb">MC No <span class="req">*</span></span>'+pickBtn(it.mc,'Pilih MC','pickMc('+ix+')')+'</div>';
  }
  h+='<div class="sub">Hasil kerja</div><div class="grid g2">';
  h+=pairHtml(ix,'Normal','normalQty','normalMin',it);
  h+=pairHtml(ix,'Lembur (OT)','otQty','otMin',it);
  h+='</div>';
  h+='<div class="grid g2" style="margin-top:12px">'
    +'<label class="f"><span class="lb">Lot</span><input class="in" value="'+esc(it.lot)+'" oninput="setF('+ix+',\\'lot\\',this.value)"></label>'
    +'<label class="f"><span class="lb">Oiban</span><input class="in" value="'+esc(it.oiban)+'" oninput="setF('+ix+',\\'oiban\\',this.value)"></label></div>';
  var ngN=c?c.ng:[];
  h+='<button type="button" class="ng-t" onclick="S.items['+ix+'].ngOpen=!S.items['+ix+'].ngOpen;changed();render()"><span>Jumlah NG'+(c&&c.ngGroup?' <span style="color:var(--muted);font-weight:500">• '+esc(c.ngGroup)+'</span>':'')+'</span><span class="tot'+(ngTot?' has':'')+'" id="ngt'+it.id+'">'+(ngTot?fmt(ngTot)+' pcs':'Tidak ada')+'</span></button>';
  h+='<div class="ng-g'+(it.ngOpen?' open':'')+'">';
  for(var k=0;k<10;k++){
    h+='<label class="f"><span class="lb">NG'+(k+1)+' '+esc(ngN[k]||'')+'</span><input class="in num" inputmode="numeric" value="'+esc(it.ng[k])+'" oninput="setNg('+ix+','+k+',this.value)"></label>';
  }
  h+='</div></div></div>';
  return h;
}
function pairHtml(ix,title,q,m,it){
  return '<div class="pair"><div class="ph">'+title+'</div><div class="grid g2">'
    +'<label class="f" data-k="'+q+'"><span class="lb">Qty (pcs)</span><input class="in num" inputmode="numeric" value="'+esc(it[q])+'" oninput="setF('+ix+',\\''+q+'\\',this.value)"></label>'
    +'<label class="f" data-k="'+m+'"><span class="lb">Menit</span><input class="in num" inputmode="decimal" value="'+esc(it[m])+'" oninput="setF('+ix+',\\''+m+'\\',this.value)"></label>'
    +'</div></div>';
}

/* ---------- actions ---------- */
function changed(recheck){saveDraft();updateBar();if(recheck)checkExisting();}
function setF(ix,k,v,rerender){
  S.items[ix][k]=v;changed();
  if(rerender){render();return;}
  var it=S.items[ix],el=$('it'+it.id);
  if(el){el.querySelector('.ttl small').textContent=itemSummary(it);var f=el.querySelector('[data-k="'+k+'"]');if(f)f.classList.remove('err');}
}
function setNg(ix,k,v){
  var it=S.items[ix];it.ng[k]=v;changed();
  var t=it.ng.reduce(function(a,b){return a+n(b);},0),el=$('ngt'+it.id);
  el.textContent=t?fmt(t)+' pcs':'Tidak ada';el.className='tot'+(t?' has':'');
}
function toggleItem(ix){S.items[ix].open=!S.items[ix].open;changed();render();}
function addItem(){
  var last=S.items[S.items.length-1];
  S.items.forEach(function(i){i.open=false;});
  S.items.push(newItem(last?last.category:''));changed();render();
  setTimeout(function(){var el=$('it'+S.items[S.items.length-1].id);el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
}
function dupItem(ix){
  var src=S.items[ix],it=newItem(src.category);it.mc=src.mc;
  S.items.forEach(function(i){i.open=false;});
  S.items.splice(ix+1,0,it);changed();render();toast('Part baru dengan kategori '+(src.category||'sama')+' ditambahkan');
  setTimeout(function(){var el=$('it'+it.id);el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
}
function delItem(ix){
  if(!confirm('Hapus part #'+(ix+1)+'?'))return;
  S.items.splice(ix,1);changed();render();
}
function updateBar(){
  var q=0,m=0,o=0,bs=$('btnSend');if(bs&&bs.firstChild)bs.firstChild.textContent=S.editId?'Simpan ':'Kirim ';
  S.items.forEach(function(i){q+=n(i.normalQty)+n(i.otQty);m+=n(i.normalMin);o+=n(i.otMin);});
  $('sParts').textContent=S.items.filter(function(i){return i.part;}).length;
  $('sQty').textContent=fmt(q);
  var sm=$('sMin');sm.textContent=fmt(m)+' / '+M.normalMin;sm.className=m>M.normalMin?'over':'';
  var so=$('sOt');so.textContent=fmt(o/60);so.className=o/60>M.otLimitHrs?'over':'';
  var g=$('ltGap');if(!g)return;
  var lt=0;S.lost.forEach(function(l){lt+=n(l.minutes);});
  var rest=M.normalMin-m-lt,hasWork=S.items.some(function(i){return i.part||n(i.normalMin);})||S.lost.length;
  if(!hasWork){g.innerHTML='';return;}
  if(rest>0)g.innerHTML='<div class="notice" style="margin:0 0 14px">'+IC.warn+'<div style="flex:1">Waktu tercatat '+fmt(m)+' menit kerja + '+fmt(lt)+' menit lost time dari '+M.normalMin+' menit. <b>Isi lost time untuk sisa '+fmt(rest)+' menit.</b><br><button class="btn ghost" style="height:36px;margin-top:8px;font-size:13px" onclick="fillGap('+rest+')">'+IC.plus+' Tambah lost time '+fmt(rest)+' menit</button></div></div>';
  else if(rest===0)g.innerHTML='<div class="notice ok" style="margin:0 0 14px"><div>Waktu kerja lengkap: '+M.normalMin+' menit tercatat.</div></div>';
  else g.innerHTML='';
}
function gapMinutes(){var m=0,lt=0;S.items.forEach(function(i){m+=n(i.normalMin);});S.lost.forEach(function(l){lt+=n(l.minutes);});return M.normalMin-m-lt;}
function fillGap(rest){
  var empty=S.lost.filter(function(l){return !n(l.minutes);})[0];
  if(empty)empty.minutes=String(rest);else{var l=newLt();l.minutes=String(rest);S.lost.push(l);}
  changed();render();
  setTimeout(function(){var el=$('ltSec');el&&el.scrollIntoView({behavior:'smooth',block:'start'});},30);
  toast('Pilih jenis lost time untuk '+fmt(rest)+' menit');
}
var existTimer=null,existCache={};
function existHtml(r,mb){
  var h='';
  if(r.prod||r.lt)h+='<div class="notice">'+IC.warn+'<div>'+esc(mb)+' sudah punya '+r.prod+' baris produksi dan '+r.lt+' baris lost time yang disetujui di tanggal ini. Kirim lagi hanya untuk tambahan, bukan ulangan.</div></div>';
  if(r.subs&&r.subs.length){
    h+='<div class="subs">';
    r.subs.forEach(function(x){
      var cls=x.status==='Disetujui'?'ok':(x.status==='Ditolak'?'no':'w');
      h+='<div class="subrow"><div class="grow"><b>Kiriman '+esc(x.sent.slice(11))+'</b> • '+x.parts+' part'
        +(x.status==='Ditolak'&&x.note?'<br><span style="color:var(--red-d)">Alasan: '+esc(x.note)+'</span>':'')
        +(x.leader&&x.status!=='Menunggu'?'<br><span style="color:var(--muted)">oleh '+esc(x.leader)+'</span>':'')
        +(x.status==='Ditolak'&&x.items&&(x.items.length||x.lostTimes.length)?'<br><button class="btn ghost sm-btn" onclick="pakaiUlang(\\''+esc(x.id)+'\\')">Perbaiki &amp; kirim ulang</button>':'')
        +'</div><span class="pill '+cls+'">'+esc(x.status)+'</span></div>';
    });
    h+='</div>';
  }
  return h;
}
function checkExisting(force){
  var box=$('existing');if(!box)return;
  if(!S.date||!S.member){box.innerHTML='';return;}
  var key=S.date+'|'+S.member;
  if(existCache[key]&&!force){if(dropAuto(existCache[key]))return;box.innerHTML=existHtml(existCache[key],S.member);return;}
  clearTimeout(existTimer);
  existTimer=setTimeout(function(){
    var d=S.date,mb=S.member;
    call('cekLaporan',[d,mb],function(r){
      existCache[d+'|'+mb]=r;
      if(d!==S.date||mb!==S.member||!$('existing'))return;
      if(dropAuto(r))return;
      $('existing').innerHTML=existHtml(r,mb);
    },function(){});
  },350);
}

// Bila hari itu member sudah kirim, lost time harian otomatis tidak diisi lagi.
function dropAuto(r){
  var sudah=r.lt>0||(r.subs||[]).some(function(x){return x.status!=='Ditolak';});
  if(!sudah||!S.lost.some(function(l){return l.auto;}))return false;
  S.lost=S.lost.filter(function(l){return !l.auto;});
  saveDraft();render();
  toast('5S, briefing, dan input laporan sudah ada di kiriman sebelumnya, jadi tidak diisi lagi');
  return true;
}
// Muat isi kiriman ke form. editId diisi bila kiriman Menunggu diedit (akan diganti saat simpan).
function muatKiriman(x,editId){
  if((S.items.some(function(i){return i.part;})||S.lost.some(function(l){return !l.auto;}))&&!confirm('Isian di form sekarang akan diganti dengan isi kiriman ini. Lanjutkan?'))return;
  S.items=(x.items||[]).map(function(it){var o=newItem(it.category);Object.keys(it).forEach(function(k){if(k!=='id')o[k]=it[k];});o.ng=(it.ng||[]).concat(['','','','','','','','','','']).slice(0,10);o.open=false;o.ngOpen=false;return o;});
  if(!S.items.length)S.items=[newItem()];
  S.lost=(x.lostTimes||[]).map(function(l){var o=newLt();o.type=l.type;o.minutes=l.minutes;o.remarks=l.remarks||'';return o;});
  if(x.date)S.date=x.date;
  S.editId=editId||'';S.editSent=editId?x.sent:'';
  changed(true);render();window.scrollTo(0,0);
  toast(editId?'Kiriman dimuat. Ubah yang perlu lalu tekan Simpan perubahan.':'Isi kiriman yang ditolak sudah dimuat. Perbaiki yang salah lalu kirim lagi.');
}
// Isi form dari kiriman yang ditolak, supaya member cukup memperbaiki yang salah.
function pakaiUlang(id){
  var r=existCache[S.date+'|'+S.member],x=r&&(r.subs||[]).filter(function(z){return z.id===id;})[0];
  if(!x)x=(HIST.list||[]).filter(function(z){return z.id===id;})[0];
  if(x)muatKiriman(x,'');
}
function editKirimanSaya(id){var x=(HIST.list||[]).filter(function(z){return z.id===id;})[0];if(x)muatKiriman(x,id);}
function batalEdit(){if(!confirm('Batalkan edit? Isian di form akan dikosongkan.'))return;S=freshState(true);saveDraft();render();}

/* ---------- riwayat member ---------- */
var HIST={member:'',list:null,open:{},show:false};
function loadHist(force){
  if(!S.member){HIST={member:'',list:null,open:{},show:HIST.show};drawHist();return;}
  if(HIST.member===S.member&&HIST.list&&!force){drawHist();return;}
  var mb=S.member;HIST.member=mb;HIST.list=null;drawHist();
  call('riwayatMember',[mb],function(r){if(HIST.member!==mb)return;HIST.list=r;drawHist();},function(){if(HIST.member===mb){HIST.list=[];drawHist();}});
}
function histTotals(x){var q=0,mn=0,lt=0;(x.items||[]).forEach(function(it){q+=n(it.normalQty)+n(it.otQty);mn+=n(it.normalMin);});(x.lostTimes||[]).forEach(function(l){lt+=n(l.minutes);});return {q:q,mn:mn,lt:lt};}
function drawHist(){
  var box=$('hist');if(!box)return;
  if(!S.member){box.innerHTML='';return;}
  var L0=HIST.list,h='<button class="hist-t" onclick="HIST.show=!HIST.show;drawHist()"><span>Riwayat saya (7 hari)</span><span class="cnt">'+(L0?L0.length+' kiriman':'memuat…')+'</span>'+IC.chev+'</button>';
  if(HIST.show){
    if(!L0)h+='<div class="empty">Memuat riwayat…</div>';
    else if(!L0.length)h+='<div class="empty">Belum ada kiriman dalam 7 hari terakhir.</div>';
    else L0.forEach(function(x){
      var t=histTotals(x),cls=x.status==='Disetujui'?'ok':(x.status==='Ditolak'?'no':'w'),op=HIST.open[x.id];
      h+='<div class="subrow" style="flex-direction:column;gap:6px"><div style="display:flex;gap:10px;width:100%;align-items:flex-start;cursor:pointer" onclick="HIST.open[\\''+esc(x.id)+'\\']=!HIST.open[\\''+esc(x.id)+'\\'];drawHist()">'
        +'<div class="grow"><b>'+esc(fmtDate(x.date))+'</b> • '+(x.items||[]).length+' part • '+fmt(t.q)+' pcs<br><span style="color:var(--muted)">'+fmt(t.mn)+' mnt kerja + '+fmt(t.lt)+' mnt lost time • dikirim '+esc(String(x.sent).slice(11))+'</span>'
        +(x.status==='Ditolak'&&x.note?'<br><span style="color:var(--red-d)">Alasan: '+esc(x.note)+'</span>':'')+'</div>'
        +'<span class="pill '+cls+'">'+esc(x.status)+'</span></div>';
      if(op){
        h+='<div style="width:100%;font-size:12px;color:var(--ink2)">'+(x.items||[]).map(function(it){return '• '+esc(it.part)+' '+esc(it.type&&it.type!=='-'?it.type:'')+(it.mc&&it.mc!=='-'?' ('+esc(it.mc)+')':'')+': '+fmt(n(it.normalQty)+n(it.otQty))+' pcs, '+fmt(n(it.normalMin)+n(it.otMin))+' mnt';}).join('<br>')
          +((x.lostTimes||[]).length?'<br>'+x.lostTimes.map(function(l){return '• '+esc(l.type)+': '+fmt(n(l.minutes))+' mnt';}).join('<br>'):'')+'</div>';
      }
      if(x.status==='Menunggu')h+='<button class="btn ghost sm-btn" style="margin-top:0" onclick="editKirimanSaya(\\''+esc(x.id)+'\\')">Edit kiriman ini</button>';
      else if(x.status==='Ditolak')h+='<button class="btn ghost sm-btn" style="margin-top:0" onclick="pakaiUlang(\\''+esc(x.id)+'\\')">Perbaiki &amp; kirim ulang</button>';
      h+='</div>';
    });
  }
  box.innerHTML=h;
}

/* ---------- picker ---------- */
var pickState=null;
function openPick(title,options,current,onPick){
  pickState={options:options,current:current,onPick:onPick,hl:0};
  $('pickTitle').textContent=title;$('pickQ').value='';
  drawPick();$('pickOv').classList.add('open');
  setTimeout(function(){if(window.matchMedia('(min-width:640px)').matches)$('pickQ').focus();},50);
}
function drawPick(){
  var q=$('pickQ').value.trim().toLowerCase(),h='',nz=function(x){return x.replace(/\\b0+(\\d)/g,'$1');},list=pickState.options.filter(function(o){return q?!o.head&&nz((o.label+' '+(o.sub||'')).toLowerCase()).indexOf(nz(q))>=0:true;});
  pickState.filtered=list;
  if(!q&&list[0]&&list[0].head)pickState.hl=1;
  list.forEach(function(o,i){if(o.head){h+='<div class="opt-h">'+esc(o.head)+'</div>';return;}h+='<button class="opt'+(o.value===pickState.current?' sel':'')+(i===pickState.hl&&q?' hl':'')+'" onclick="choose('+i+')"><span>'+esc(o.label)+'</span>'+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'</button>';});
  $('pickList').innerHTML=h||'<div class="empty" style="padding:24px">Tidak ditemukan</div>';
}
function choose(i){var o=pickState.filtered[i];if(o&&o.head)return;closePick();if(o)pickState.onPick(o.value);}
function closePick(){$('pickOv').classList.remove('open');}
$('pickQ').addEventListener('input',function(){pickState.hl=0;drawPick();});
$('pickQ').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();choose(pickState.hl);}
  else if(e.key==='ArrowDown'){pickState.hl=Math.min(pickState.hl+1,pickState.filtered.length-1);drawPick();}
  else if(e.key==='ArrowUp'){pickState.hl=Math.max(pickState.hl-1,0);drawPick();}
  else if(e.key==='Escape')closePick();
});
function opts(arr){return arr.map(function(v){return {value:v,label:v};});}
function pickMember(){openPick('Nama member',opts(M.members),S.member,function(v){S.member=v;saveMember(v);if(!S.lost.length&&!S.items.some(function(i){return i.part;}))S.lost=defLost();changed(true);render();});}
function pickCat(ix){
  openPick('Kategori',M.categories.map(function(c){return {value:c.name,label:c.name,sub:c.process};}),S.items[ix].category,function(v){
    var it=S.items[ix];if(it.category!==v){it.category=v;it.part='';it.type='';it.mc='';}changed();render();});
}
function pickPart(ix){
  var c=cat(S.items[ix].category);if(!c)return;
  openPick('Part • '+c.name,c.parts.map(function(p){return {value:p.name,label:p.name,sub:p.types.join(' / ')};}),S.items[ix].part,function(v){
    var it=S.items[ix],p=partOf(c,v);it.part=v;it.type=p&&p.types.length===1?p.types[0]:(p&&p.types.indexOf(it.type)>=0?it.type:'');changed();render();});
}
function normPT(x){return String(x||'').toUpperCase().replace(/\\*KD/g,'').replace(/[^A-Z0-9]/g,'');}
function mcRuns(list,key){return !!key&&String(list||'').split(/[,;\\n]/).some(function(x){return normPT(x)===key;});}
function pickMc(ix){
  var it=S.items[ix],c=cat(it.category),info=c.mcInfo||{},key=it.part?normPT(it.part+(it.type&&it.type!=='-'?it.type:'')):'',pt=it.part+(it.type&&it.type!=='-'?' '+it.type:'');
  var fit=[],alt=[],other=[];
  c.machines.forEach(function(m){
    var f=info[m]||{},sub=[f.main,f.line].filter(Boolean).join(' • ');
    if(mcRuns(f.main,key))fit.push({value:m,label:m,sub:sub+(f.alt?' • bisa ganti '+f.alt:'')});
    else if(mcRuns(f.alt,key))alt.push({value:m,label:m,sub:'Ganti type dari '+(f.main||'-')+(f.line?' • '+f.line:'')});
    else other.push({value:m,label:m,sub:sub+(f.alt?' • bisa ganti '+f.alt:'')});
  });
  var o=[];
  if(fit.length||alt.length){
    if(fit.length)o.push({head:'Mesin untuk '+pt}),o=o.concat(fit);
    if(alt.length)o.push({head:'Bisa dipakai '+pt+' (ganti type)'}),o=o.concat(alt);
    o.push({head:'Mesin lain'});
  }
  o=o.concat(other).concat([{value:'-',label:'-',sub:'Tidak pakai mesin'}]);
  openPick('MC No • '+c.name,o,it.mc,function(v){S.items[ix].mc=v;changed();render();});
}
function pickLt(ix){
  var g=M.lostGroups||{},order=[],by={},o=[];
  M.lostTypes.forEach(function(t){var k=g[t]||'';if(!by[k]){by[k]=[];order.push(k);}by[k].push({value:t,label:t});});
  order.forEach(function(k){if(k&&order.length>1)o.push({head:k});o=o.concat(by[k]);});
  openPick('Lost time / Another job',o,S.lost[ix].type,function(v){S.lost[ix].type=v;S.lost[ix].auto=false;changed();render();});
}

/* ---------- validation & send ---------- */
function validate(){
  var errs=[],first=null;
  function mark(sel,key,msg,openIx){
    errs.push(msg);
    if(openIx!=null&&!S.items[openIx].open){S.items[openIx].open=true;}
    first=first||{sel:sel,key:key};
  }
  if(!S.date)mark(null,'date','Tanggal belum diisi');
  if(!S.member)mark(null,'member','Nama member belum dipilih');
  var filledItems=S.items.filter(function(it){return it.category||it.part||it.normalQty||it.otQty||it.normalMin||it.otMin;});
  if(!filledItems.length&&!S.lost.length)errs.push('Isi minimal satu part atau lost time');
  S.items.forEach(function(it,ix){
    if(filledItems.indexOf(it)<0)return;
    var c=cat(it.category),p=partOf(c,it.part),L='Part #'+(ix+1)+': ';
    if(!it.category)mark(ix,'category',L+'kategori belum dipilih',ix);
    else if(!it.part)mark(ix,'part',L+'part belum dipilih',ix);
    else if(p&&p.types.length&&!it.type)mark(ix,'type',L+'type belum dipilih',ix);
    if(c&&c.machines.length&&it.part&&!it.mc)mark(ix,'mc',L+'MC No belum dipilih (pilih - bila tidak pakai mesin)',ix);
    if(!n(it.normalQty)&&!n(it.otQty))mark(ix,'normalQty',L+'qty normal atau OT belum diisi',ix);
    if(n(it.normalQty)&&!n(it.normalMin))mark(ix,'normalMin',L+'menit normal belum diisi',ix);
    if(n(it.otQty)&&!n(it.otMin))mark(ix,'otMin',L+'menit OT belum diisi',ix);
  });
  S.lost.forEach(function(l,ix){
    if(!l.type)errs.push('Lost time #'+(ix+1)+': jenis belum dipilih');
    if(!n(l.minutes))errs.push('Lost time #'+(ix+1)+': menit belum diisi');
  });
  var rest=gapMinutes();
  if(!errs.length&&rest>0){
    if(!S.lost.length)S.lost.push(newLt());
    render();
    var sec=$('ltSec');sec&&sec.scrollIntoView({behavior:'smooth',block:'start'});
    toast('Waktu kerja kurang '+fmt(rest)+' menit dari '+M.normalMin+'. Isi lost time untuk sisanya.');
    return null;
  }
  if(errs.length){
    render();
    if(first){
      var root=first.sel==null?document:$('it'+S.items[first.sel].id);
      var el=root&&root.querySelector('[data-k="'+first.key+'"]');
      if(el){el.classList.add('err');el.scrollIntoView({behavior:'smooth',block:'center'});}
    }
    toast(errs[0]+(errs.length>1?' (+'+(errs.length-1)+' lainnya)':''));
    return null;
  }
  return filledItems;
}
function openReview(){
  var items=validate();if(!items)return;
  var q=0,m=0,o=0,ng=0,lt=0;
  var h='<div class="meta"><span><b>'+esc(S.member)+'</b></span><span>'+esc(new Date(S.date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</span></div>';
  if(items.length){
    h+='<table><tr><th>Part</th><th style="text-align:right">Qty</th><th style="text-align:right">Menit</th><th style="text-align:right">NG</th></tr>';
    items.forEach(function(it){
      var iq=n(it.normalQty)+n(it.otQty),im=n(it.normalMin)+n(it.otMin),ing=it.ng.reduce(function(a,b){return a+n(b);},0);
      q+=iq;m+=n(it.normalMin);o+=n(it.otMin);ng+=ing;
      h+='<tr><td><b>'+esc(it.part)+'</b> '+esc(it.type&&it.type!=='-'?it.type:'')+'<br><small style="color:var(--muted)">'+esc(it.category)+(it.mc&&it.mc!=='-'?' • '+esc(it.mc):'')+'</small></td><td class="n">'+fmt(iq)+'</td><td class="n">'+fmt(im)+'</td><td class="n">'+(ing?fmt(ing):'-')+'</td></tr>';
    });
    h+='<tr><td><b>Total</b></td><td class="n"><b>'+fmt(q)+'</b></td><td class="n"><b>'+fmt(m+o)+'</b></td><td class="n"><b>'+(ng?fmt(ng):'-')+'</b></td></tr></table>';
  }
  if(S.lost.length){
    h+='<table style="margin-top:14px"><tr><th>Lost time / Another job</th><th style="text-align:right">Menit</th></tr>';
    S.lost.forEach(function(l){lt+=n(l.minutes);h+='<tr><td>'+esc(l.type)+(l.remarks?'<br><small style="color:var(--muted)">'+esc(l.remarks)+'</small>':'')+'</td><td class="n">'+fmt(n(l.minutes))+'</td></tr>';});
    h+='</table>';
  }
  var w=[];
  if(m+lt>M.normalMin)w.push('Menit normal + lost time ('+fmt(m+lt)+') melebihi waktu kerja normal '+M.normalMin+' menit.');
  if(o/60>M.otLimitHrs)w.push('Jam OT ('+fmt(o/60)+') melebihi batas '+M.otLimitHrs+' jam per hari.');
  if(w.length)h+='<div class="warns">'+w.map(function(x){return '<div class="notice">'+IC.warn+'<div>'+esc(x)+' Tetap bisa dikirim bila memang benar.</div></div>';}).join('')+'</div>';
  $('rvBody').innerHTML=h;$('btnConfirm').textContent=S.editId?'Simpan perubahan':'Kirim laporan';$('revOv').classList.add('open');
}
function closeReview(){$('revOv').classList.remove('open');}
function send(){
  var items=validate();if(!items){closeReview();return;}
  var b=$('btnConfirm');b.disabled=true;b.innerHTML='<span class="spin"></span> Mengirim…';
  var payload={date:S.date,member:S.member,
    items:items.map(function(it){return {category:it.category,part:it.part,type:it.type,mc:it.mc,normalQty:it.normalQty,normalMin:it.normalMin,otQty:it.otQty,otMin:it.otMin,lot:it.lot,oiban:it.oiban,ng:it.ng};}),
    lostTimes:S.lost.map(function(l){return {type:l.type,minutes:l.minutes,remarks:l.remarks};}),replaceId:S.editId||''};
  call('submitReport',[payload],function(r){
    b.disabled=false;b.textContent='Kirim laporan';closeReview();clearDraft();HIST.member='';
    $('doneMsg').textContent=r.replaced?'Perubahan kiriman '+S.member+' sudah disimpan dan tetap menunggu validasi leader.':r.prod+' part dan '+r.lt+' lost time untuk '+S.member+' sudah terkirim dan menunggu validasi leader. Data masuk ke Dashboard setelah disetujui.';
    S.editId='';HIST.list=null;existCache={};
    $('app').style.display='none';$('bar').style.display='none';$('done').style.display='block';window.scrollTo(0,0);
  },function(msg){b.disabled=false;b.textContent='Kirim laporan';toast('Gagal mengirim: '+msg);});
}
function newReport(otherMember){
  S=freshState(!otherMember);saveDraft();
  existCache={};$('done').style.display='none';$('app').style.display='block';$('bar').style.display='block';render();window.scrollTo(0,0);
}

/* ---------- init ---------- */
var BASE_URL='';
function withMaster(ok,fail){
  if(window.BOOT&&BOOT.m){var m=BOOT.m;BOOT.m=null;ok(m);return;}
  call('getMasterData',[],ok,fail);
}
function startMember(){
  withMaster(function(m){
    M=m;
    var d=loadDraft();
    S=d||freshState(false);
    if(d&&(d.items.some(function(i){return i.part;})||d.lost.length))setTimeout(function(){toast('Isian terakhir yang belum terkirim dipulihkan');},300);
    $('bar').style.display='block';render();
  },function(msg){$('app').innerHTML='<div class="loading">Gagal memuat data: '+esc(msg)+'</div>';});
}
function route(page,base){
  BASE_URL=base||'';
  var ml=$('modeLink');
  if(BASE_URL){ml.style.display='inline-block';}
  if(page==='leader'){
    ml.textContent='Halaman input';ml.href=BASE_URL;
    $('hTitle').textContent='Validasi Leader';$('hSub').textContent='Quality Assurance • Persetujuan laporan';
    startLeader();
  } else {
    ml.textContent='Leader';ml.href=BASE_URL+'?page=leader';
    startMember();
  }
}
if(window.BOOT&&BOOT.url){
  setTimeout(function(){route(BOOT.page,BOOT.url);},0); // tunggu semua fungsi & variabel leader terdefinisi
} else if(window.google&&google.script&&google.script.url){
  google.script.url.getLocation(function(loc){
    var page=(loc.parameter&&loc.parameter.page)||'';
    call('getScriptUrl',[],function(u){route(page,u);},function(){route(page,'');});
  });
} else {
  route(new URLSearchParams(location.search).get('page')||'', location.pathname);
}

/* ---------- leader ---------- */
var L={name:'',pin:'',tab:'Menunggu',date:'',data:null,sel:{},open:{}};
var LKEY='qa-leader-name';
function startLeader(){
  $('bar').style.display='none';
  withMaster(function(m){M=m;renderLogin();},function(msg){$('app').innerHTML='<div class="loading">Gagal memuat data: '+esc(msg)+'</div>';});
}
function renderLogin(err){
  var saved='';try{saved=localStorage.getItem(LKEY)||'';}catch(e){}
  if(!L.name&&M.leaders.indexOf(saved)>=0)L.name=saved;
  var h='<div class="card login"><h2>Masuk sebagai leader</h2><p>Pilih nama dan masukkan PIN dari tab Leader di spreadsheet.</p>';
  if(!M.leaders.length)h+='<div class="notice">'+IC.warn+'<div>Belum ada leader. Isi nama dan PIN di tab <b>Leader</b> pada spreadsheet.</div></div>';
  h+='<div class="grid"><div class="f" data-k="lname"><span class="lb">Nama leader</span>'+pickBtn(L.name,'Pilih nama','pickLeader()')+'</div>'
    +'<label class="f"><span class="lb">PIN</span><input class="in num" id="lpin" type="password" inputmode="numeric" autocomplete="off" onkeydown="if(event.key===\\'Enter\\')doLogin()"></label>'
    +(err?'<div class="notice" style="margin-top:0">'+IC.warn+'<div>'+esc(err)+'</div></div>':'')
    +'<button class="btn" id="btnLogin" style="width:100%;justify-content:center" onclick="doLogin()">Masuk</button></div></div>';
  $('app').innerHTML=h;
}
function pickLeader(){openPick('Nama leader',opts(M.leaders),L.name,function(v){L.name=v;renderLogin();});}
function doLogin(){
  var pin=$('lpin').value;
  if(!L.name){toast('Pilih nama leader');return;}
  if(!pin){toast('Masukkan PIN');return;}
  var b=$('btnLogin');b.disabled=true;b.innerHTML='<span class="spin"></span> Memeriksa…';
  call('leaderLogin',[L.name,pin],function(){
    L.pin=pin;try{localStorage.setItem(LKEY,L.name);}catch(e){}
    loadQueue();
  },function(msg){renderLogin(msg);});
}
function loadQueue(keepSel){
  if(!keepSel)L.sel={};
  $('app').innerHTML=leaderShell('<div class="loading"><div class="spin"></div>Memuat kiriman…</div>');
  call('getAntrian',[L.name,L.pin,L.tab,L.date],function(r){L.data=r;renderQueue();},function(msg){toast(msg);renderLogin(msg);});
}
function leaderShell(body){
  var c=L.data?L.data.counts:{};
  var tab=function(k,label){return '<button class="'+(L.tab===k?'on':'')+'" onclick="L.tab=\\''+k+'\\';loadQueue()">'+label+(c[k]!=null?' <span class="c">'+c[k]+'</span>':'')+'</button>';};
  return '<div class="tabs">'+tab('Menunggu','Menunggu')+tab('Disetujui','Disetujui')+tab('Ditolak','Ditolak')+'</div>'
    +'<div class="lbar"><input class="in" type="date" value="'+esc(L.date)+'" onchange="L.date=this.value;loadQueue()">'
    +(L.date?'<button class="btn ghost" style="height:42px" onclick="L.date=\\'\\';loadQueue()">Semua tanggal</button>':'')
    +'<span style="font-size:12px;color:var(--muted);margin-left:auto">Masuk sebagai <b style="color:var(--ink)">'+esc(L.name)+'</b> • <a href="#" onclick="L.pin=\\'\\';L.data=null;renderLogin();return false" style="color:var(--red-d)">Keluar</a></span></div>'
    +body;
}
function subTotals(s){
  var n=function(v){var x=parseFloat(v);return isNaN(x)?0:x;},q=0,mn=0,ot=0,ng=0,lt=0;
  s.items.forEach(function(it){q+=n(it.normalQty)+n(it.otQty);mn+=n(it.normalMin);ot+=n(it.otMin);(it.ng||[]).forEach(function(v){ng+=n(v);});});
  s.lostTimes.forEach(function(l){lt+=n(l.minutes);});
  return {q:q,mn:mn,ot:ot,ng:ng,lt:lt};
}
function fmtDate(d){try{return new Date(d+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}}
function renderQueue(){
  var list=L.data.list,h='';
  if(!list.length){
    h='<div class="card"><div class="empty" style="padding:28px 0">'+(L.tab==='Menunggu'?'Tidak ada kiriman yang menunggu validasi.':'Belum ada kiriman '+L.tab.toLowerCase()+'.')+'</div></div>';
  } else {
    if(L.tab==='Menunggu'){
      var nsel=Object.keys(L.sel).filter(function(k){return L.sel[k];}).length,nok=list.filter(function(s){return !perluCek(s);}).length;
      h+='<div class="lbar" style="margin-top:0"><label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:13px;cursor:pointer"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--red)" '+(nok&&nsel===nok?'checked':'')+(nok?'':' disabled')+' onchange="selAll(this.checked)"> Pilih semua ('+nok+')</label>'
        +'<button class="btn" style="height:42px;margin-left:auto" '+(nsel?'':'disabled')+' onclick="approveSel()">Setujui '+(nsel||'')+' terpilih</button></div>';
    }
    list.forEach(function(s){
      var t=subTotals(s),w=[];
      if(t.mn+t.lt>M.normalMin)w.push('Menit normal + lost time '+fmt(t.mn+t.lt)+' > '+M.normalMin);
      if(t.ot/60>M.otLimitHrs)w.push('OT '+fmt(t.ot/60)+' jam > batas '+M.otLimitHrs+' jam');
      var cats={};s.items.forEach(function(it){cats[it.category]=1;});
      h+='<div class="card sc'+(L.open[s.id]?' open':'')+'" id="sc'+esc(s.id)+'"><div class="sc-h" onclick="toggleSc(\\''+esc(s.id)+'\\',event)">'
        +(L.tab==='Menunggu'&&!w.length?'<input type="checkbox" '+(L.sel[s.id]?'checked':'')+' onclick="event.stopPropagation();L.sel[\\''+esc(s.id)+'\\']=this.checked;renderQueue()">':'')
        +'<div class="ttl"><b>'+esc(s.member)+'</b><small>'+esc(fmtDate(s.date))+' • dikirim '+esc(s.sent.slice(5).replace('-','/'))+'</small>'
        +'<div class="chips"><span class="chip">'+s.items.length+' part</span><span class="chip">'+fmt(t.q)+' pcs</span><span class="chip">'+fmt(t.mn)+' mnt'+(t.ot?' + OT '+fmt(t.ot):'')+'</span>'
        +(t.ng?'<span class="chip" style="background:var(--red-soft);color:var(--red-d)">NG '+fmt(t.ng)+'</span>':'')
        +(s.lostTimes.length?'<span class="chip">LT '+fmt(t.lt)+' mnt</span>':'')
        +(w.length?'<span class="chip" style="background:var(--warn-soft);color:var(--warn)">Perlu dicek</span>':'')
        +(s.edited?'<span class="chip" style="background:var(--ok-soft);color:var(--ok)">Diedit '+esc(s.edited)+'</span>':'')+'</div>'
        +(s.status!=='Menunggu'?'<small style="margin-top:6px">'+esc(s.status)+' oleh '+esc(s.leader)+' • '+esc(s.decided.slice(5).replace('-','/'))+(s.note?' • '+esc(s.note):'')+'</small>':'')
        +'</div><span class="icon-btn">'+IC.chev+'</span></div>';
      h+='<div class="sc-b"><div class="rv">';
      if(s.items.length){
        h+='<table><tr><th>Part</th><th style="text-align:right">Normal</th><th style="text-align:right">OT</th><th style="text-align:right">NG</th></tr>';
        s.items.forEach(function(it){
          var ng=0;(it.ng||[]).forEach(function(v){ng+=parseFloat(v)||0;});
          h+='<tr><td><b>'+esc(it.part)+'</b> '+esc(it.type&&it.type!=='-'?it.type:'')+'<br><small style="color:var(--muted)">'+esc(it.category)+(it.mc&&it.mc!=='-'?' • '+esc(it.mc):'')+(it.lot?' • Lot '+esc(it.lot):'')+(it.oiban?' • Oiban '+esc(it.oiban):'')+'</small></td>'
            +'<td class="n">'+fmt(parseFloat(it.normalQty)||0)+' pcs<br><small style="color:var(--muted)">'+fmt(parseFloat(it.normalMin)||0)+' mnt</small></td>'
            +'<td class="n">'+(parseFloat(it.otQty)?fmt(parseFloat(it.otQty))+' pcs<br><small style="color:var(--muted)">'+fmt(parseFloat(it.otMin)||0)+' mnt</small>':'-')+'</td>'
            +'<td class="n">'+(ng?fmt(ng):'-')+'</td></tr>';
        });
        h+='</table>';
      }
      if(s.lostTimes.length){
        h+='<table style="margin-top:12px"><tr><th>Lost time / Another job</th><th style="text-align:right">Menit</th></tr>';
        s.lostTimes.forEach(function(l){h+='<tr><td>'+esc(l.type)+(l.remarks?'<br><small style="color:var(--muted)">'+esc(l.remarks)+'</small>':'')+'</td><td class="n">'+fmt(parseFloat(l.minutes)||0)+'</td></tr>';});
        h+='</table>';
      }
      if(w.length)h+=w.map(function(x){return '<div class="notice">'+IC.warn+'<div>'+esc(x)+'</div></div>';}).join('');
      h+='</div>';
      if(L.tab==='Menunggu')h+='<div class="sc-f"><button class="btn ghost" onclick="rejectOne(\\''+esc(s.id)+'\\')">Tolak</button><button class="btn dark" onclick="editOne(\\''+esc(s.id)+'\\')">Edit</button><button class="btn" onclick="decide([\\''+esc(s.id)+'\\'],\\'ok\\',\\'\\')">Setujui</button></div>';
      h+='</div></div>';
    });
  }
  $('app').innerHTML=leaderShell(h);
}
function toggleSc(id,e){L.open[id]=!L.open[id];var el=$('sc'+id);if(el)el.classList.toggle('open');}
function perluCek(s){var t=subTotals(s);return t.mn+t.lt>M.normalMin||t.ot/60>M.otLimitHrs;}
function selAll(v){L.sel={};if(v)L.data.list.forEach(function(s){if(!perluCek(s))L.sel[s.id]=true;});renderQueue();}
function approveSel(){
  var ids=Object.keys(L.sel).filter(function(k){return L.sel[k];});
  if(!ids.length)return;
  if(!confirm('Setujui '+ids.length+' kiriman? Datanya akan masuk ke Dashboard.'))return;
  decide(ids,'ok','');
}
function rejectOne(id){
  var note=prompt('Alasan penolakan (akan dilihat member):');
  if(note===null)return;
  if(!note.trim()){toast('Alasan wajib diisi');return;}
  decide([id],'no',note.trim());
}
/* ---------- leader: edit kiriman ---------- */
var E=null;
function editOne(id){
  var s=L.data.list.filter(function(x){return x.id===id;})[0];if(!s)return;
  E={id:id,member:s.member,date:s.date,items:JSON.parse(JSON.stringify(s.items)),lost:JSON.parse(JSON.stringify(s.lostTimes))};
  E.items.forEach(function(it){it.ng=(it.ng||[]).concat(['','','','','','','','','','']).slice(0,10);});
  renderEdit();$('edOv').classList.add('open');
}
function closeEdit(){$('edOv').classList.remove('open');E=null;}
function edIn(label,val,path,num){
  return '<label class="f"><span class="lb">'+esc(label)+'</span><input class="in'+(num?' num':'')+'"'+(num?' inputmode="decimal"':'')+' value="'+esc(val)+'" oninput="'+path+'=this.value"></label>';
}
function edSel(label,list,val,path,rerender){
  var o=list.slice();if(val&&o.indexOf(val)<0)o.unshift(val);
  return '<label class="f"><span class="lb">'+esc(label)+'</span><select class="in" onchange="'+path+'=this.value'+(rerender?';renderEdit()':'')+'">'
    +(val?'':'<option value="">Pilih…</option>')
    +o.map(function(x){return '<option value="'+esc(x)+'"'+(x===val?' selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select></label>';
}
function renderEdit(){
  var h='<div class="meta"><span><b>'+esc(E.member)+'</b></span><span>'+esc(fmtDate(E.date))+'</span></div>';
  E.items.forEach(function(it,ix){
    var c=cat(it.category),p=partOf(c,it.part),P='E.items['+ix+']';
    h+='<div class="ed-it"><div class="ed-h"><div class="grow"><b>'+esc(it.part)+'</b><small>'+esc(it.category)+'</small></div>'
      +'<button class="icon-btn" title="Hapus part" onclick="E.items.splice('+ix+',1);renderEdit()">'+IC.del+'</button></div><div class="ed-g">'
      +(c?edSel('Part',c.parts.map(function(x){return x.name;}),it.part,P+'.part',true):'')
      +(p&&p.types.length?edSel('Type',p.types,it.type,P+'.type'):'')
      +(c&&c.machines.length?edSel('MC No',['-'].concat(c.machines),it.mc,P+'.mc'):'')
      +edIn('Lot',it.lot,P+'.lot')
      +edIn('Qty normal',it.normalQty,P+'.normalQty',1)+edIn('Menit normal',it.normalMin,P+'.normalMin',1)
      +edIn('Qty OT',it.otQty,P+'.otQty',1)+edIn('Menit OT',it.otMin,P+'.otMin',1)
      +edIn('Oiban',it.oiban,P+'.oiban')+'</div><div class="ed-sec">NG (pcs)</div><div class="ed-g">';
    for(var k=0;k<10;k++)h+=edIn((c&&c.ng&&c.ng[k])||('NG'+(k+1)),it.ng[k],P+'.ng['+k+']',1);
    h+='</div></div>';
  });
  h+='<div class="ed-sec">Lost time / Another job</div>';
  E.lost.forEach(function(l,ix){
    var P='E.lost['+ix+']';
    h+='<div class="ed-it"><div class="ed-g">'+edSel('Jenis',M.lostTypes,l.type,P+'.type')+edIn('Menit',l.minutes,P+'.minutes',1)+'</div>'
      +'<div class="ed-h" style="margin:10px 0 0"><div class="grow">'+edIn('Keterangan',l.remarks||'',P+'.remarks')+'</div>'
      +'<button class="icon-btn" title="Hapus" onclick="E.lost.splice('+ix+',1);renderEdit()">'+IC.del+'</button></div></div>';
  });
  h+='<button class="add" style="height:44px" onclick="E.lost.push({type:\\'\\',minutes:\\'\\',remarks:\\'\\'});renderEdit()">'+IC.plus+' Tambah lost time</button>';
  $('edBody').innerHTML=h;
}
function saveEdit(andApprove){
  if(!E.items.length&&!E.lost.length){toast('Laporan tidak boleh kosong');return;}
  for(var i=0;i<E.lost.length;i++){if(!E.lost[i].type||!n(E.lost[i].minutes)){toast('Lost time #'+(i+1)+': jenis dan menit wajib diisi');return;}}
  var id=E.id,b1=$('btnEdSave'),b2=$('btnEdOk');b1.disabled=b2.disabled=true;
  call('editKiriman',[L.name,L.pin,id,{items:E.items,lostTimes:E.lost}],function(){
    b1.disabled=b2.disabled=false;closeEdit();
    if(andApprove)decide([id],'ok','');else{toast('Perubahan disimpan');loadQueue(true);}
  },function(msg){b1.disabled=b2.disabled=false;toast('Gagal menyimpan: '+msg);});
}
function decide(ids,action,note){
  toast(action==='ok'?'Menyimpan persetujuan…':'Menyimpan penolakan…');
  call('putuskan',[L.name,L.pin,ids,action,note],function(r){
    var msg=(action==='ok'?r.ok+' kiriman disetujui dan masuk ke sheet':r.ok+' kiriman ditolak');
    if(r.skip)msg+=' ('+r.skip+' sudah diproses leader lain)';
    if(r.errors.length)msg='Gagal: '+r.errors[0];
    toast(msg);loadQueue();
  });
}
</script>
</body>
</html>
`;
