// Logika Laporan Produksi QA yang dulu ada di Code.gs (Apps Script), dipindah ke server Vercel.
// Struktur Google Sheet tidak berubah: Master Data, Leader, Users, Antrian Validasi,
// Input - Production, Input - Lost Time. Nama fungsi sengaja sama dengan Code.gs v1.5 karena
// halaman form member dan leader (public/legacy) memanggilnya lewat /api/rpc/<nama>.
// v1.7: menit MC per mesin (AM:AN), waktu operator per laporan (op), oiban rentang (AO:AP),
// Standar MC PF di Master Data BI:BM. v1.8: catatan NG Lain-lain (ngNote) ke AW.
import { newSubmissionId, nowJakarta, serialToText, todayJakarta } from "../dates";
import { googleSheets, type Cell, type Grid, type SheetsIO } from "./client";

export class QaError extends Error {}

const SHEET_MASTER = "Master Data";
const SHEET_PROD = "Input - Production";
const SHEET_LT = "Input - Lost Time";
const SHEET_QUEUE = "Antrian Validasi";
const SHEET_LEADER = "Leader";
const SHEET_USERS = "Users";
const FIRST_DATA_ROW = 7;
const PROD_WIDTH = 22; // B..W
const LT_WIDTH = 5; // B..F
const PROD_EXTRA = "AM"; // AM..AP: MC Min Normal, MC Min OT, Oiban List, Jml Oiban
const PROD_EXTRA_END = "AP";
const PROD_NOTE = "AW"; // Catatan NG Lain-lain
const ST_WAIT = "Menunggu",
  ST_OK = "Disetujui",
  ST_NO = "Ditolak";

let io: SheetsIO = googleSheets;
/** Untuk tes: ganti Google Sheets dengan sheet palsu. */
export function setSheetsIO(x: SheetsIO | null) {
  io = x ?? googleSheets;
  masterCache = null;
}

/** Sheet yang sedang dipakai (asli atau palsu di tes). */
export const sheetsIO = () => io;

const q = (title: string) => `'${title}'`;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const cell = (g: Grid, r: number, c: number) => s(g[r]?.[c]);
const num = (v: unknown) => (v === "" || v === null || v === undefined ? "" : Number(v));
const txt = (v: unknown) => s(v).trim();
/** Teks ditulis dengan awalan ' supaya Sheet tidak mengubahnya jadi angka, tanggal, atau rumus. */
const asText = (v: unknown) => (s(v) === "" ? "" : `'${s(v)}`);
const aktif = (st: string) => st !== "Inactive" && st !== "Tidak Aktif";

function dayOf(v: unknown): string {
  if (typeof v === "number") return serialToText(v);
  const t = s(v);
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
}
function timeOf(v: unknown): string {
  if (typeof v === "number") return serialToText(v, true);
  return s(v);
}

// Kunci sederhana di dalam satu server: kiriman/approve yang datang bersamaan diproses bergantian.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

// ---------- Master Data ----------

export type V1Category = {
  name: string;
  process: string;
  parts: { name: string; types: string[] }[];
  machines: string[];
  mcInfo?: Record<string, { line: string; main: string; alt: string }>;
  ng: string[];
  ngGroup?: string;
};
export type V1Master = {
  members: string[];
  categories: V1Category[];
  lostTypes: string[];
  lostGroups: Record<string, string>;
  leaders: string[];
  normalMin: number;
  otLimitHrs: number;
  today: string;
};
type FullMaster = V1Master & {
  nik: Record<string, string>;
  /** Section member (kolom E Master Data); kosong = QA. */
  section: Record<string, string>;
  stki: Record<string, number>;
  stdMc: Record<string, number>;
  settings: Record<string, Cell>;
};

let masterCache: { at: number; data: FullMaster } | null = null;
const MASTER_TTL = 60_000;

async function leaders(): Promise<{ name: string; pin: string }[]> {
  const [g] = await io.get([`${q(SHEET_LEADER)}!A2:B`], "FORMATTED_VALUE");
  return g.filter((r) => s(r[0]) && s(r[1])).map((r) => ({ name: s(r[0]).trim(), pin: s(r[1]).trim() }));
}

async function readMaster(): Promise<FullMaster> {
  if (masterCache && Date.now() - masterCache.at < MASTER_TTL) return masterCache.data;
  const [[F, L], [U, SET]] = await Promise.all([
    io.get([`${q(SHEET_MASTER)}!A1:CZ`, `${q(SHEET_LEADER)}!A2:B`], "FORMATTED_VALUE"),
    io.get([`${q(SHEET_MASTER)}!A7:CZ`, `${q(SHEET_MASTER)}!S7:T30`], "UNFORMATTED_VALUE"),
  ]);
  const members: string[] = [];
  const nik: Record<string, string> = {};
  const section: Record<string, string> = {};
  for (let r = 6; r < F.length; r++) {
    const name = cell(F, r, 2).trim();
    if (name && aktif(cell(F, r, 3))) {
      members.push(name);
      nik[name] = cell(F, r, 1).trim();
      section[name] = cell(F, r, 4).trim();
    }
  }

  const categories: V1Category[] = [];
  let r = 6;
  for (; r < F.length && cell(F, r, 15) && cell(F, r, 15) !== "Lost Time Type"; r++)
    categories.push({ name: cell(F, r, 15), process: cell(F, r, 16), parts: [], machines: [], ng: [] });
  const lostTypes: string[] = [];
  const lostGroups: Record<string, string> = {};
  const lt = F.findIndex((row) => s(row[15]) === "Lost Time Type");
  if (lt >= 0)
    for (let i = lt + 1; i < F.length && cell(F, i, 15); i++) {
      lostTypes.push(cell(F, i, 15));
      if (cell(F, i, 16)) lostGroups[cell(F, i, 15)] = cell(F, i, 16);
    }
  const byName: Record<string, V1Category> = {};
  categories.forEach((c) => (byName[c.name] = c));

  const partIdx: Record<string, { name: string; types: string[] }> = {};
  for (let i = 6; i < F.length; i++) {
    const cat = cell(F, i, 6),
      part = cell(F, i, 8),
      type = cell(F, i, 9);
    const c = byName[cat];
    if (!c || !part) continue;
    const key = `${cat}|${part}`;
    if (!partIdx[key]) c.parts.push((partIdx[key] = { name: part, types: [] }));
    if (type && !partIdx[key].types.includes(type)) partIdx[key].types.push(type);
  }
  const stki: Record<string, number> = {};
  for (const row of U) if (row[6] && row[8]) stki[`${s(row[6])}|${s(row[8])}|${s(row[9])}`] = Number(row[10]) || 0;

  // Kolom tabel mesin & NG dicari dari judul di baris 6, jadi aman bila kolom disisipkan.
  const head = (F[5] ?? []).map(s);
  const col = (name: string, from = 0) => head.indexOf(name, from);
  const mcCol = col("MC No");
  if (mcCol > 0) {
    const stCol = col("Status", mcCol),
      lnCol = col("Line", mcCol),
      mainCol = col("Part utama", mcCol),
      altCol = col("Bisa ganti ke", mcCol);
    const g = (row: Cell[], c: number) => (c > 0 ? s(row[c]).trim() : "");
    for (let i = 6; i < F.length; i++) {
      const row = F[i] ?? [];
      const cat = s(row[mcCol - 1]),
        mc = s(row[mcCol]);
      if (!byName[cat] || !mc || !aktif(g(row, stCol))) continue;
      byName[cat].machines.push(mc);
      (byName[cat].mcInfo ??= {})[mc] = { line: g(row, lnCol), main: g(row, mainCol), alt: g(row, altCol) };
    }
  }
  const ngNames: Record<string, string[]> = {};
  const codeCol = col("Code");
  if (codeCol > 0)
    for (let i = 6; i < Math.min(F.length, 26); i++) {
      const grp = cell(F, i, codeCol + 1);
      if (grp) (ngNames[grp] ??= []).push(cell(F, i, codeCol + 2));
    }
  const grpCol = col("NG Group", codeCol + 2);
  if (grpCol > 0)
    for (let i = 6; i < Math.min(F.length, 20); i++) {
      const c = byName[cell(F, i, grpCol - 1)];
      if (c) {
        c.ngGroup = cell(F, i, grpCol);
        c.ng = ngNames[c.ngGroup] ?? [];
      }
    }

  // Standar MC khusus PF (pcs/jam per MC), terpisah dari STKI part.
  const stdMc: Record<string, number> = {};
  const stdCol = col("Std Category");
  if (stdCol > 0)
    for (const row of U) {
      const v = Number(row[stdCol + 3]);
      if (s(row[stdCol]) && s(row[stdCol + 1]) && v > 0) stdMc[`${s(row[stdCol])}|${s(row[stdCol + 1])}|${s(row[stdCol + 2])}`] = v;
    }

  const settings: Record<string, Cell> = {};
  for (const row of SET) if (s(row[0])) settings[s(row[0])] = row[1] ?? "";
  const setting = (label: string, def: number) => {
    const k = Object.keys(settings).find((x) => x.indexOf(label) === 0);
    return k !== undefined && settings[k] !== "" ? Number(settings[k]) : def;
  };

  const data: FullMaster = {
    members,
    categories,
    lostTypes,
    lostGroups,
    leaders: L.filter((x) => s(x[0]) && s(x[1])).map((x) => s(x[0]).trim()),
    normalMin: setting("Normal working time", 480),
    otLimitHrs: setting("OT limit", 4),
    today: todayJakarta(),
    nik,
    section,
    stki,
    stdMc,
    settings,
  };
  masterCache = { at: Date.now(), data };
  return data;
}

export function clearMasterCache() {
  masterCache = null;
}

/** Master Data untuk form member & leader (bentuk sama dengan Code.gs getMasterData). */
export async function getMasterData(): Promise<V1Master> {
  const { nik: _n, section: _c, stki: _s, stdMc: _m, settings: _x, ...m } = await readMaster();
  return { ...m, today: todayJakarta() };
}

/** Master Data untuk report di Vercel (NIK, STKI, grup lost time, setting grade). */
const MC_HRS_CAT = "Machine available hrs / day - ";

export async function apiMaster() {
  const m = await readMaster();
  const parts: { category: string; name: string; type: string; stki: number }[] = [];
  m.categories.forEach((c) =>
    c.parts.forEach((p) => (p.types.length ? p.types : [""]).forEach((t) => parts.push({ category: c.name, name: p.name, type: t, stki: m.stki[`${c.name}|${p.name}|${t}`] || 0 }))),
  );
  const machines: { category: string; mc: string; line: string; main: string; alt: string }[] = [];
  m.categories.forEach((c) => c.machines.forEach((mc) => machines.push({ category: c.name, mc, line: "", main: "", alt: "", ...(c.mcInfo?.[mc] ?? {}) })));
  const raw = (label: string, def: number) => {
    const k = Object.keys(m.settings).find((x) => x.indexOf(label) === 0 && !x.startsWith(MC_HRS_CAT));
    return k !== undefined && m.settings[k] !== "" && Number(m.settings[k]) > 0 ? Number(m.settings[k]) : def;
  };
  const val = (label: string, def: number) => {
    const k = Object.keys(m.settings).find((x) => x.indexOf(label) === 0);
    if (k === undefined || m.settings[k] === "") return def;
    const v = Number(m.settings[k]);
    return v <= 5 ? v * 100 : v; // 100% tersimpan sebagai 1
  };
  return {
    today: todayJakarta(),
    members: m.members.map((name) => ({ nik: m.nik[name] ?? "", name, section: m.section[name] ?? "" })),
    categories: m.categories.map((c) => ({ name: c.name, process: c.process, ngGroup: c.ngGroup ?? "", ng: c.ng })),
    parts,
    machines,
    lostTypes: m.lostTypes.map((t) => ({ name: t, group: m.lostGroups[t] || "Lost Time" })),
    settings: {
      normalMin: m.normalMin,
      otLimitHrs: m.otLimitHrs,
      target: val("Achievement target", 100),
      gradeA: val("Grade A", 100),
      gradeB: val("Grade B", 90),
      gradeC: val("Grade C", 80),
      ngPpmMax: raw("NG limit", 1000),
      mcHrsDay: raw("Machine available hrs / day", m.normalMin / 60),
      // Baris "Machine available hrs / day - <Kategori>" mengganti nilai umum untuk kategori itu (mis. 16 = 2 shift).
      mcHrsCat: Object.fromEntries(
        Object.keys(m.settings)
          .filter((k) => k.startsWith(MC_HRS_CAT) && Number(m.settings[k]) > 0)
          .map((k) => [k.slice(MC_HRS_CAT.length).trim(), Number(m.settings[k])]),
      ),
      utilTarget: val("Machine utilization target", 85),
    },
  };
}

// ---------- Antrian ----------

export type Item = Record<string, unknown> & { ng?: unknown[] };
export type QueueEntry = {
  row: number;
  id: string;
  sent: string;
  date: string;
  member: string;
  parts: number;
  qty: number;
  ltMin: number;
  status: string;
  leader: string;
  decided: string;
  note: string;
  items: Item[];
  lostTimes: Item[];
  op: Op | null;
  edited: string;
  meta: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

async function readQueue(): Promise<QueueEntry[]> {
  const [g] = await io.get([`${q(SHEET_QUEUE)}!A2:L`], "UNFORMATTED_VALUE");
  return g
    .map((r, i) => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(s(r[11]) || "{}");
      } catch {}
      return {
        row: i + 2,
        id: s(r[0]),
        sent: timeOf(r[1]),
        date: s(data.date) || dayOf(r[2]),
        member: s(r[3]),
        parts: Number(r[4]) || 0,
        qty: Number(r[5]) || 0,
        ltMin: Number(r[6]) || 0,
        status: s(r[7]) || ST_WAIT,
        leader: s(r[8]),
        decided: r[9] === "" || r[9] === undefined ? "" : timeOf(r[9]),
        note: s(r[10]),
        items: (data.items as Item[]) || [],
        lostTimes: (data.lostTimes as Item[]) || [],
        op: (data.op as Op) || null,
        edited: s(data.editedBy),
        meta: (data.meta as Record<string, unknown>) || null,
        raw: data,
      };
    })
    .filter((x) => x.id);
}

const pub = ({ row: _r, raw: _x, ...rest }: QueueEntry) => rest;

// ---------- Validasi & baris Input ----------

/** Waktu operator jaga mesin per laporan (menit normal & OT), bukan per MC. */
export type Op = { min?: unknown; ot?: unknown };
type Payload = { date?: string; member?: string; items?: Item[]; lostTimes?: Item[]; op?: Op | null; replaceId?: string; meta?: unknown };

/** Part di mesin (bagian PF): kategori punya MC, MC dipilih, dan diisi format baru (menit MC jalan). */
function isMc(it: Item, c: V1Category | undefined) {
  return !!(c && c.machines.length && it.mc && it.mc !== "-" && it.mcMin !== undefined);
}

/**
 * Waktu operator (op.min normal, op.ot lembur) dibagi ke part mesin sesuai menit MC jalan,
 * supaya Normal Min / OT Min di Input - Production tetap waktu orang (total 480), sedangkan
 * menit mesin disimpan terpisah di kolom AM:AN.
 */
export function alokasiOp(items: Item[], op: Op | null | undefined, cats: Record<string, V1Category>): Item[] {
  const n = (v: unknown) => Number(v) || 0;
  const out = items.map((it) => ({ ...it }));
  const mc = out.filter((it) => isMc(it, cats[s(it.category)]));
  if (!mc.length) return out;
  if (!op) {
    mc.forEach((it) => {
      it.normalMin = it.mcMin;
      it.otMin = it.mcOtMin;
    });
    return out;
  }
  const bagi = (opMin: unknown, mcKey: string, minKey: string, qtyKey: string) => {
    const total = n(opMin);
    const ikut = mc.filter((it) => n(it[mcKey]) || n(it[qtyKey]));
    mc.forEach((it) => (it[minKey] = ""));
    if (!total || !ikut.length) return;
    const sum = ikut.reduce((a, it) => a + n(it[mcKey]), 0);
    let sisa = total;
    ikut.forEach((it, i) => {
      const v = i === ikut.length - 1 ? sisa : Math.round(total * (sum ? n(it[mcKey]) / sum : 1 / ikut.length) * 100) / 100;
      it[minKey] = Math.round(v * 100) / 100;
      sisa -= it[minKey] as number;
    });
  };
  bagi(op.min, "mcMin", "normalMin", "normalQty");
  bagi(op.ot, "mcOtMin", "otMin", "otQty");
  return out;
}

/** "1-6, 8, 10-12" -> ['1',...,'6','8','10','11','12']. Pemisah koma, titik, spasi; rentang pakai - atau s/d. */
export function uraiOiban(text: unknown): { list: string[]; err: string } {
  let x = s(text).trim();
  if (!x) return { list: [], err: "" };
  x = x
    .replace(/\s*(s\/d|s\.d\.?|sampai|~|–|—)\s*/gi, "-")
    .replace(/(\d)\s*sd\s*(\d)/gi, "$1-$2")
    .replace(/\s*-\s*/g, "-");
  const list: string[] = [];
  let err = "";
  x.split(/[,;.\s/]+/).forEach((t) => {
    if (!t) return;
    const mm = t.match(/^(\d+)-(\d+)$/);
    if (!mm) {
      list.push(t);
      return;
    }
    const a = Number(mm[1]),
      b = Number(mm[2]),
      w = mm[1].charAt(0) === "0" ? mm[1].length : 0;
    if (b < a || b - a > 500) {
      err = `rentang oiban "${t}" tidak wajar`;
      return;
    }
    for (let k = a; k <= b; k++) list.push(w ? String(k).padStart(w, "0") : String(k));
  });
  return { list, err };
}

function bangunBaris(payload: Payload, m: V1Master) {
  const p = s(payload.date).split("-").map(Number);
  if (p.length !== 3 || !p[0]) throw new QaError("Tanggal belum diisi.");
  if (!m.members.includes(s(payload.member))) throw new QaError("Nama member tidak ada di Master Data.");
  const lost = payload.lostTimes || [];
  const cats: Record<string, V1Category> = {};
  m.categories.forEach((c) => (cats[c.name] = c));
  const items = alokasiOp(payload.items || [], payload.op, cats);
  if (!items.length && !lost.length) throw new QaError("Belum ada part atau lost time yang diisi.");
  const dateFormula = `=DATE(${p[0]},${p[1]},${p[2]})`;
  const prodRows: Cell[][] = items.map((it, i) => {
    const c = cats[s(it.category)];
    if (!c) throw new QaError(`Part #${i + 1}: kategori tidak dikenal.`);
    if (!c.parts.some((x) => x.name === it.part)) throw new QaError(`Part #${i + 1}: part tidak ada di kategori ${c.name}.`);
    const ob = uraiOiban(it.oiban);
    if (ob.err) throw new QaError(`Part #${i + 1}: ${ob.err}.`);
    const ng: Cell[] = [];
    for (let k = 0; k < 10; k++) ng.push(num((it.ng || [])[k]));
    return [dateFormula, asText(payload.member), asText(c.name), asText(it.part), asText(txt(it.type)), num(it.normalQty), num(it.normalMin), num(it.otQty), num(it.otMin), asText(txt(it.lot)), asText(txt(it.oiban)), asText(txt(it.mc)), ...ng];
  });
  const extraRows: Cell[][] = items.map((it) => {
    const mc = isMc(it, cats[s(it.category)]),
      ob = uraiOiban(it.oiban);
    return [mc ? num(it.mcMin) : "", mc ? num(it.mcOtMin) : "", asText(ob.list.join(", ")), ob.list.length || ""];
  });
  const noteRows: Cell[][] = items.map((it) => [asText(txt(it.ngNote))]);
  const ltRows: Cell[][] = lost.map((l, i) => {
    if (!m.lostTypes.includes(s(l.type))) throw new QaError(`Lost time #${i + 1}: jenis tidak dikenal.`);
    return [dateFormula, asText(payload.member), asText(l.type), num(l.minutes), asText(txt(l.remarks))];
  });
  return { prodRows, ltRows, extraRows, noteRows, items };
}

const colLetter = (n: number) => {
  let x = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) x = String.fromCharCode(65 + ((n - 1) % 26)) + x;
  return x;
};

/** Tulis baris setelah baris terakhir yang terisi di kolom input (B..). Mengembalikan nomor baris pertama. */
async function tulis(title: string, rows: Cell[][], width: number, extraClear: string[] = []) {
  clearInputCache();
  const end = colLetter(1 + width);
  const [[data], counts] = await Promise.all([io.get([`${q(title)}!B${FIRST_DATA_ROW}:${end}`], "UNFORMATTED_VALUE"), io.rowCounts()]);
  let lastFilled = -1;
  for (let i = data.length - 1; i >= 0; i--)
    if ((data[i] ?? []).some((v) => v !== "" && v !== null)) {
      lastFilled = i;
      break;
    }
  const start = FIRST_DATA_ROW + lastFilled + 1;
  const maxRows = counts[title]?.rows ?? 0;
  const need = start + rows.length - 1 - maxRows;
  if (need > 0) await io.growSheet(title, Math.max(need, 200), [`B:${end}`, ...extraClear]);
  await io.update([{ range: `${q(title)}!B${start}:${end}${start + rows.length - 1}`, values: rows }]);
  return start;
}

// ---------- Sinkron dari Sheet lama (Apps Script) ----------

/**
 * Salin laporan yang SUDAH DISETUJUI di Sheet lama (Input - Production & Input - Lost Time, struktur sama)
 * ke Sheet ini untuk tanggal from..to (yyyy-MM-dd). Satu member per tanggal disalin utuh sekali saja:
 * kalau member itu sudah punya baris di tanggal tsb (dari sinkron sebelumnya atau input langsung di Vercel),
 * dilewati. Jadi aman dijalankan berulang, dan laporan yang baru disetujui belakangan ikut di malam berikutnya.
 */
export async function sinkronDariSheetLama(src: Pick<SheetsIO, "get">, from: string, to: string) {
  const [sp, sl] = await src.get([`${q(SHEET_PROD)}!B${FIRST_DATA_ROW}:AW`, `${q(SHEET_LT)}!B${FIRST_DATA_ROW}:F`], "UNFORMATTED_VALUE");
  return locked(async () => {
    const [tp, tl] = await io.get([`${q(SHEET_PROD)}!B${FIRST_DATA_ROW}:C`, `${q(SHEET_LT)}!B${FIRST_DATA_ROW}:C`], "UNFORMATTED_VALUE");
    const key = (r: Cell[]) => `${dayOf(r[0])}|${txt(r[1])}`;
    const sudah = new Set([...tp, ...tl].filter((r) => txt(r[1])).map(key));
    const ambil = (r: Cell[]) => {
      const d = dayOf(r[0]);
      return !!txt(r[1]) && d >= from && d <= to && !sudah.has(key(r));
    };
    const tgl = (v: unknown) => {
      const [y, m, d] = dayOf(v).split("-").map(Number);
      return `=DATE(${y},${m},${d})`;
    };
    const prod = sp.filter(ambil);
    const lt = sl.filter(ambil);
    const prodRows: Cell[][] = prod.map((r) => [
      tgl(r[0]), asText(txt(r[1])), asText(txt(r[2])), asText(txt(r[3])), asText(txt(r[4])),
      num(r[5]), num(r[6]), num(r[7]), num(r[8]), asText(txt(r[9])), asText(txt(r[10])), asText(txt(r[11])),
      ...Array.from({ length: 10 }, (_, k) => num(r[12 + k])),
    ]);
    // AM..AP = indeks 37..40 dari kolom B, AW = 47.
    const extraRows: Cell[][] = prod.map((r) => [num(r[37]), num(r[38]), asText(txt(r[39])), num(r[40])]);
    const noteRows: Cell[][] = prod.map((r) => [asText(txt(r[47]))]);
    const ltRows: Cell[][] = lt.map((r) => [tgl(r[0]), asText(txt(r[1])), asText(txt(r[2])), num(r[3]), asText(txt(r[4]))]);
    if (prodRows.length) {
      const start = await tulis(SHEET_PROD, prodRows, PROD_WIDTH, [`${PROD_EXTRA}:${PROD_EXTRA_END}`, `${PROD_NOTE}:${PROD_NOTE}`]);
      const endRow = start + prodRows.length - 1;
      const data = [{ range: `${q(SHEET_PROD)}!${PROD_EXTRA}${start}:${PROD_EXTRA_END}${endRow}`, values: extraRows }];
      if (noteRows.some((r) => r[0])) data.push({ range: `${q(SHEET_PROD)}!${PROD_NOTE}${start}:${PROD_NOTE}${endRow}`, values: noteRows });
      await io.update(data);
    }
    if (ltRows.length) await tulis(SHEET_LT, ltRows, LT_WIDTH);
    const members = [...new Set([...prod, ...lt].map(key))].sort();
    return { from, to, prod: prodRows.length, lt: ltRows.length, members };
  });
}

// ---------- Fungsi yang dipanggil halaman form member ----------

export async function cekLaporan(dateStr: string, member: string) {
  if (!dateStr || !member) return { prod: 0, lt: 0, subs: [] };
  const [[prod, lt], queue] = await Promise.all([
    io.get([`${q(SHEET_PROD)}!B${FIRST_DATA_ROW}:C`, `${q(SHEET_LT)}!B${FIRST_DATA_ROW}:C`], "UNFORMATTED_VALUE"),
    readQueue(),
  ]);
  const count = (g: Grid) => g.filter((r) => s(r[1]) === member && dayOf(r[0]) === dateStr).length;
  const subs = queue
    .filter((x) => x.date === dateStr && x.member === member)
    .map((x) => ({
      id: x.id,
      status: x.status,
      sent: x.sent,
      parts: x.parts,
      note: x.note,
      leader: x.leader,
      items: x.status === ST_NO ? x.items : [],
      lostTimes: x.status === ST_NO ? x.lostTimes : [],
      op: x.status === ST_NO ? x.op : null,
    }));
  return { prod: count(prod), lt: count(lt), subs };
}

export async function submitReport(payload: Payload) {
  const m = await getMasterData();
  const rows = bangunBaris(payload, m); // validasi sekarang, tulis ke Input setelah disetujui
  const items = rows.items,
    lost = payload.lostTimes || [];
  const n = (v: unknown) => Number(v) || 0;
  const totalQty = items.reduce((a, it) => a + n(it.normalQty) + n(it.otQty), 0);
  const ltMin = lost.reduce((a, l) => a + n(l.minutes), 0);
  const rec: Record<string, unknown> = { date: payload.date, member: payload.member, items, lostTimes: lost };
  if (payload.op) rec.op = payload.op; // waktu operator di mesin {min, ot}
  if (payload.meta) rec.meta = payload.meta;
  const data = JSON.stringify(rec);
  return locked(async () => {
    if (payload.replaceId) {
      // Member mengedit kiriman sendiri yang masih Menunggu: baris lama diganti, bukan ditambah.
      const x = (await readQueue()).find((y) => y.id === payload.replaceId);
      if (!x || x.member !== payload.member) throw new QaError("Kiriman yang diedit tidak ditemukan.");
      if (x.status !== ST_WAIT) throw new QaError(`Kiriman ini sudah ${x.status.toLowerCase()} leader, jadi tidak bisa diedit lagi.`);
      await io.update([
        { range: `${q(SHEET_QUEUE)}!B${x.row}:G${x.row}`, values: [[nowJakarta(), s(payload.date), asText(payload.member), items.length, totalQty, ltMin]] },
        { range: `${q(SHEET_QUEUE)}!K${x.row}:L${x.row}`, values: [["Diedit member", asText(data)]] },
      ]);
      return { id: x.id, prod: rows.prodRows.length, lt: rows.ltRows.length, pending: true, replaced: true };
    }
    // Kiriman yang persis sama (member, tanggal, isi) dan masih Menunggu dianggap kiriman ganda, mis. tombol Kirim
    // ditekan dua kali atau dikirim ulang karena sinyal putus. Kembalikan kiriman yang sudah ada, jangan tambah baris.
    const inti = (x: { items: unknown; lostTimes: unknown; op?: unknown }) => JSON.stringify([x.items, x.lostTimes, x.op ?? null]);
    const kembar = (await readQueue()).find(
      (x) => x.status === ST_WAIT && x.member === s(payload.member) && x.date === s(payload.date) && inti(x) === inti({ items, lostTimes: lost, op: payload.op }),
    );
    if (kembar) return { id: kembar.id, prod: rows.prodRows.length, lt: rows.ltRows.length, pending: true, duplicate: true };
    const id = newSubmissionId();
    await io.append(`${q(SHEET_QUEUE)}!A:L`, [[id, nowJakarta(), s(payload.date), asText(payload.member), items.length, totalQty, ltMin, ST_WAIT, "", "", "", asText(data)]]);
    return { id, prod: rows.prodRows.length, lt: rows.ltRows.length, pending: true };
  });
}

/** Riwayat kiriman member 7 hari terakhir (terbaru dulu). */
export async function riwayatMember(member: string) {
  if (!member) return [];
  const batas = todayJakarta(new Date(Date.now() - 7 * 864e5));
  return (await readQueue())
    .filter((x) => x.member === member && x.date >= batas)
    .sort((a, b) => (a.date === b.date ? (a.sent < b.sent ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, 40)
    .map((x) => ({ id: x.id, date: x.date, sent: x.sent, status: x.status, qty: x.qty, ltMin: x.ltMin, note: x.note, leader: x.leader, items: x.items, lostTimes: x.lostTimes, op: x.op }));
}

// ---------- Fungsi yang dipanggil halaman leader ----------

/**
 * Pengganti PIN untuk panggilan dari halaman leader yang sudah lolos cek sesi (role leader/admin) di /api/rpc.
 * Acak per server dan tidak pernah dikirim ke browser.
 */
export const LEADER_SESSION = `sesi:${crypto.randomUUID()}`;

async function cekLeader(name: string, pin: string) {
  if (pin === LEADER_SESSION && name) return;
  const ok = (await leaders()).some((l) => l.name === name && l.pin === s(pin).trim());
  if (!ok) throw new QaError("Nama leader atau PIN salah.");
}

export async function leaderLogin(name: string, pin: string) {
  await cekLeader(name, pin);
  return { name };
}

export async function getAntrian(name: string, pin: string, status: string, dateStr: string) {
  await cekLeader(name, pin);
  const all = await readQueue();
  const counts: Record<string, number> = { [ST_WAIT]: 0, [ST_OK]: 0, [ST_NO]: 0 };
  all.forEach((x) => {
    if (counts[x.status] !== undefined) counts[x.status]++;
  });
  let list = all.filter((x) => x.status === status && (!dateStr || x.date === dateStr));
  list.sort((a, b) => (status === ST_WAIT ? (a.sent < b.sent ? -1 : 1) : a.decided > b.decided ? -1 : 1));
  if (status !== ST_WAIT) list = list.slice(0, 100);
  return { counts, list: list.map(pub) };
}

export async function putuskan(name: string, pin: string, ids: string[], action: string, note: string) {
  await cekLeader(name, pin);
  return putuskanTanpaPin(name, ids, action, note);
}

/** action: 'ok' atau 'no'. Dipakai halaman leader (dengan PIN) dan report Vercel. */
export async function putuskanTanpaPin(name: string, ids: string[], action: string, note: string) {
  if (action === "no" && !s(note).trim()) throw new QaError("Isi alasan penolakan.");
  const m = action === "ok" ? await getMasterData() : null;
  return locked(async () => {
    const hasil = { ok: 0, skip: 0, errors: [] as string[], detail: [] as { id: string; ok: boolean; message?: string }[] };
    const byId: Record<string, QueueEntry> = {};
    (await readQueue()).forEach((x) => (byId[x.id] = x));
    for (const id of ids || []) {
      const x = byId[id];
      if (!x || x.status !== ST_WAIT) {
        hasil.skip++;
        hasil.detail.push({ id, ok: false, message: x ? "Sudah diputuskan sebelumnya." : "Kiriman tidak ditemukan." });
        continue;
      }
      if (action === "ok") {
        try {
          const rows = bangunBaris({ date: x.date, member: x.member, items: x.items, lostTimes: x.lostTimes, op: x.op }, m!);
          if (rows.prodRows.length) {
            const start = await tulis(SHEET_PROD, rows.prodRows, PROD_WIDTH, [`${PROD_EXTRA}:${PROD_EXTRA_END}`, `${PROD_NOTE}:${PROD_NOTE}`]);
            const endRow = start + rows.extraRows.length - 1;
            const data = [{ range: `${q(SHEET_PROD)}!${PROD_EXTRA}${start}:${PROD_EXTRA_END}${endRow}`, values: rows.extraRows }];
            if (rows.noteRows.some((r) => r[0])) data.push({ range: `${q(SHEET_PROD)}!${PROD_NOTE}${start}:${PROD_NOTE}${endRow}`, values: rows.noteRows });
            await io.update(data);
          }
          if (rows.ltRows.length) await tulis(SHEET_LT, rows.ltRows, LT_WIDTH);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          hasil.errors.push(`${x.member}: ${msg}`);
          hasil.detail.push({ id, ok: false, message: msg });
          continue;
        }
      }
      const catatan = s(note).trim() || (action === "ok" ? x.note : "");
      await io.update([{ range: `${q(SHEET_QUEUE)}!H${x.row}:K${x.row}`, values: [[action === "ok" ? ST_OK : ST_NO, asText(name), nowJakarta(), asText(catatan)]] }]);
      hasil.ok++;
      hasil.detail.push({ id, ok: true });
    }
    return hasil;
  });
}

/** Leader memperbaiki isi kiriman yang masih Menunggu. Data asli disimpan di JSON (original). */
export async function editKiriman(name: string, pin: string, id: string, data: { items?: Item[]; lostTimes?: Item[]; op?: Op | null }) {
  await cekLeader(name, pin);
  const m = await getMasterData();
  const lost = data?.lostTimes || [],
    op = data?.op || undefined;
  return locked(async () => {
    const x = (await readQueue()).find((y) => y.id === id);
    if (!x) throw new QaError("Kiriman tidak ditemukan.");
    if (x.status !== ST_WAIT) throw new QaError(`Kiriman ini sudah ${x.status.toLowerCase()}.`);
    const items = bangunBaris({ date: x.date, member: x.member, items: data?.items || [], lostTimes: lost, op }, m).items;
    const n = (v: unknown) => Number(v) || 0;
    const totalQty = items.reduce((a, it) => a + n(it.normalQty) + n(it.otQty), 0);
    const ltMin = lost.reduce((a, l) => a + n(l.minutes), 0);
    const old = x.raw;
    const rec = {
      ...(old.meta ? { meta: old.meta } : {}),
      date: x.date,
      member: x.member,
      items,
      lostTimes: lost,
      ...(op ? { op } : {}),
      original: old.original || { items: old.items || [], lostTimes: old.lostTimes || [], op: old.op },
      editedBy: name,
      editedAt: nowJakarta().slice(0, 16),
    };
    await io.update([
      { range: `${q(SHEET_QUEUE)}!E${x.row}:G${x.row}`, values: [[items.length, totalQty, ltMin]] },
      { range: `${q(SHEET_QUEUE)}!K${x.row}:L${x.row}`, values: [[asText(`Diedit oleh ${name}`), asText(JSON.stringify(rec))]] },
    ]);
    return { ok: true };
  });
}

export function getScriptUrl() {
  return "/";
}

// ---------- Untuk Dashboard & Report di Vercel ----------

/** Tab Users: NIK | Nama | Peran | PIN | Status. Peran: operator, leader, manajemen, admin. */
export async function apiLogin(nik: string, pin: string) {
  nik = s(nik).trim();
  pin = s(pin).trim();
  if (!nik || !pin) throw new QaError("Isi NIK dan PIN.");
  const [g] = await io.get([`${q(SHEET_USERS)}!A2:E`], "FORMATTED_VALUE");
  const u = g.find((r) => s(r[0]).trim() === nik);
  if (!u || s(u[3]).trim() !== pin) return { ok: false };
  if (/^(nonaktif|tidak aktif|inactive)$/i.test(s(u[4]).trim())) return { ok: false, inactive: true };
  const peran = s(u[2]).trim().toLowerCase();
  const role = peran === "admin" ? "admin" : peran === "leader" ? "leader" : peran === "manajemen" || peran === "manager" ? "manager" : "operator";
  return { ok: true, nik, name: s(u[1]).trim(), role };
}

export async function apiQueue(a: { status?: string; date?: string; member?: string }) {
  return (await readQueue()).filter((x) => (!a.status || x.status === a.status) && (!a.date || x.date === a.date) && (!a.member || x.member === a.member)).map(pub);
}

/** Baris Input - Production dan Input - Lost Time pada rentang tanggal (yyyy-MM-dd). */
// Isi Input - Production & Input - Lost Time dibaca sekali lalu dipakai semua report (rentang tanggal apa pun)
// selama 1 menit. Dulu tiap rentang tanggal membaca ulang seluruh sheet. Dikosongkan setiap ada tulis ke Input.
const INPUT_TTL = 60_000;
let inputCache: { at: number; data: Promise<Cell[][][]> } | null = null;
function inputGrid(): { at: number; data: Promise<Cell[][][]> } {
  if (inputCache && Date.now() - inputCache.at < INPUT_TTL) return inputCache;
  const data = io.get([`${q(SHEET_PROD)}!B${FIRST_DATA_ROW}:AW`, `${q(SHEET_LT)}!B${FIRST_DATA_ROW}:I`], "UNFORMATTED_VALUE");
  const entry = { at: Date.now(), data };
  data.catch(() => {
    if (inputCache === entry) inputCache = null;
  });
  inputCache = entry;
  return entry;
}
export function clearInputCache() {
  inputCache = null;
}

export async function apiRows(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) throw new QaError("Rentang tanggal tidak valid.");
  // B..AN: B tanggal input, C..W isi, AA STKI, AH/AI/AJ tanggal/member/kategori, AM/AN menit MC.
  // B..I: B tanggal input, C member, D jenis, E menit, F keterangan, H/I tanggal/member otomatis.
  const grid = inputGrid();
  const [[prodG, ltG], m] = await Promise.all([grid.data, readMaster()]);
  const n = (v: unknown) => Number(v) || 0;
  const opt = (v: unknown) => (v === "" || v === null || v === undefined ? "" : Number(v) || 0);
  const prod: (string | number)[][] = [];
  for (const r of prodG) {
    const d = dayOf(r[32]) || dayOf(r[0]);
    if (!d || d < from || d > to || !s(r[3])) continue;
    const ng = Array.from({ length: 10 }, (_, i) => n(r[12 + i]));
    const cat = s(r[34]) || s(r[2]);
    // 23/24 = menit MC normal/OT ("" untuk baris lama atau part non-mesin), 25 = Standar MC PF (pcs/jam), 26 = catatan NG Lain-lain
    const mcStd = m.stdMc[`${cat}|${s(r[3])}|${s(r[4])}`] || 0;
    prod.push([d, s(r[33]) || s(r[1]), cat, s(r[3]), s(r[4]), n(r[5]), n(r[6]), n(r[7]), n(r[8]), s(r[9]), s(r[10]), s(r[11]), ...ng, n(r[25]), opt(r[37]), opt(r[38]), mcStd, s(r[47])]);
  }
  const lost: (string | number)[][] = [];
  for (const r of ltG) {
    const d = dayOf(r[6]) || dayOf(r[0]);
    if (!d || d < from || d > to || !s(r[2])) continue;
    lost.push([d, s(r[7]) || s(r[1]), s(r[2]), n(r[3]), s(r[4])]);
  }
  return { cols: [], prod, lost, at: grid.at };
}

/** Fungsi yang boleh dipanggil browser lewat /api/rpc/<nama> (sama dengan google.script.run di v1). */
export const RPC: Record<string, (...args: never[]) => Promise<unknown> | unknown> = {
  getMasterData,
  cekLaporan,
  submitReport,
  riwayatMember,
  leaderLogin,
  getAntrian,
  putuskan,
  editKiriman,
  getScriptUrl,
};
