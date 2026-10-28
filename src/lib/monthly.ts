// Production Report bulanan per section (pengganti PPT akhir bulan untuk Presdir).
// Result dari Input - Production (laporan yang sudah disetujui), Plan dari tab "Plan Bulanan" yang diisi leader.
import { callBackend, type RawRows } from "./backend";
import { addDays, monthEnd, todayJakarta } from "./dates";
import { loadMaster } from "./service";
import { readPlans, type MonthPlan } from "./sheets/plan";

export type SectionDef = {
  key: string;
  name: string;
  categories: string[];
  /** member = dihitung per orang (Senbetsu/Seiretsu), machine = per mesin (PF). */
  unit: "member" | "machine";
  /** Kolom Daily Production: per kategori (Normal + OT) atau per part (Drum PF). */
  split: "category" | "part";
};

export const SECTIONS: SectionDef[] = [
  { key: "senbetsu-iron", name: "Senbetsu Iron", categories: ["Senbetsu Iron Cage", "Senbetsu Shield Cage"], unit: "member", split: "category" },
  { key: "senbetsu-plastik", name: "Senbetsu Plastik", categories: ["Senbetsu Plastik Cage"], unit: "member", split: "category" },
  { key: "seiretsu-iron", name: "Seiretsu Iron", categories: ["Seiretsu Iron Cage"], unit: "member", split: "category" },
  { key: "seiretsu-plastik", name: "Seiretsu Plastik", categories: ["Seiretsu Plastik Cage"], unit: "member", split: "category" },
  { key: "drum-pf", name: "Drum PF", categories: ["Drum PF"], unit: "machine", split: "part" },
  { key: "bowl-pf-iron", name: "Bowl PF Iron", categories: ["PF Iron Cage"], unit: "machine", split: "category" },
  { key: "bowl-pf-plastik", name: "Bowl PF Plastik", categories: ["PF Plastik"], unit: "machine", split: "category" },
];

export const unitLabel = (d: SectionDef) => (d.unit === "machine" ? "Machine" : "Member");

export type DailyRow = {
  date: string;
  day: number;
  /** Hari kerja menurut plan (hari libur: plan 0, tanggal merah). */
  work: boolean;
  plan: number;
  cols: number[];
  total: number;
  balance: number;
  cumPlan: number;
  cumResult: number;
};

export type PlanResultLine = {
  label: string;
  plan: number | null;
  result: number | null;
  pct: number | null;
  next: number | null;
  /** dec1 untuk jam, int untuk lainnya. */
  format: "int" | "dec1";
};

export type SectionReport = {
  def: SectionDef;
  columns: string[];
  daily: DailyRow[];
  total: { plan: number; cols: number[]; total: number; balance: number };
  lines: PlanResultLine[];
  plan: MonthPlan | null;
  nextPlan: MonthPlan | null;
  hasPlan: boolean;
  pic: string;
  note: string;
  /** Kategori section yang tidak ada di Master Data (nama berubah?). */
  missing: string[];
  /** Rincian per part (urut qty terbesar): share = porsi dari total section. */
  parts: PartLine[];
  quality: { qty: number; ng: number; rate: number | null; top: { name: string; qty: number; share: number }[] };
  progress?: Progress;
};

export type PartLine = { part: string; category: string; qty: number; qtyOt: number; share: number; ng: number; rate: number | null; topNg: string };

/** Posisi bulan berjalan: dibandingkan dengan plan s/d hari ini, bukan plan sebulan penuh. */
export type Progress = {
  /** Tanggal terakhir yang dihitung (hari ini, atau akhir bulan untuk bulan yang sudah lewat). */
  asOf: string;
  result: number;
  planToDate: number | null;
  planMonth: number | null;
  /** result / plan s/d hari ini. */
  pctToDate: number | null;
  pctMonth: number | null;
  workDone: number;
  workTotal: number;
  /** Perkiraan akhir bulan dengan kecepatan rata-rata per hari kerja sejauh ini. */
  forecast: number | null;
  /** pcs per hari kerja yang masih perlu agar plan bulan ini tercapai. */
  needPerDay: number | null;
  status: "ahead" | "near" | "behind" | "noplan" | "nodata";
};

export type MonthlyReport = {
  month: string;
  asOf: string;
  nextMonth: string;
  label: string;
  nextLabel: string;
  sections: SectionReport[];
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const monthLabel = (m: string) => `${BULAN[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const monthShort = (m: string) => `${BLN[Number(m.slice(5, 7)) - 1]}-${m.slice(2, 4)}`;
export const isValidMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function nextMonthOf(m: string): string {
  return addDays(monthEnd(`${m}-01`), 1).slice(0, 7);
}
export function prevMonthOf(m: string): string {
  return addDays(`${m}-01`, -1).slice(0, 7);
}

export function daysOf(m: string): string[] {
  const out: string[] = [];
  for (let d = `${m}-01`; d.startsWith(m); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Hari kerja bawaan: Senin-Jumat. Leader bisa mengubah (libur nasional, Sabtu masuk). */
export function defaultWorkDays(m: string): number[] {
  return daysOf(m)
    .filter((d) => {
      const w = new Date(`${d}T00:00:00Z`).getUTCDay();
      return w !== 0 && w !== 6;
    })
    .map((d) => Number(d.slice(8)));
}

/** Jam normal bawaan per orang/mesin: hari kerja x jam kerja normal (Master Data, 480 menit = 8 jam). */
export const defaultHours = (days: number, normalMin: number) => Math.round(((days * normalMin) / 60) * 10) / 10;

const ratio = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? a / b : null);

type Acc = { qtyN: number; qtyOt: number; hN: number; hOt: number; units: Set<string> };

/** Bentuk satu section dari baris Input (sudah difilter ke kategori section). */
export function buildSection(
  def: SectionDef,
  month: string,
  rows: (string | number)[][],
  plan: MonthPlan | null,
  nextPlan: MonthPlan | null,
  normalMin: number,
  knownCats: string[],
  ngNames: Record<string, string[]> = {},
): SectionReport {
  const cats = def.categories;
  const mine = rows.filter((r) => cats.includes(String(r[2])));

  // Kolom Daily Production
  const short = (c: string) => c.replace(/\bcage\b/i, "").replace(new RegExp(`^${def.name.split(" ")[0]}\\s*`, "i"), "").trim() || c;
  const partOf = (r: (string | number)[]) => `${r[3]}${r[4] && r[4] !== "-" ? ` ${r[4]}` : ""}`;
  let keys: string[];
  let columns: string[];
  if (def.split === "part") {
    const tot = new Map<string, number>();
    for (const r of mine) tot.set(partOf(r), (tot.get(partOf(r)) ?? 0) + (Number(r[5]) || 0) + (Number(r[7]) || 0));
    keys = [...tot.keys()].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
    columns = keys;
  } else {
    const used = cats.filter((c) => knownCats.includes(c) || mine.some((r) => r[2] === c));
    keys = used.flatMap((c) => [`${c}|N`, `${c}|OT`]);
    columns = used.length === 1 ? ["Normal", "OT"] : used.flatMap((c) => [short(c), `OT ${short(c)}`]);
  }
  const colIdx = new Map(keys.map((k, i) => [k, i]));

  const days = daysOf(month);
  const workDays = new Set(plan?.workDays.length ? plan.workDays : defaultWorkDays(month));
  const nWork = days.filter((d) => workDays.has(Number(d.slice(8)))).length;
  const dailyPlan = plan && nWork ? plan.production / nWork : 0;

  const byDay = new Map<string, number[]>();
  const acc: Acc = { qtyN: 0, qtyOt: 0, hN: 0, hOt: 0, units: new Set() };
  const members = new Set<string>();
  for (const r of mine) {
    const num = (i: number) => Number(r[i]) || 0;
    const qn = num(5),
      qo = num(7);
    const cols = byDay.get(String(r[0])) ?? Array(keys.length).fill(0);
    if (def.split === "part") cols[colIdx.get(partOf(r))!] += qn + qo;
    else {
      cols[colIdx.get(`${r[2]}|N`)!] += qn;
      cols[colIdx.get(`${r[2]}|OT`)!] += qo;
    }
    byDay.set(String(r[0]), cols);
    acc.qtyN += qn;
    acc.qtyOt += qo;
    members.add(String(r[1]));
    const mc = String(r[11] ?? "");
    if (def.unit === "machine" && mc && mc !== "-") {
      acc.units.add(`${r[2]}|${mc}`);
      // Menit MC (AM/AN) bila ada; baris lama tanpa menit MC memakai menit orang.
      const hasMc = r[23] !== "" || r[24] !== "";
      acc.hN += (hasMc ? num(23) : num(6)) / 60;
      acc.hOt += (hasMc ? num(24) : num(8)) / 60;
    } else if (def.unit === "member") {
      acc.hN += num(6) / 60;
      acc.hOt += num(8) / 60;
    }
  }
  if (def.unit === "member") acc.units = members;

  // Per part & kualitas (NG1..NG10 di kolom 12..21, nama jenis NG dari grup NG kategori)
  const ngLabel = (cat: string, i: number) => ngNames[cat]?.[i] || `NG${i + 1}`;
  const partMap = new Map<string, PartLine & { ngBy: Map<string, number> }>();
  const ngAll = new Map<string, number>();
  for (const r of mine) {
    const k = `${r[2]}|${partOf(r)}`;
    const p = partMap.get(k) ?? { part: partOf(r), category: String(r[2]), qty: 0, qtyOt: 0, share: 0, ng: 0, rate: null, topNg: "", ngBy: new Map() };
    p.qty += (Number(r[5]) || 0) + (Number(r[7]) || 0);
    p.qtyOt += Number(r[7]) || 0;
    for (let i = 0; i < 10; i++) {
      const v = Number(r[12 + i]) || 0;
      if (!v) continue;
      const name = ngLabel(String(r[2]), i);
      p.ng += v;
      p.ngBy.set(name, (p.ngBy.get(name) ?? 0) + v);
      ngAll.set(name, (ngAll.get(name) ?? 0) + v);
    }
    partMap.set(k, p);
  }
  const qtyAll = acc.qtyN + acc.qtyOt;
  const parts: PartLine[] = [...partMap.values()]
    .map(({ ngBy, ...p }) => ({
      ...p,
      share: qtyAll ? p.qty / qtyAll : 0,
      rate: p.qty + p.ng ? p.ng / (p.qty + p.ng) : null,
      topNg: [...ngBy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
    }))
    .sort((a, b) => b.qty - a.qty);
  const ngTotal = [...ngAll.values()].reduce((a, b) => a + b, 0);
  const quality = {
    qty: qtyAll,
    ng: ngTotal,
    rate: qtyAll + ngTotal ? ngTotal / (qtyAll + ngTotal) : null,
    top: [...ngAll.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty, share: ngTotal ? qty / ngTotal : 0 })),
  };

  let cumPlan = 0,
    cumResult = 0;
  const daily: DailyRow[] = days.map((d) => {
    const work = workDays.has(Number(d.slice(8)));
    const cols = byDay.get(d) ?? Array(keys.length).fill(0);
    const total = cols.reduce((a, b) => a + b, 0);
    const p = work ? dailyPlan : 0;
    cumPlan += p;
    cumResult += total;
    return { date: d, day: Number(d.slice(8)), work, plan: p, cols, total, balance: total - p, cumPlan, cumResult };
  });
  const totCols = keys.map((_, i) => daily.reduce((a, r) => a + r.cols[i], 0));
  const production = acc.qtyN + acc.qtyOt;
  const planProd = plan ? plan.production : null;

  // Plan & Result
  const units = acc.units.size;
  const res = {
    production: mine.length ? production : null,
    hoursNormal: units ? acc.hN / units : null,
    hoursOt: units ? acc.hOt / units : null,
    hoursReq: units ? (acc.hN + acc.hOt) / units : null,
    units: units || null,
    productivity: acc.hN + acc.hOt > 0 ? production / (acc.hN + acc.hOt) : null,
  };
  const planOf = (p: MonthPlan | null, m: string) => {
    if (!p) return { production: null, hoursNormal: null, hoursReq: null, hoursOt: null, units: null, productivity: null };
    const nDays = p.workDays.length || defaultWorkDays(m).length;
    const hoursNormal = p.hoursNormal || defaultHours(nDays, normalMin);
    const hoursReq = p.productivity > 0 && p.units > 0 ? p.production / (p.productivity * p.units) : null;
    return {
      production: p.production,
      hoursNormal,
      hoursReq,
      hoursOt: hoursReq != null ? hoursReq - hoursNormal : null,
      units: p.units || null,
      productivity: p.productivity || null,
    };
  };
  const pl = planOf(plan, month);
  const nx = planOf(nextPlan, nextMonthOf(month));
  const line = (label: string, k: keyof typeof res, format: "int" | "dec1" = "int"): PlanResultLine => ({
    label,
    plan: pl[k],
    result: res[k],
    pct: ratio(res[k], pl[k]),
    next: nx[k],
    format,
  });

  return {
    def,
    columns,
    daily,
    total: { plan: planProd ?? 0, cols: totCols, total: production, balance: production - (planProd ?? 0) },
    lines: [
      line("Production", "production"),
      line("Time Normal (H)", "hoursNormal", "dec1"),
      line("Time Required (H)", "hoursReq", "dec1"),
      line("Need Over Time (H)", "hoursOt", "dec1"),
      line(unitLabel(def), "units"),
      line(def.unit === "machine" ? "Productivity (pcs/MC/jam)" : "Productivity (pcs/org/jam)", "productivity"),
    ],
    plan,
    nextPlan,
    hasPlan: !!plan,
    pic: plan?.by ?? "",
    note: plan?.note ?? "",
    missing: cats.filter((c) => !knownCats.includes(c)),
    parts,
    quality,
  };
}

/** Pencapaian s/d tanggal asOf, proyeksi akhir bulan, dan kebutuhan per hari kerja tersisa. */
export function progressOf(s: Pick<SectionReport, "daily" | "hasPlan" | "total">, asOf: string): Progress {
  const upto = s.daily.filter((d) => d.date <= asOf);
  const last = upto[upto.length - 1];
  const result = last?.cumResult ?? 0;
  const workTotal = s.daily.filter((d) => d.work).length;
  const workDone = upto.filter((d) => d.work).length;
  const planMonth = s.hasPlan ? s.total.plan : null;
  const planToDate = s.hasPlan ? (last?.cumPlan ?? 0) : null;
  const finished = upto.length === s.daily.length;
  const forecast = finished ? result : workDone > 0 ? (result / workDone) * workTotal : null;
  const left = workTotal - workDone;
  const pctToDate = planToDate ? result / planToDate : null;
  const status: Progress["status"] = !s.hasPlan ? "noplan" : pctToDate == null ? "nodata" : pctToDate >= 1 ? "ahead" : pctToDate >= 0.95 ? "near" : "behind";
  return {
    asOf: last?.date ?? asOf,
    result,
    planToDate,
    planMonth,
    pctToDate,
    pctMonth: planMonth ? result / planMonth : null,
    workDone,
    workTotal,
    forecast,
    needPerDay: planMonth != null && left > 0 ? Math.max(0, planMonth - result) / left : null,
    status,
  };
}

export async function buildMonthly(month: string, today = todayJakarta()): Promise<MonthlyReport> {
  const next = nextMonthOf(month);
  const [raw, master, plans] = await Promise.all([
    callBackend<RawRows>("rows", { from: `${month}-01`, to: monthEnd(`${month}-01`) }),
    loadMaster(),
    readPlans([month, next]),
  ]);
  const known = master.categories.map((c) => c.name);
  const ngNames: Record<string, string[]> = {};
  for (const c of master.categories) ngNames[c.name] = master.ngGroups.find((g) => g.id === c.ngGroupId)?.codes ?? [];
  const find = (m: string, key: string) => plans.find((p) => p.month === m && p.section === key) ?? null;
  const asOf = today < `${month}-01` ? `${month}-00` : today > monthEnd(`${month}-01`) ? monthEnd(`${month}-01`) : today;
  const sections = SECTIONS.map((d) => buildSection(d, month, raw.prod, find(month, d.key), find(next, d.key), master.settings.normalMin, known, ngNames));
  for (const s of sections) s.progress = progressOf(s, asOf);
  return {
    month,
    asOf,
    nextMonth: next,
    label: monthLabel(month),
    nextLabel: monthLabel(next),
    sections,
  };
}

/** Bulan bawaan: sampai tanggal 10 masih bulan lalu (laporan dibuat awal bulan), sesudahnya bulan berjalan. */
export function defaultMonth(today: string): string {
  return Number(today.slice(8, 10)) <= 10 ? prevMonthOf(today.slice(0, 7)) : today.slice(0, 7);
}
