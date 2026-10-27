import { AsyncLocalStorage } from "node:async_hooks";
// Semua report dihitung dari tab Input - Production dan Input - Lost Time di Google Sheet,
// yaitu kiriman yang sudah disetujui leader (plus baris yang diisi langsung di sheet).
import { callBackend, openRejections, type RawRows, type RawSubmission } from "./backend";
import { clearInputCache } from "./sheets/qa";
import { catId, memberId as memberIdOf, partId as partIdOf } from "./ids";
import { achievement, fmt, grade, ngRate, partLabel } from "./rules";
import { addDays, formatDateId, monthEnd, monthStart } from "./dates";
import { loadMaster } from "./service";
import { uraiOiban } from "./sheets/qa";
import { isQaMember, type MasterData, type Settings } from "./types";

export const REPORT_KINDS = ["dashboard", "daily", "member", "category", "machine", "ng-type", "ng-part", "ng-lot", "monthly", "waktu", "disiplin"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_TITLES: Record<ReportKind, string> = {
  dashboard: "Dashboard",
  daily: "Produktivitas Harian",
  member: "Produktivitas Member",
  category: "Production Report · Detail per Part",
  machine: "Laporan Mesin",
  "ng-type": "Laporan Kualitas (NG)",
  "ng-part": "Laporan NG per Part",
  "ng-lot": "Laporan NG per Lot",
  monthly: "Production Report · Rekap Bulanan",
  waktu: "Laporan Waktu & Lost Time",
  disiplin: "Laporan Disiplin Lapor",
};

export type ColFormat = "text" | "int" | "dec1" | "dec2" | "pct" | "ppm" | "grade" | "date";
export type Column = { key: string; label: string; format?: ColFormat };
export type Row = Record<string, string | number | null>;
export type Table = {
  title: string;
  columns: Column[];
  rows: Row[];
  total?: Row;
  /** Daftar rincian panjang: di web dilipat, di PDF dipotong. */
  detail?: boolean;
  /** Catatan pendek di bawah judul tabel. */
  note?: string;
  /** Hanya di Excel/PDF; di web sudah ada di tab lain. */
  exportOnly?: boolean;
};
export type Chart = {
  /** pareto = batang urut terbesar + garis kumulatif (kolom "cum", 0..1). */
  type: "line" | "bar" | "pareto";
  title: string;
  xKey: string;
  series: { key: string; label: string; format?: ColFormat }[];
  data: Row[];
};
export type Kpi = {
  label: string;
  value: string | number | null;
  format?: ColFormat;
  hint?: string;
  /** Target yang dibandingkan, sudah dalam teks (mis. "100%", "maks 1.000"). */
  target?: string;
  /** good = sesuai target (hijau), bad = di luar target (merah). */
  status?: "good" | "bad";
};
export type Report = { kind: ReportKind; title: string; subtitle: string; kpis: Kpi[]; charts: Chart[]; tables: Table[]; quality?: QualityExtra };

/** Data tambahan untuk tampilan Kualitas (grafik kecil & panel part). Excel/PDF tetap memakai tables. */
export type QualityExtra = {
  days: string[];
  ng: number;
  qty: number;
  rate: number | null;
  /** Periode sebelumnya dengan panjang sama; null bila belum ada data. */
  prev: { ng: number; rate: number | null; types: number } | null;
  types: { name: string; qty: number; share: number; cum: number; spark: number[] }[];
  parts: { partId: number; part: string; category: string; qty: number; ng: number; rate: number | null; dominant: string; spark: (number | null)[]; ngt: number }[];
  partCount: number;
  partsWithNg: number;
  focus: {
    partId: number;
    part: string;
    types: { name: string; qty: number; share: number }[];
    trend: { date: string; rate: number | null }[];
    lots: { lot: string; date: string; qty: number; ng: number; rate: number | null; dominant: string }[];
  } | null;
};

export type ReportParams = {
  from?: string;
  to?: string;
  date?: string;
  month?: string; // YYYY-MM
  categoryId?: number;
  memberId?: number;
  partId?: number;
  /** Cari nomor lot atau oiban (report Kualitas). */
  q?: string;
  /** Proses (kolom Process Master Data), mesin "Kategori|MC", jumlah baris Top (10/all), urutan part (ng/rate). */
  proc?: string;
  mc?: string;
  top?: string;
  sort?: string;
  /** Jenis NG yang sedang dilihat dari tab Per jenis NG (urutkan part menurut jenis ini). */
  ngt?: string;
  /** Part yang dibuka di panel kanan tab Per part (tidak memfilter tabel). */
  fp?: number;
};

export type Fact = {
  workDate: string;
  memberId: number;
  memberName: string;
  nik: string;
  categoryId: number;
  categoryName: string;
  ngGroupId: number | null;
  partId: number;
  part: string;
  mcNo: string;
  line: string;
  lot: string;
  oiban: string;
  qty: number;
  qtyOt: number;
  minNormal: number;
  minOt: number;
  stki: number;
  /** Jam mesin jalan: menit MC (AM+AN) bila ada, baris lama/non-PF pakai menit orang. 0 bila tanpa MC. */
  mcHours: number;
  /** Standar MC PF (pcs/jam per MC) dari Master Data BI:BL, 0 bila belum diisi. */
  mcStd: number;
  /** Catatan member untuk NG "Lain-lain" (Input - Production kolom AW). */
  ngNote: string;
  ng: number[];
};

export type LostFact = { workDate: string; memberId: number; memberName: string; name: string; group: string; minutes: number; remarks: string };

const ageStore = new AsyncLocalStorage<{ at: number }>();

/**
 * Jalankan fn dan catat kapan data Sheet tertua yang dipakai dibaca, untuk label "Data per jam ..." di halaman.
 * Tanpa label ini cache 1 menit bisa membuat angka terlihat belum berubah tanpa tanda apa pun.
 */
export async function withDataAge<T>(fn: () => Promise<T>): Promise<{ value: T; asOf: number }> {
  const st = { at: Date.now() };
  const value = await ageStore.run(st, fn);
  return { value, asOf: st.at };
}

/** Baris Input untuk rentang tanggal. Cache 1 menit ada di qa.ts (satu bacaan sheet untuk semua rentang). */
function fetchRows(from: string, to: string): Promise<RawRows> {
  const st = ageStore.getStore();
  const data = callBackend<RawRows>("rows", { from, to });
  if (st) data.then((r) => r.at && (st.at = Math.min(st.at, r.at))).catch(() => undefined);
  return data;
}

export function clearReportCache() {
  clearInputCache();
}

export async function loadFacts(master: MasterData, from: string, to: string, category?: number | number[], memberId?: number, partId?: number) {
  const raw = await fetchRows(from, to);
  // Satu kategori atau beberapa (mis. semua kategori dalam satu proses).
  const cats = category == null ? null : new Set(Array.isArray(category) ? category : [category]);
  const inCat = (cid: number) => !cats || cats.has(cid);
  const nikOf = new Map(master.members.map((m) => [m.name, m.nik]));
  const catOf = new Map(master.categories.map((c) => [c.name, c]));
  const facts: Fact[] = [];
  for (const r of raw.prod) {
    const [workDate, member, category, part, type, , , , , lot, oiban, mc] = r.map(String);
    const n = (i: number) => Number(r[i]) || 0;
    const cid = catId(category);
    const pid = partIdOf(category, part, type);
    const mid = memberIdOf(member);
    if (!inCat(cid) || (memberId && mid !== memberId) || (partId && pid !== partId)) continue;
    const mcNo = mc && mc !== "-" ? mc : "-";
    facts.push({
      workDate,
      memberId: mid,
      memberName: member,
      nik: nikOf.get(member) ?? "",
      categoryId: cid,
      categoryName: category,
      ngGroupId: catOf.get(category)?.ngGroupId ?? null,
      partId: pid,
      part: partLabel({ name: part, type: type === "-" ? "" : type }),
      mcNo,
      line: master.machines.find((m) => m.categoryId === cid && m.mcNo === mcNo)?.line ?? "",
      lot: lot || "(tanpa lot)",
      oiban: oiban === "-" ? "" : oiban,
      qty: n(5) + n(7),
      qtyOt: n(7),
      minNormal: n(6),
      minOt: n(8),
      stki: n(22) || master.parts.find((p) => p.id === pid)?.stki || 0,
      mcHours: mcNo === "-" ? 0 : r[23] === "" && r[24] === "" ? (n(6) + n(8)) / 60 : (n(23) + n(24)) / 60,
      mcStd: n(25),
      ngNote: String(r[26] ?? ""),
      ng: Array.from({ length: 10 }, (_, i) => n(12 + i)),
    });
  }
  // Lost time di Sheet tidak menyimpan kategori. Bila difilter satu kategori, menit lost time member di hari itu
  // dibagi sesuai porsi menit kerjanya di kategori tsb (normal + OT), supaya tidak terhitung penuh di tiap kategori.
  const share = new Map<string, { all: number; cat: number }>();
  if (cats)
    for (const r of raw.prod) {
      const k = `${r[0]}|${r[1]}`;
      const e = share.get(k) ?? { all: 0, cat: 0 };
      const min = (Number(r[6]) || 0) + (Number(r[8]) || 0);
      e.all += min;
      if (inCat(catId(String(r[2])))) e.cat += min;
      share.set(k, e);
    }
  const lost: LostFact[] = [];
  for (const r of raw.lost) {
    const mid = memberIdOf(String(r[1]));
    if (memberId && mid !== memberId) continue;
    let factor = 1;
    if (cats) {
      const e = share.get(`${r[0]}|${r[1]}`);
      factor = e && e.all > 0 ? e.cat / e.all : 0;
      if (!factor) continue;
    }
    const name = String(r[2]);
    lost.push({
      workDate: String(r[0]),
      memberId: mid,
      memberName: String(r[1]),
      name,
      group: master.lostTimeTypes.find((t) => t.name === name)?.group ?? "LOST_TIME",
      minutes: (Number(r[3]) || 0) * factor,
      remarks: String(r[4] ?? ""),
    });
  }
  return { facts, lost };
}

export type Agg = { qty: number; ng: number; rated: number; std: number; minNormal: number; minOt: number; count: number };
export const emptyAgg = (): Agg => ({ qty: 0, ng: 0, rated: 0, std: 0, minNormal: 0, minOt: 0, count: 0 });

export function add(a: Agg, f: Fact) {
  a.qty += f.qty;
  a.ng += f.ng.reduce((x, y) => x + y, 0);
  // Baris mesin (ada MC No): standar STKI/Std MC adalah pcs per jam per MESIN, sedangkan menit orang dibagi ke
  // semua mesin yang dipegang. Achievement-nya dihitung terhadap jam mesin jalan, bukan jam orang, agar operator
  // yang pegang beberapa mesin tidak terlihat 200-400%. Baris manual tetap pakai jam orang.
  const mc = f.mcHours > 0;
  const rated = mc ? f.mcHours : (f.minNormal + f.minOt) / 60;
  const std = mc && f.mcStd > 0 ? f.mcStd : f.stki;
  a.rated += rated;
  // Std Hours hanya dihitung untuk baris yang punya jam kerja, agar achievement = std/rated konsisten.
  if (rated > 0 && std > 0) a.std += f.qty / std;
  a.minNormal += f.minNormal;
  a.minOt += f.minOt;
  a.count++;
}

export function groupBy<K extends string | number>(facts: Fact[], key: (f: Fact) => K) {
  const m = new Map<K, { first: Fact; agg: Agg }>();
  for (const f of facts) {
    const k = key(f);
    let g = m.get(k);
    if (!g) m.set(k, (g = { first: f, agg: emptyAgg() }));
    add(g.agg, f);
  }
  return m;
}

/** NG per sejuta pcs diperiksa (hasil + NG). */
/** Batas NG rate dari Setting "NG limit" (disimpan dalam PPM: 1000 = 0,1%). */
export const ngMax = (st: Settings) => st.ngPpmMax / 1e6;
export const ngMaxText = (st: Settings) => `${(st.ngPpmMax / 1e4).toLocaleString("id-ID", { maximumFractionDigits: 3 })}%`;
export const ppm = (ng: number, qty: number) => (qty + ng > 0 ? Math.round((ng / (qty + ng)) * 1e6) : null);

/** Label tanggal pendek untuk sumbu grafik, mis. "18 Okt". */
export const dayLabel = (d: string) => formatDateId(d).split(" ").slice(0, 2).join(" ");

/** Tambah kolom kumulatif (0..1) untuk grafik Pareto. Baris harus sudah urut terbesar dulu. */
export function withCum<T extends Record<string, unknown>>(rows: T[], key: string): (T & { cum: number })[] {
  const total = rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  let run = 0;
  return rows.map((r) => {
    run += Number(r[key]) || 0;
    return { ...r, cum: total ? run / total : 0 };
  });
}

/** Status KPI terhadap target. lowerIsBetter untuk NG / lost time. */
export function vsTarget(value: number | null | undefined, target: number, lowerIsBetter = false): "good" | "bad" | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return (lowerIsBetter ? value <= target : value >= target) ? "good" : "bad";
}

export function aggCols(a: Agg, st: Settings) {
  const ach = achievement(a.std, a.rated);
  return {
    qty: a.qty,
    ng: a.ng,
    ngRate: ngRate(a.ng, a.qty),
    ngPpm: ppm(a.ng, a.qty),
    hours: a.rated,
    stdHours: a.std,
    ach,
    grade: grade(ach, st),
  };
}

const AGG_COLUMNS: Column[] = [
  { key: "qty", label: "Hasil (pcs)", format: "int" },
  { key: "ng", label: "NG (pcs)", format: "int" },
  { key: "ngRate", label: "NG rate", format: "pct" },
  { key: "hours", label: "Jam kerja/mesin", format: "dec1" },
  { key: "stdHours", label: "Jam standar", format: "dec1" },
  { key: "ach", label: "Achievement", format: "pct" },
  { key: "grade", label: "Grade", format: "grade" },
];

const formatNum = (v: number) => fmt(v, 0);

function totalRow(facts: Fact[], st: Settings, label: Row): Row {
  const a = emptyAgg();
  facts.forEach((f) => add(a, f));
  return { ...label, ...aggCols(a, st) };
}

export function lostSplit(lost: LostFact[]) {
  let lt = 0,
    aj = 0;
  for (const l of lost) (l.group === "ANOTHER_JOB" ? (aj += l.minutes) : (lt += l.minutes));
  return { lt, aj };
}

export function ngLabeler(ngGroups: { id: number; codes: string[]; name: string }[]) {
  return (groupId: number | null, i: number) => {
    const g = ngGroups.find((x) => x.id === groupId);
    return g ? g.codes[i] : `NG${i + 1}`;
  };
}

export function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Fakta untuk report Kualitas: filter kategori, proses, part, dan mesin sekaligus. */
async function qualityFacts(master: MasterData, from: string, to: string, p: ReportParams) {
  let cats: number[] | undefined;
  if (p.proc) cats = master.categories.filter((c) => c.process === p.proc).map((c) => c.id);
  if (p.categoryId) cats = cats ? cats.filter((c) => c === p.categoryId) : [p.categoryId];
  const { facts } = await loadFacts(master, from, to, cats ?? undefined, undefined, p.partId);
  return p.mc ? facts.filter((f) => `${f.categoryName}|${f.mcNo}` === p.mc) : facts;
}

/** Jumlah NG per jenis (nama jenis dari grup NG kategori). */
function ngByType(facts: Fact[], label: (g: number | null, i: number) => string) {
  const m = new Map<string, number>();
  for (const f of facts)
    f.ng.forEach((n, i) => {
      if (n) m.set(label(f.ngGroupId, i), (m.get(label(f.ngGroupId, i)) ?? 0) + n);
    });
  return m;
}

/** Bagian tambahan tampilan Kualitas: tren per jenis, part teratas, dan panel satu part. */
async function qualityExtra(master: MasterData, from: string, to: string, p: ReportParams, facts: Fact[], label: (g: number | null, i: number) => string): Promise<QualityExtra> {
  const days = dateRange(from, to);
  const len = days.length;
  const prevFacts = await qualityFacts(master, addDays(from, -len), addDays(from, -1), p);
  const sum = (fs: Fact[]) => fs.reduce((a, f) => ({ qty: a.qty + f.qty, ng: a.ng + f.ng.reduce((x, y) => x + y, 0) }), { qty: 0, ng: 0 });
  const now = sum(facts);
  const before = sum(prevFacts);
  const byType = ngByType(facts, label);
  const sorted = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const byDay = groupBy(facts, (f) => f.workDate);
  const dayType = new Map(days.map((d) => [d, ngByType(byDay.has(d) ? facts.filter((f) => f.workDate === d) : [], label)]));
  let cum = 0;
  const types = sorted.map(([name, qty]) => {
    cum += qty;
    return { name, qty, share: now.ng ? qty / now.ng : 0, cum: now.ng ? cum / now.ng : 0, spark: days.map((d) => dayType.get(d)?.get(name) ?? 0) };
  });

  const partGroups = [...groupBy(facts, (f) => f.partId).values()];
  const dominantOf = (fs: Fact[]) => {
    const m = [...ngByType(fs, label).entries()].sort((a, b) => b[1] - a[1])[0];
    const total = fs.reduce((a, f) => a + f.ng.reduce((x, y) => x + y, 0), 0);
    return m ? `${m[0]} (${Math.round((m[1] / total) * 100)}%)` : "-";
  };
  const factsOf = (pid: number) => facts.filter((f) => f.partId === pid);
  const MIN = 500;
  const parts = partGroups
    .filter((g) => g.agg.ng > 0 && (p.sort !== "rate" || g.agg.qty >= MIN))
    .map((g) => {
      const fs = factsOf(g.first.partId);
      return {
        ngt: p.ngt ? ngByType(fs, label).get(p.ngt) ?? 0 : 0,
        partId: g.first.partId,
        part: g.first.part,
        category: g.first.categoryName,
        qty: g.agg.qty,
        ng: g.agg.ng,
        rate: ngRate(g.agg.ng, g.agg.qty),
        dominant: dominantOf(fs),
        spark: days.map((d) => {
          const x = sum(fs.filter((f) => f.workDate === d));
          return x.qty + x.ng ? ngRate(x.ng, x.qty) : null;
        }),
      };
    })
    .filter((x) => !p.ngt || x.ngt > 0)
    .sort((a, b) => (p.ngt ? b.ngt - a.ngt : 0) || (p.sort === "rate" ? (b.rate ?? 0) - (a.rate ?? 0) : b.ng - a.ng));

  const focusId = p.fp ?? p.partId ?? parts[0]?.partId;
  let focus: QualityExtra["focus"] = null;
  if (focusId) {
    const fs = factsOf(focusId);
    if (fs.length) {
      const t = ngByType(fs, label);
      const tot = [...t.values()].reduce((a, b) => a + b, 0);
      // Semua jenis NG di grup part ini, termasuk yang 0, supaya terlihat jenis mana yang tidak muncul.
      const codes = master.ngGroups.find((g) => g.id === fs[0].ngGroupId)?.codes ?? [];
      const names = [...new Set([...codes.filter((c) => !/^NG\d+$/.test(c)), ...t.keys()])];
      const lots = [...groupBy(fs, (f) => f.lot).values()]
        .map((g) => {
          const lf = fs.filter((f) => f.lot === g.first.lot);
          return { lot: g.first.lot, date: lf.map((f) => f.workDate).sort()[0], qty: g.agg.qty, ng: g.agg.ng, rate: ngRate(g.agg.ng, g.agg.qty), dominant: g.agg.ng ? dominantOf(lf).replace(/ \(.*$/, "") : "-" };
        })
        .sort((a, b) => b.ng - a.ng);
      focus = {
        partId: focusId,
        part: fs[0].part,
        types: names.map((name) => ({ name, qty: t.get(name) ?? 0, share: tot ? (t.get(name) ?? 0) / tot : 0 })).sort((a, b) => b.qty - a.qty),
        trend: days.map((d) => {
          const x = sum(fs.filter((f) => f.workDate === d));
          return { date: dayLabel(d), rate: x.qty + x.ng ? ngRate(x.ng, x.qty) : null };
        }),
        lots: lots.slice(0, 5),
      };
    }
  }
  return {
    days: days.map(dayLabel),
    ng: now.ng,
    qty: now.qty,
    rate: ngRate(now.ng, now.qty),
    prev: prevFacts.length ? { ng: before.ng, rate: ngRate(before.ng, before.qty), types: [...ngByType(prevFacts, label).keys()].length } : null,
    types,
    parts,
    partCount: partGroups.length,
    partsWithNg: partGroups.filter((g) => g.agg.ng > 0).length,
    focus,
  };
}

export async function buildReport(kind: ReportKind, p: ReportParams, today: string): Promise<Report> {
  const master = await loadMaster();
  const st = master.settings;
  const from = p.from ?? monthStart(today);
  const to = p.to ?? today;
  const catName = p.categoryId ? master.categories.find((c) => c.id === p.categoryId)?.name : undefined;
  const period = `${formatDateId(from)} – ${formatDateId(to)}${catName ? ` · ${catName}` : ""}`;
  const label = ngLabeler(master.ngGroups);
  const base = { kind, title: REPORT_TITLES[kind], kpis: [] as Kpi[], charts: [] as Chart[], tables: [] as Table[] };

  if (kind === "dashboard") {
    const { facts, lost } = await loadFacts(master, from, to, p.categoryId);
    const t = totalRow(facts, st, {});
    const { lt, aj } = lostSplit(lost);
    const byDay = groupBy(facts, (f) => f.workDate);
    const trend = dateRange(from, to)
      .filter((d) => byDay.has(d))
      .map((d) => {
        const a = byDay.get(d)!.agg;
        return { date: dayLabel(d), qty: a.qty, ng: a.ng, ach: achievement(a.std, a.rated) };
      });
    const byMember = [...groupBy(facts, (f) => f.memberId).values()]
      .map((g) => ({ member: g.first.memberName, ...aggCols(g.agg, st) }))
      .sort((a, b) => (Number(b.ach) || 0) - (Number(a.ach) || 0));
    const ngMap = new Map<string, number>();
    for (const f of facts) f.ng.forEach((n, i) => n && ngMap.set(label(f.ngGroupId, i), (ngMap.get(label(f.ngGroupId, i)) ?? 0) + n));
    const topNg = withCum([...ngMap.entries()].sort((a, b) => b[1] - a[1]).map(([ng, qty]) => ({ ng, qty })), "qty").slice(0, 10);
    const ltMap = new Map<string, { group: string; minutes: number }>();
    for (const l of lost) {
      const e = ltMap.get(l.name) ?? { group: l.group, minutes: 0 };
      e.minutes += l.minutes;
      ltMap.set(l.name, e);
    }
    const ltRows = [...ltMap.entries()]
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .map(([name, e]) => ({ name, group: e.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", hours: e.minutes / 60 }));
    const byCat = [...groupBy(facts, (f) => f.categoryId).values()].map((g) => ({ category: g.first.categoryName, ...aggCols(g.agg, st) }));
    return {
      ...base,
      subtitle: period,
      kpis: [
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(Number(t.ach) * 100, st.target) },
        { label: "NG rate", value: t.ngRate, format: "pct", hint: `${formatNum(Number(t.ng))} pcs NG`, target: `maks ${ngMaxText(st)}`, status: vsTarget(t.ngRate as number | null, ngMax(st), true) },
        { label: "Jam rated (orang/mesin)", value: t.hours, format: "dec1", hint: "Baris mesin dihitung dengan jam mesin jalan" },
        { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
        { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
      ],
      charts: [
        { type: "line", title: "Hasil per hari (pcs)", xKey: "date", series: [{ key: "qty", label: "Hasil", format: "int" }], data: trend },
        { type: "line", title: "Achievement per hari", xKey: "date", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: trend },
        { type: "pareto", title: "Pareto NG (pcs)", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: topNg },
        { type: "pareto", title: "Pareto Lost Time & Another Job (jam)", xKey: "name", series: [{ key: "hours", label: "Jam", format: "dec1" }], data: withCum(ltRows, "hours").slice(0, 10) },
      ],
      tables: [
        { title: "Per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: byCat },
        { title: "Member dengan achievement tertinggi", columns: [{ key: "member", label: "Member" }, ...AGG_COLUMNS], rows: byMember.slice(0, 10) },
      ],
    };
  }

  if (kind === "daily") {
    const date = p.date ?? today;
    const { facts, lost } = await loadFacts(master, date, date, p.categoryId);
    const subs = await callBackend<RawSubmission[]>("queue", { date });
    const byMember = groupBy(facts, (f) => f.memberId);
    const rejectedOpen = new Set(openRejections(subs).map((r) => r.member));
    const rows: Row[] = master.members.flatMap((m) => {
      const g = byMember.get(m.id);
      const ml = lost.filter((l) => l.memberId === m.id);
      const { lt, aj } = lostSplit(ml);
      const statuses = subs.filter((r) => r.member === m.name).map((r) => r.status);
      // Member section lain hanya tampil kalau membantu di QA hari itu, jadi tidak dihitung belum lapor.
      if (!isQaMember(m) && !g && !ml.length && !statuses.length) return [];
      const openRej = rejectedOpen.has(m.name);
      // Baris yang diisi langsung di sheet juga dihitung sudah lapor.
      const approved = statuses.includes("Disetujui") || !!g || ml.length > 0;
      const pending = statuses.includes("Menunggu");
      const ag = g ? aggCols(g.agg, st) : { qty: null, ng: null, ngRate: null, hours: null, stdHours: null, ach: null, grade: "-" };
      return {
        nik: m.nik,
        member: m.name,
        area: m.area,
        // Kiriman ditolak yang belum dikirim ulang didahulukan supaya tidak terlewat.
        status: openRej ? "Ditolak" : approved ? "Disetujui" : pending ? "Menunggu" : statuses.length ? "Ditolak" : "Belum lapor",
        ...ag,
        lostMin: lt,
        ajMin: aj,
        util: (g?.agg.minNormal ?? 0) + lt + aj,
      };
    });
    const reported = rows.filter((r) => r.status === "Disetujui").length;
    const t = totalRow(facts, st, { member: "TOTAL" });
    return {
      ...base,
      subtitle: formatDateId(date),
      kpis: [
        { label: "Sudah lapor (disetujui)", value: `${reported} / ${rows.length}` },
        { label: "Belum lapor", value: rows.filter((r) => r.status === "Belum lapor").length, format: "int" },
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}` },
      ],
      charts: [],
      tables: [
        {
          title: "Semua member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "area", label: "Section" },
            { key: "status", label: "Status" },
            ...AGG_COLUMNS,
            { key: "lostMin", label: "Lost Time (mnt)", format: "int" },
            { key: "ajMin", label: "Another Job (mnt)", format: "int" },
            { key: "util", label: "Total menit", format: "int" },
          ],
          rows,
          total: t,
        },
      ],
    };
  }

  if (kind === "member" && !p.memberId) {
    // Semua member dalam periode: urut achievement terendah dulu supaya yang perlu dibina kelihatan.
    const { facts, lost } = await loadFacts(master, from, to, p.categoryId);
    const sectionOf = new Map(master.members.map((m) => [m.id, m.area]));
    const daysOf = new Map<number, Set<string>>();
    for (const f of facts) daysOf.set(f.memberId, (daysOf.get(f.memberId) ?? new Set()).add(f.workDate));
    const rows: Row[] = [...groupBy(facts, (f) => f.memberId).entries()]
      .map(([id, g]) => {
        const { lt, aj } = lostSplit(lost.filter((l) => l.memberId === id));
        return {
          nik: g.first.nik,
          member: g.first.memberName,
          section: sectionOf.get(id) || "-",
          days: daysOf.get(id)?.size ?? 0,
          ...aggCols(g.agg, st),
          lostMin: lt,
          ajMin: aj,
        } as Row;
      })
      .sort((a, b) => (a.ach == null ? 9 : Number(a.ach)) - (b.ach == null ? 9 : Number(b.ach)) || String(a.member).localeCompare(String(b.member)));
    const t = totalRow(facts, st, { member: "TOTAL" });
    const below = rows.filter((r) => r.ach != null && Number(r.ach) * 100 < st.target).length;
    return {
      ...base,
      subtitle: `Semua member · ${period}`,
      kpis: [
        { label: "Member lapor", value: rows.length, format: "int" },
        { label: "Achievement rata-rata", value: t.ach, format: "pct", hint: `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : Number(t.ach) * 100, st.target) },
        { label: "Di bawah target", value: below, format: "int", hint: `dari ${rows.length} member` },
        { label: "Jam kerja/mesin", value: t.hours, format: "dec1", hint: "Baris mesin dihitung dengan jam mesin jalan" },
      ],
      charts: [
        { type: "bar", title: "Achievement per member", xKey: "member", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: rows.filter((r) => r.ach != null).map((r) => ({ member: String(r.member).split(" ")[0], ach: r.ach })) },
      ],
      tables: [
        {
          title: "Semua member",
          note: "Pilih nama di filter Member untuk detail per hari dan per part.",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "section", label: "Section" },
            { key: "days", label: "Hari lapor", format: "int" },
            ...AGG_COLUMNS,
            { key: "lostMin", label: "Lost Time (mnt)", format: "int" },
            { key: "ajMin", label: "Another Job (mnt)", format: "int" },
          ],
          rows,
          total: t,
        },
      ],
    };
  }

  if (kind === "member") {
    const memberId = p.memberId ?? master.members[0]?.id;
    const member = master.members.find((m) => m.id === memberId);
    const { facts, lost } = await loadFacts(master, from, to, p.categoryId, memberId ?? -1);
    const byDay = [...groupBy(facts, (f) => f.workDate).entries()].sort(([a], [b]) => a.localeCompare(b));
    const dayRows = byDay.map(([d, g]) => {
      const { lt, aj } = lostSplit(lost.filter((l) => l.workDate === d));
      return { date: d, ...aggCols(g.agg, st), lostMin: lt, ajMin: aj };
    });
    const partRows = [...groupBy(facts, (f) => f.partId).values()].map((g) => ({
      category: g.first.categoryName,
      part: g.first.part,
      stki: g.first.stki,
      ...aggCols(g.agg, st),
    }));
    const t = totalRow(facts, st, { date: "TOTAL" });
    return {
      ...base,
      subtitle: `${member ? `${member.name} (${member.nik})` : "-"} · ${period}`,
      kpis: [
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : Number(t.ach) * 100, st.target) },
        { label: "NG rate", value: t.ngRate, format: "pct", hint: `${formatNum(Number(t.ng))} pcs NG`, target: `maks ${ngMaxText(st)}`, status: vsTarget(t.ngRate as number | null, ngMax(st), true) },
        { label: "Hari lapor", value: dayRows.length, format: "int" },
      ],
      charts: [
        { type: "bar", title: "Achievement per hari", xKey: "date", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: dayRows.map((r) => ({ ...r, date: dayLabel(String(r.date)) })) },
      ],
      tables: [
        {
          title: "Per hari",
          columns: [{ key: "date", label: "Tanggal", format: "date" }, ...AGG_COLUMNS, { key: "lostMin", label: "Lost Time (mnt)", format: "int" }, { key: "ajMin", label: "Another Job (mnt)", format: "int" }],
          rows: dayRows,
          total: t,
        },
        { title: "Per part", columns: [{ key: "category", label: "Kategori" }, { key: "part", label: "Part" }, { key: "stki", label: "STKI", format: "int" }, ...AGG_COLUMNS], rows: partRows },
      ],
    };
  }

  if (kind === "category") {
    const all = (await loadFacts(master, from, to, p.categoryId)).facts;
    // Cari part: "627D1" juga cocok dengan "627 D1" / "627-D1".
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const q = p.q ? norm(p.q) : "";
    const facts = q ? all.filter((f) => norm(f.part).includes(q)) : all;
    const catRows = [...groupBy(facts, (f) => f.categoryId).values()].map((g) => ({ category: g.first.categoryName, ...aggCols(g.agg, st) }));
    const partRows = [...groupBy(facts, (f) => f.partId).values()]
      .map((g) => ({ category: g.first.categoryName, part: g.first.part, stki: g.first.stki, ...aggCols(g.agg, st) }))
      .sort((a, b) => String(a.category).localeCompare(String(b.category)) || Number(b.qty) - Number(a.qty));
    // Total per part + type lintas kategori: satu kolom per kategori (urut Master Data) lalu ALL.
    const cats = master.categories.filter((c) => facts.some((f) => f.categoryId === c.id));
    const ck = (id: number) => `c${id}`;
    const pivot = (key: (f: Fact) => string, label: string) => {
      const rows = [...groupBy(facts, key).entries()].map(([k, g]) => {
        const fs = facts.filter((f) => key(f) === k);
        const row: Row = { [label]: k };
        for (const c of cats) row[ck(c.id)] = fs.filter((f) => f.categoryId === c.id).reduce((s, f) => s + f.qty, 0) || null;
        return { ...row, ...aggCols(g.agg, st) } as Row;
      });
      const total: Row = { [label]: "TOTAL" };
      for (const c of cats) total[ck(c.id)] = facts.filter((f) => f.categoryId === c.id).reduce((s, f) => s + f.qty, 0);
      return { rows, total: { ...total, ...totalRow(facts, st, {}) } };
    };
    const pivotCols = (first: Column): Column[] => [
      first,
      ...cats.map((c) => ({ key: ck(c.id), label: c.name, format: "int" as const })),
      { key: "qty", label: "ALL (pcs)", format: "int" },
      { key: "ng", label: "NG (pcs)", format: "int" },
      { key: "ngRate", label: "NG rate", format: "pct" },
    ];
    const byPart = pivot((f) => f.part, "part");
    byPart.rows.sort((a, b) => Number(b.qty) - Number(a.qty));
    const byDay = pivot((f) => f.workDate, "date");
    byDay.rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const t = totalRow(facts, st, { category: "TOTAL" });
    return {
      ...base,
      subtitle: `${period}${p.q ? ` · part "${p.q}"` : ""}`,
      kpis: [
        { label: "Hasil ALL (pcs)", value: t.qty, format: "int", hint: `${byPart.rows.length} part/type` },
        ...cats.slice(0, 3).map((c) => ({ label: `${c.name} (pcs)`, value: byPart.total[ck(c.id)], format: "int" as const })),
      ],
      charts: [
        { type: "bar", title: "Achievement per kategori", xKey: "category", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: catRows },
      ],
      tables: [
        {
          title: "Total per part (semua kategori)",
          note: "Hasil = qty normal + OT yang sudah disetujui. Kolom per kategori lalu ALL. Pakai kotak Cari part untuk satu part, mis. 627D1.",
          columns: pivotCols({ key: "part", label: "Part / Type" }),
          rows: byPart.rows,
          total: byPart.total,
        },
        ...(from !== to
          ? [{ title: "Total per hari", note: "Hasil per tanggal per kategori. Pilih Bulan ini untuk rekap sebulan.", columns: pivotCols({ key: "date", label: "Tanggal", format: "date" }), rows: byDay.rows, total: byDay.total }]
          : []),
        { title: "Per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: catRows, total: t },
        { title: "Per part", columns: [{ key: "category", label: "Kategori" }, { key: "part", label: "Part" }, { key: "stki", label: "STKI", format: "int" }, ...AGG_COLUMNS], rows: partRows, total: totalRow(facts, st, { category: "TOTAL" }) },
      ],
    };
  }

  if (kind === "machine") {
    // Semua mesin di Master Data (PF dan Drum), termasuk yang tidak jalan di periode ini.
    // Utilisasi = jam mesin jalan ÷ (hari kerja x jam tersedia per hari, Setting). Efisiensi = jam standar MC ÷ jam jalan.
    const { facts } = await loadFacts(master, from, to, p.categoryId);
    const workDays = new Set(facts.map((f) => f.workDate)).size;
    // Jam tersedia per hari bisa beda per kategori (Setting "Machine available hrs / day - <Kategori>").
    const hrsOf = (category: string) => st.mcHrsCat?.[category] ?? st.mcHrsDay;
    const key = (c: number, mc: string) => `${c}|${mc}`;
    const used = groupBy(
      facts.filter((f) => f.mcNo !== "-"),
      (f) => key(f.categoryId, f.mcNo),
    );
    const list = new Map<string, { categoryId: number; category: string; mcNo: string; line: string }>();
    for (const m of master.machines)
      if (!p.categoryId || m.categoryId === p.categoryId)
        list.set(key(m.categoryId, m.mcNo), { categoryId: m.categoryId, category: master.categories.find((c) => c.id === m.categoryId)?.name ?? "", mcNo: m.mcNo, line: m.line });
    for (const [k, g] of used) if (!list.has(k)) list.set(k, { categoryId: g.first.categoryId, category: g.first.categoryName, mcNo: g.first.mcNo, line: g.first.line });
    let sumHours = 0,
      sumStd = 0,
      sumRated = 0,
      sumAvail = 0,
      runHours = 0,
      runAvail = 0;
    const rows = [...list.entries()]
      .map(([k, m]) => {
        const g = used.get(k);
        let mcHours = 0,
          stdHours = 0,
          ratedHours = 0;
        for (const f of facts) {
          if (f.categoryId !== m.categoryId || f.mcNo !== m.mcNo) continue;
          mcHours += f.mcHours;
          if (f.mcStd > 0) {
            stdHours += f.qty / f.mcStd;
            ratedHours += f.mcHours;
          }
        }
        const availHrs = workDays * hrsOf(m.category);
        sumHours += mcHours;
        sumStd += stdHours;
        sumRated += ratedHours;
        sumAvail += availHrs;
        if (g) {
          runHours += mcHours;
          runAvail += availHrs;
        }
        const qty = g?.agg.qty ?? 0;
        const ng = g?.agg.ng ?? 0;
        const util = availHrs > 0 ? mcHours / availHrs : null;
        const eff = ratedHours > 0 ? stdHours / ratedHours : null;
        const rate = ngRate(ng, qty);
        return {
          category: m.category,
          mcNo: m.mcNo,
          line: m.line,
          status: !g ? "Tidak jalan" : util != null && util * 100 >= st.utilTarget ? "OK" : "Di bawah target",
          days: g ? new Set(facts.filter((f) => f.categoryId === m.categoryId && f.mcNo === m.mcNo).map((f) => f.workDate)).size : 0,
          mcHours,
          util,
          qty,
          pcsHr: mcHours > 0 ? qty / mcHours : null,
          stdHours: ratedHours > 0 ? stdHours : null,
          eff,
          ng,
          ngRate: rate,
          oee: util != null && eff != null && g ? Math.min(util, 1) * eff * (1 - (rate ?? 0)) : null,
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.mcNo.localeCompare(b.mcNo, "id", { numeric: true }));
    const running = rows.filter((r) => r.status !== "Tidak jalan").length;
    const avgUtil = sumAvail > 0 ? sumHours / sumAvail : null;
    const runUtil = runAvail > 0 ? runHours / runAvail : null;
    const tq = rows.reduce((a, r) => a + r.qty, 0);
    const tng = rows.reduce((a, r) => a + r.ng, 0);
    return {
      ...base,
      subtitle: `${period} · ${workDays} hari kerja`,
      kpis: [
        { label: "Mesin jalan", value: `${running} dari ${rows.length}`, hint: `${rows.length - running} mesin tidak jalan di periode ini` },
        { label: "Utilisasi mesin yang jalan", value: runUtil, format: "pct", hint: `semua mesin ${avgUtil == null ? "-" : `${Math.round(avgUtil * 100)}%`}`, target: `${st.utilTarget}%`, status: vsTarget(runUtil == null ? null : runUtil * 100, st.utilTarget) },
        { label: "Efisiensi vs Std MC", value: sumRated > 0 ? sumStd / sumRated : null, format: "pct", target: `${st.target}%`, status: vsTarget(sumRated > 0 ? (sumStd / sumRated) * 100 : null, st.target) },
        { label: "NG rate", value: ngRate(tng, tq), format: "pct", target: `maks ${ngMaxText(st)}`, status: vsTarget(ngRate(tng, tq), ngMax(st), true) },
      ],
      charts: [
        {
          type: "bar",
          title: "Utilisasi mesin yang jalan (urut tertinggi)",
          xKey: "mcNo",
          series: [{ key: "util", label: "Utilisasi", format: "pct" }],
          data: rows.filter((r) => r.status !== "Tidak jalan").sort((a, b) => (b.util ?? 0) - (a.util ?? 0)).map((r) => ({ ...r, mcNo: new Set(rows.map((x) => x.category)).size > 1 ? `${r.category.split(" ")[0]} ${r.mcNo.replace(/^MC\s*/i, "")}` : r.mcNo })),
        },
      ],
      tables: [
        {
          title: "Semua mesin",
          note: `Utilisasi = jam mesin jalan ÷ (${workDays} hari kerja x jam tersedia per hari: ${[...new Set(rows.map((r) => r.category))].map((c) => `${c} ${fmt(hrsOf(c), 0)} jam`).join(", ")}; ubah di Master Data > Setting). OEE kira-kira = utilisasi x efisiensi x (1 − NG rate).`,
          columns: [
            { key: "category", label: "Kategori" },
            { key: "mcNo", label: "Mesin" },
            { key: "line", label: "Line" },
            { key: "status", label: "Status" },
            { key: "days", label: "Hari jalan", format: "int" },
            { key: "mcHours", label: "Jam jalan", format: "dec1" },
            { key: "util", label: "Utilisasi", format: "pct" },
            { key: "qty", label: "Hasil (pcs)", format: "int" },
            { key: "pcsHr", label: "Hasil per jam", format: "dec1" },
            { key: "stdHours", label: "Jam standar MC", format: "dec1" },
            { key: "eff", label: "Efisiensi", format: "pct" },
            { key: "ngRate", label: "NG rate", format: "pct" },
            { key: "oee", label: "OEE (kira-kira)", format: "pct" },
          ],
          rows,
        },
      ],
    };
  }

  if (kind === "ng-type" || kind === "ng-part") {
    const facts = await qualityFacts(master, from, to, p);
    const quality = await qualityExtra(master, from, to, p, facts, label);
    if (kind === "ng-part") {
      const n = p.top === "all" ? quality.parts.length : 10;
      return {
        ...base,
        subtitle: period,
        quality,
        kpis: [
          { label: "Part diproduksi", value: quality.partCount, format: "int" },
          { label: "NG (pcs)", value: quality.ng, format: "int" },
          { label: "NG rate", value: quality.rate, format: "pct", target: `maks ${ngMaxText(st)}`, status: vsTarget(quality.rate, ngMax(st), true) },
          { label: "Part dengan NG", value: quality.partsWithNg, format: "int", hint: `dari ${quality.partCount} part` },
        ],
        charts: [],
        tables: [
          {
            title: p.sort === "rate" ? "Part dengan NG rate tertinggi (produksi ≥ 500 pcs)" : "Part dengan NG terbanyak",
            columns: [
              { key: "part", label: "Part" },
              { key: "category", label: "Kategori" },
              { key: "qty", label: "Hasil (pcs)", format: "int" },
              { key: "ng", label: "NG (pcs)", format: "int" },
              { key: "rate", label: "NG rate", format: "pct" },
              { key: "dominant", label: "NG dominan" },
              ...(p.ngt ? [{ key: "ngt", label: `NG ${p.ngt}`, format: "int" as const }] : []),
            ],
            rows: quality.parts.slice(0, n).map(({ spark: _s, partId: _p, ...r }) => r as Row),
          },
        ],
      };
    }
    const map = new Map<string, { group: string; ng: string; qty: number }>();
    let total = 0;
    for (const f of facts)
      f.ng.forEach((n, i) => {
        if (!n) return;
        const g = master.ngGroups.find((x) => x.id === f.ngGroupId)?.name ?? "-";
        const k = `${g}|${i}`;
        const e = map.get(k) ?? { group: g, ng: label(f.ngGroupId, i), qty: 0 };
        e.qty += n;
        total += n;
        map.set(k, e);
      });
    const rows = [...map.values()].sort((a, b) => b.qty - a.qty).map((e) => ({ ...e, share: total ? e.qty / total : null }));
    const byDay = groupBy(facts, (f) => f.workDate);
    const trend = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, g]) => ({ date: dayLabel(d), ng: g.agg.ng, ngRate: ngRate(g.agg.ng, g.agg.qty) }));
    const all = totalRow(facts, st, {});
    // Kualitas = jenis NG + NG per lot dalam satu halaman.
    const lotTable = (await buildReport("ng-lot", p, today)).tables[0];
    // Matriks part x jenis NG: 8 jenis NG terbanyak jadi kolom, sisanya "Lainnya".
    const topNames = [...new Set(rows.map((r) => r.ng))].slice(0, 8);
    const matrix = [...groupBy(facts, (f) => f.partId).values()]
      .map((g) => {
        const out: Row = { part: g.first.part, category: g.first.categoryName, qty: g.agg.qty, ng: g.agg.ng, ngRate: ngRate(g.agg.ng, g.agg.qty), ngPpm: ppm(g.agg.ng, g.agg.qty), other: 0 };
        topNames.forEach((_, j) => (out[`n${j}`] = 0));
        for (const f of facts.filter((x) => x.partId === g.first.partId))
          f.ng.forEach((n, i) => {
            if (!n) return;
            const j = topNames.indexOf(label(f.ngGroupId, i));
            const k = j >= 0 ? `n${j}` : "other";
            out[k] = Number(out[k]) + n;
          });
        return out;
      })
      .filter((r) => Number(r.ng) > 0)
      .sort((a, b) => Number(b.ng) - Number(a.ng));
    const matrixTable: Table = {
      title: "Part x jenis NG",
      columns: [
        { key: "part", label: "Part" },
        { key: "category", label: "Kategori" },
        { key: "qty", label: "Hasil (pcs)", format: "int" },
        { key: "ng", label: "NG (pcs)", format: "int" },
        { key: "ngRate", label: "NG rate", format: "pct" },
        ...topNames.map((n, j) => ({ key: `n${j}`, label: n, format: "int" as const })),
        ...(matrix.some((r) => Number(r.other) > 0) ? [{ key: "other", label: "Lainnya", format: "int" as const }] : []),
      ],
      rows: matrix,
    };
    const ngDetail = (f: Fact) =>
      f.ng
        .map((n, i) => (n ? `${label(f.ngGroupId, i)} ${n}` : ""))
        .filter(Boolean)
        .join(", ");
    const search: Table[] = [];
    if (p.q) {
      const q = p.q.toLowerCase();
      const hits = facts.filter((f) => f.lot.toLowerCase().includes(q) || (f.oiban && uraiOiban(f.oiban).list.includes(p.q!)));
      search.push({
        title: `Hasil cari lot / oiban "${p.q}"`,
        columns: [
          { key: "date", label: "Tanggal", format: "date" },
          { key: "member", label: "Member" },
          { key: "part", label: "Part" },
          { key: "mc", label: "Mesin" },
          { key: "lot", label: "Lot" },
          { key: "oiban", label: "Oiban" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ng", label: "NG (pcs)", format: "int" },
          { key: "detail", label: "Rincian NG" },
        ],
        rows: hits
          .sort((a, b) => a.workDate.localeCompare(b.workDate))
          .map((f) => ({ date: f.workDate, member: f.memberName, part: f.part, mc: f.mcNo, lot: f.lot, oiban: f.oiban, qty: f.qty, ng: f.ng.reduce((a, v) => a + v, 0), detail: ngDetail(f) })),
      });
    }
    return {
      ...base,
      subtitle: period,
      quality,
      kpis: [
        { label: "NG (pcs)", value: total, format: "int" },
        { label: "NG rate", value: all.ngRate, format: "pct", target: `maks ${ngMaxText(st)}`, status: vsTarget(all.ngRate as number | null, ngMax(st), true) },
        { label: "Hasil diperiksa (pcs)", value: all.qty, format: "int" },
      ],
      charts: [
        { type: "pareto", title: "Pareto NG per jenis (pcs)", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: withCum(rows, "qty").slice(0, 12) },
        { type: "line", title: "Tren NG rate harian", xKey: "date", series: [{ key: "ngRate", label: "NG rate", format: "pct" }], data: trend },
      ],
      tables: [
        ...search,
        {
          title: "NG per jenis",
          exportOnly: true,
          columns: [
            { key: "group", label: "Grup NG" },
            { key: "ng", label: "Jenis NG" },
            { key: "qty", label: "NG (pcs)", format: "int" },
            { key: "share", label: "Porsi", format: "pct" },
          ],
          rows,
        },
        { ...matrixTable, exportOnly: true },
        { ...lotTable, exportOnly: true },
        {
          title: "Catatan NG Lain-lain",
          detail: true,
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "part", label: "Part" },
            { key: "lot", label: "Lot" },
            { key: "qty", label: "NG Lain-lain", format: "int" },
            { key: "note", label: "Catatan" },
          ],
          rows: facts
            .filter((f) => f.ngNote)
            .map((f) => ({ date: f.workDate, member: f.memberName, part: f.part, lot: f.lot, qty: f.ng.reduce((a, v, i) => (/^lain/i.test(label(f.ngGroupId, i)) ? a + v : a), 0), note: f.ngNote })),
        },
      ],
    };
  }

  if (kind === "ng-lot") {
    const { facts } = await loadFacts(master, from, to, p.categoryId, undefined, p.partId);
    const rows = [...groupBy(facts, (f) => `${f.partId}|${f.lot}`).values()]
      .map((g) => {
        const counts = Array(10).fill(0) as number[];
        const lotFacts = facts.filter((f) => f.partId === g.first.partId && f.lot === g.first.lot);
        lotFacts.forEach((f) => f.ng.forEach((n, i) => (counts[i] += n)));
        const topIdx = counts.indexOf(Math.max(...counts));
        return {
          lot: g.first.lot,
          category: g.first.categoryName,
          part: g.first.part,
          qty: g.agg.qty,
          ng: g.agg.ng,
          ngRate: ngRate(g.agg.ng, g.agg.qty),
          ngPpm: ppm(g.agg.ng, g.agg.qty),
          topNg: g.agg.ng ? `${label(g.first.ngGroupId, topIdx)} (${counts[topIdx]})` : "-",
          firstDate: lotFacts.map((f) => f.workDate).sort()[0],
        };
      })
      .sort((a, b) => Number(b.ng) - Number(a.ng));
    return {
      ...base,
      subtitle: period,
      kpis: [],
      charts: [],
      tables: [
        {
          title: "NG per lot (urut NG tertinggi)",
          columns: [
            { key: "lot", label: "Lot" },
            { key: "category", label: "Kategori" },
            { key: "part", label: "Part" },
            { key: "firstDate", label: "Tanggal pertama", format: "date" },
            { key: "qty", label: "Hasil (pcs)", format: "int" },
            { key: "ng", label: "NG (pcs)", format: "int" },
            { key: "ngRate", label: "NG rate", format: "pct" },
            { key: "topNg", label: "NG terbanyak" },
          ],
          rows,
        },
      ],
    };
  }

  if (kind === "waktu") {
    const { facts, lost: allLost } = await loadFacts(master, from, to, p.categoryId);
    // Bila kategori dipilih, lost time hanya dari member-hari yang bekerja di kategori itu.
    const dayKey = (d: string, m: number) => `${d}|${m}`;
    const worked = new Set(facts.map((f) => dayKey(f.workDate, f.memberId)));
    const lost = allLost; // sudah dibagi per kategori di loadFacts
    // STKI rata-rata (berbobot menit) per member-hari, untuk menghitung potensi hasil yang hilang.
    const stkiDay = new Map<string, { w: number; min: number }>();
    for (const f of facts) {
      if (!f.stki) continue;
      const k = dayKey(f.workDate, f.memberId);
      const e = stkiDay.get(k) ?? { w: 0, min: 0 };
      e.w += f.stki * (f.minNormal + f.minOt);
      e.min += f.minNormal + f.minOt;
      stkiDay.set(k, e);
    }
    const pcsLost = (l: LostFact) => {
      if (l.group === "ANOTHER_JOB") return 0;
      const e = stkiDay.get(dayKey(l.workDate, l.memberId));
      return e && e.min ? (l.minutes / 60) * (e.w / e.min) : 0;
    };
    const { lt, aj } = lostSplit(lost);
    const workMin = facts.reduce((a, f) => a + f.minNormal, 0);
    const otMin = facts.reduce((a, f) => a + f.minOt, 0);
    const totalPcsLost = lost.reduce((a, l) => a + pcsLost(l), 0);

    const byType = new Map<string, { name: string; group: string; minutes: number; count: number; pcs: number }>();
    for (const l of lost) {
      const e = byType.get(l.name) ?? { name: l.name, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", minutes: 0, count: 0, pcs: 0 };
      e.minutes += l.minutes;
      e.count++;
      e.pcs += pcsLost(l);
      byType.set(l.name, e);
    }
    const typeRows = [...byType.values()]
      .sort((a, b) => b.minutes - a.minutes)
      .map((e) => ({ name: e.name, group: e.group, hours: e.minutes / 60, count: e.count, pcs: e.group === "Lost Time" ? Math.round(e.pcs) : null, share: lt + aj ? e.minutes / (lt + aj) : null }));

    const members = new Map<number, Row & { member: string }>();
    const mrow = (id: number, name: string) => {
      let r = members.get(id);
      if (!r) members.set(id, (r = { member: name, nik: master.members.find((m) => m.name === name)?.nik ?? "", days: 0, workHrs: 0, otHrs: 0, ltHrs: 0, ajHrs: 0, pcs: 0 }));
      return r;
    };
    for (const f of facts) {
      const r = mrow(f.memberId, f.memberName);
      r.workHrs = Number(r.workHrs) + f.minNormal / 60;
      r.otHrs = Number(r.otHrs) + f.minOt / 60;
    }
    for (const l of lost) {
      const r = mrow(l.memberId, l.memberName);
      if (l.group === "ANOTHER_JOB") r.ajHrs = Number(r.ajHrs) + l.minutes / 60;
      else r.ltHrs = Number(r.ltHrs) + l.minutes / 60;
      r.pcs = Number(r.pcs) + pcsLost(l);
    }
    for (const [id, r] of members) r.days = new Set([...facts.filter((f) => f.memberId === id).map((f) => f.workDate), ...lost.filter((l) => l.memberId === id).map((l) => l.workDate)]).size;
    const memberRows: Row[] = [...members.values()].sort((a, b) => Number(b.ltHrs) - Number(a.ltHrs)).map((r) => ({ ...r, pcs: Math.round(Number(r.pcs)) }));

    // Tren per minggu (Senin) supaya hasil perbaikan kelihatan.
    const weekOf = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
    const weeks = new Map<string, { lt: number; aj: number; ot: number }>();
    for (const l of lost) {
      const w = weeks.get(weekOf(l.workDate)) ?? { lt: 0, aj: 0, ot: 0 };
      if (l.group === "ANOTHER_JOB") w.aj += l.minutes;
      else w.lt += l.minutes;
      weeks.set(weekOf(l.workDate), w);
    }
    for (const f of facts) {
      const w = weeks.get(weekOf(f.workDate)) ?? { lt: 0, aj: 0, ot: 0 };
      w.ot += f.minOt;
      weeks.set(weekOf(f.workDate), w);
    }
    const weekRows = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([w, e]) => ({ week: `${formatDateId(w).slice(0, -5)}`, ltHrs: e.lt / 60, ajHrs: e.aj / 60, otHrs: e.ot / 60 }));

    return {
      ...base,
      subtitle: period,
      kpis: [
        { label: "Jam efektif produksi", value: workMin + lt + aj ? workMin / (workMin + lt + aj) : null, format: "pct", hint: "dari jam normal, sisanya lost time + another job" },
        { label: "Lost Time (jam)", value: lt / 60, format: "dec1", hint: `potensi hilang ${formatNum(Math.round(totalPcsLost))} pcs` },
        { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
        { label: "Jam lembur (OT)", value: otMin / 60, format: "dec1" },
      ],
      charts: [
        { type: "pareto", title: "Pareto Lost Time & Another Job (jam)", xKey: "name", series: [{ key: "hours", label: "Jam", format: "dec1" }], data: withCum(typeRows, "hours").slice(0, 12) },
        ...(weekRows.length > 1 && weekRows.some((w) => w.ltHrs > 0)
          ? [{ type: "line" as const, title: "Lost Time per minggu (jam)", xKey: "week", series: [{ key: "ltHrs", label: "Lost Time", format: "dec1" as const }], data: weekRows }]
          : []),
      ],
      tables: [
        {
          title: "Per jenis",
          columns: [
            { key: "name", label: "Jenis" },
            { key: "group", label: "Grup" },
            { key: "hours", label: "Jam", format: "dec1" },
            { key: "count", label: "Kejadian", format: "int" },
            { key: "share", label: "Porsi", format: "pct" },
            { key: "pcs", label: "Potensi hilang (pcs)", format: "int" },
          ],
          rows: typeRows,
        },
        {
          title: "Per member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "days", label: "Hari", format: "int" },
            { key: "workHrs", label: "Jam kerja normal", format: "dec1" },
            { key: "otHrs", label: "Jam OT", format: "dec1" },
            { key: "ltHrs", label: "Lost Time (jam)", format: "dec1" },
            { key: "ajHrs", label: "Another Job (jam)", format: "dec1" },
            { key: "pcs", label: "Potensi hilang (pcs)", format: "int" },
          ],
          rows: memberRows,
          total: { member: "TOTAL", workHrs: workMin / 60, otHrs: otMin / 60, ltHrs: lt / 60, ajHrs: aj / 60, pcs: Math.round(totalPcsLost) },
        },
        {
          title: "Per minggu",
          columns: [
            { key: "week", label: "Minggu mulai" },
            { key: "ltHrs", label: "Lost Time (jam)", format: "dec1" },
            { key: "ajHrs", label: "Another Job (jam)", format: "dec1" },
            { key: "otHrs", label: "Jam OT", format: "dec1" },
          ],
          rows: weekRows,
        },
        {
          title: "Rincian lost time",
          detail: true,
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "group", label: "Grup" },
            { key: "name", label: "Jenis" },
            { key: "minutes", label: "Menit", format: "int" },
            { key: "remarks", label: "Keterangan" },
          ],
          rows: [...lost]
            .sort((a, b) => b.workDate.localeCompare(a.workDate) || a.memberName.localeCompare(b.memberName))
            .map((l) => ({ date: l.workDate, member: l.memberName, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", name: l.name, minutes: l.minutes, remarks: l.remarks })),
        },
      ],
    };
  }

  if (kind === "disiplin") {
    const all = await callBackend<RawSubmission[]>("queue", {});
    const subs = all.filter((s) => s.date >= from && s.date <= to);
    const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
    const hoursBetween = (a: string, b: string) => (Date.parse(`${b.replace(" ", "T")}:00Z`) - Date.parse(`${a.replace(" ", "T")}:00Z`)) / 36e5;
    const workDays = [...new Set(subs.map((s) => s.date))].sort();
    type M = { member: string; sent: number; sameDay: number; nextDay: number; later: number; rejected: number; days: Set<string>; first: string };
    const per = new Map<string, M>();
    for (const s of subs) {
      const m = per.get(s.member) ?? { member: s.member, sent: 0, sameDay: 0, nextDay: 0, later: 0, rejected: 0, days: new Set<string>(), first: s.date };
      m.sent++;
      const late = dayDiff(s.date, s.sent);
      if (late <= 0) m.sameDay++;
      else if (late === 1) m.nextDay++;
      else m.later++;
      if (s.status === "Ditolak") m.rejected++;
      m.days.add(s.date);
      if (s.date < m.first) m.first = s.date;
      per.set(s.member, m);
    }
    const memberRows = [...per.values()]
      .map((m) => {
        // Hari tidak lapor: hari kerja (ada kiriman dari siapa pun) sejak member pertama lapor di periode ini.
        const expected = workDays.filter((d) => d >= m.first).length;
        return {
          nik: master.members.find((x) => x.name === m.member)?.nik ?? "",
          member: m.member,
          sent: m.sent,
          sameDay: m.sameDay,
          nextDay: m.nextDay,
          later: m.later,
          onTime: m.sent ? m.sameDay / m.sent : null,
          rejected: m.rejected,
          missing: Math.max(0, expected - m.days.size),
        };
      })
      .sort((a, b) => (a.onTime ?? 1) - (b.onTime ?? 1) || b.missing - a.missing);
    const decided = subs.filter((s) => s.status !== "Menunggu" && s.decided && s.sent);
    const avgHrs = decided.length ? decided.reduce((a, s) => a + Math.max(0, hoursBetween(s.sent, s.decided)), 0) / decided.length : null;
    const sameDay = subs.filter((s) => dayDiff(s.date, s.sent) <= 0).length;
    const rejected = subs.filter((s) => s.status === "Ditolak");
    const waiting = subs.filter((s) => s.status === "Menunggu");
    const byDay = workDays.map((d) => {
      const ds = subs.filter((s) => s.date === d);
      return {
        date: d,
        sent: ds.length,
        approved: ds.filter((s) => s.status === "Disetujui").length,
        waiting: ds.filter((s) => s.status === "Menunggu").length,
        rejected: ds.filter((s) => s.status === "Ditolak").length,
      };
    });
    return {
      ...base,
      subtitle: `${formatDateId(from)} – ${formatDateId(to)} · dari semua kiriman, termasuk yang menunggu dan ditolak`,
      kpis: [
        { label: "Dikirim di hari yang sama", value: subs.length ? sameDay / subs.length : null, format: "pct", hint: `${sameDay} dari ${subs.length} kiriman` },
        { label: "Rata-rata waktu validasi (jam)", value: avgHrs, format: "dec1" },
        { label: "Ditolak leader", value: rejected.length, format: "int" },
        { label: "Masih menunggu", value: waiting.length, format: "int" },
      ],
      charts: [
        { type: "bar", title: "Kirim di hari yang sama per member", xKey: "member", series: [{ key: "onTime", label: "Tepat hari itu", format: "pct" }], data: memberRows.slice(0, 20) },
      ],
      tables: [
        {
          title: "Per member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "sent", label: "Kiriman", format: "int" },
            { key: "sameDay", label: "Hari yang sama", format: "int" },
            { key: "nextDay", label: "H+1", format: "int" },
            { key: "later", label: "Lebih dari H+1", format: "int" },
            { key: "onTime", label: "Tepat waktu", format: "pct" },
            { key: "rejected", label: "Ditolak", format: "int" },
            { key: "missing", label: "Hari tidak lapor", format: "int" },
          ],
          rows: memberRows,
        },
        {
          title: "Alasan penolakan",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "leader", label: "Leader" },
            { key: "note", label: "Alasan" },
          ],
          rows: rejected.sort((a, b) => b.date.localeCompare(a.date)).map((s) => ({ date: s.date, member: s.member, leader: s.leader, note: s.note })),
        },
        {
          title: "Per hari",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "sent", label: "Kiriman", format: "int" },
            { key: "approved", label: "Disetujui", format: "int" },
            { key: "waiting", label: "Menunggu", format: "int" },
            { key: "rejected", label: "Ditolak", format: "int" },
          ],
          rows: byDay.reverse(),
        },
      ],
    };
  }

  // monthly
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : today.slice(0, 7);
  const mFrom = `${month}-01`;
  const mTo = monthEnd(mFrom);
  // 6 bulan terakhir sekaligus: untuk tren dan perbandingan dengan bulan lalu.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const hist = await loadFacts(master, `${months[0]}-01`, mTo, p.categoryId);
  const facts = hist.facts.filter((f) => f.workDate >= mFrom);
  const lost = hist.lost.filter((l) => l.workDate >= mFrom);
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthRows = months.map((m) => {
    const fs = hist.facts.filter((f) => f.workDate.startsWith(m));
    const x = totalRow(fs, st, {});
    return { month: `${BLN[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`, qty: Number(x.qty), ach: x.ach as number | null, ngRate: x.ngRate as number | null, has: fs.length > 0 };
  });
  const prev = monthRows[4];
  const vsPrev = (now: number | null, before: number | null, digits: "pct" | "num") => {
    if (!prev.has || now == null || before == null) return undefined;
    if (digits === "pct") {
      const d = (now - before) * 100;
      return `${d >= 0 ? "▲" : "▼"} ${fmt(Math.abs(d), 1)} poin vs ${prev.month}`;
    }
    if (!before) return undefined;
    const d = (now - before) / before;
    return `${d >= 0 ? "▲" : "▼"} ${Math.round(Math.abs(d) * 100)}% vs ${prev.month}`;
  };
  const memberRows = [...groupBy(facts, (f) => f.memberId).values()]
    .map((g) => {
      const { lt, aj } = lostSplit(lost.filter((l) => l.memberId === g.first.memberId));
      const days = new Set(facts.filter((f) => f.memberId === g.first.memberId).map((f) => f.workDate)).size;
      return { nik: g.first.nik, member: g.first.memberName, days, ...aggCols(g.agg, st), otHours: g.agg.minOt / 60, lostHours: lt / 60, ajHours: aj / 60 };
    })
    .sort((a, b) => String(a.member).localeCompare(String(b.member)));
  const catRows = [...groupBy(facts, (f) => f.categoryId).values()].map((g) => ({ category: g.first.categoryName, ...aggCols(g.agg, st) }));
  const t = totalRow(facts, st, { member: "TOTAL" });
  const { lt, aj } = lostSplit(lost);
  return {
    ...base,
    subtitle: `Bulan ${month}${catName ? ` · ${catName}` : ""}`,
    kpis: [
      { label: "Hasil (pcs)", value: t.qty, format: "int", hint: vsPrev(Number(t.qty), prev.qty, "num") },
      { label: "Achievement", value: t.ach, format: "pct", hint: vsPrev(t.ach as number | null, prev.ach, "pct") ?? `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : Number(t.ach) * 100, st.target) },
      { label: "NG rate", value: t.ngRate, format: "pct", hint: vsPrev(t.ngRate as number | null, prev.ngRate, "pct") ?? `${formatNum(Number(t.ng))} pcs NG`, target: `maks ${ngMaxText(st)}`, status: vsTarget(t.ngRate as number | null, ngMax(st), true) },
      { label: "Lost Time (jam)", value: lt / 60, format: "dec1", hint: `Another Job ${fmt(aj / 60, 1)} jam` },
    ],
    charts: monthRows.filter((m) => m.has).length > 1
      ? [
          { type: "line", title: "Achievement 6 bulan", xKey: "month", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: monthRows.filter((m) => m.has).map(({ has: _h, ...m }) => m) },
          { type: "line", title: "NG rate 6 bulan", xKey: "month", series: [{ key: "ngRate", label: "NG rate", format: "pct" }], data: monthRows.filter((m) => m.has).map(({ has: _h, ...m }) => m) },
        ]
      : [],
    tables: [
      {
        title: "Rekap per member",
        columns: [
          { key: "nik", label: "NIK" },
          { key: "member", label: "Member" },
          { key: "days", label: "Hari lapor", format: "int" },
          ...AGG_COLUMNS,
          { key: "otHours", label: "Jam OT", format: "dec1" },
          { key: "lostHours", label: "Lost Time (jam)", format: "dec1" },
          { key: "ajHours", label: "Another Job (jam)", format: "dec1" },
        ],
        rows: memberRows,
        total: t,
      },
      { title: "Rekap per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: catRows, total: totalRow(facts, st, { category: "TOTAL" }) },
    ],
  };
}

export function parseReportParams(sp: URLSearchParams | Record<string, string | undefined>): ReportParams {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp[k]);
  const date = (k: string) => {
    const v = get(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const int = (k: string) => {
    const v = Number(get(k));
    return Number.isInteger(v) && v > 0 ? v : undefined;
  };
  return {
    from: date("from"),
    to: date("to"),
    date: date("date"),
    month: get("month"),
    categoryId: int("category"),
    memberId: int("member"),
    partId: int("part"),
    q: get("q")?.trim().slice(0, 40) || undefined,
    proc: get("proc")?.slice(0, 40) || undefined,
    mc: get("mc")?.slice(0, 80) || undefined,
    top: get("top") === "all" ? "all" : undefined,
    sort: get("sort") === "rate" ? "rate" : undefined,
    ngt: get("ngt")?.slice(0, 60) || undefined,
    fp: int("fp"),
  };
}
