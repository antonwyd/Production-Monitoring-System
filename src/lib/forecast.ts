// Forecast harian vs Actual PO harian customer.
//
// Awal bulan customer mengirim forecast harian (Part × tanggal 1..akhir bulan): di-upload lewat template
// atau diinput sekaligus (tempel tabel dari Excel). Setiap hari PO turun untuk tanggal kirim berikutnya
// (PO hari ini = kirim besok) dan diinput per tanggal kirim. Dashboard membandingkan forecast vs PO per hari
// dan kumulatif s/d batas (tanggal PO terakhir / hari ini), sehingga tiap hari terlihat kenaikan dan trennya.
// Satu upload/input forecast = satu "versi" (bulan) per customer; menyimpan ulang bulan yang sama menimpa.

export type FcDaily = { part: string; tanggal: string; qty: number; box?: number };
/** Baris tersimpan (tab "Forecast Harian"). */
export type FcDailyStored = FcDaily & { versi: string; customer: string; by?: string; at?: string };
/** Baris PO per tanggal kirim (tab "PO Harian"). */
export type PoDaily = { customer: string; part: string; tanggal: string; qty: number; by?: string; at?: string };

export type ParsedForecast = {
  versi: string;
  sheet: string;
  parts: { no: number | null; part: string; box: number; total: number }[];
  daily: FcDaily[];
  warnings: string[];
  summary: { parts: number; days: number; total: number; from: string; to: string };
};

export type XCell = string | number | boolean | Date | null;
export type XSheet = { name: string; cells: XCell[][]; formula?: boolean[][] };

// ---------- tanggal ----------
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BLN_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const ymLabel = (ym: string, long = false) => {
  const [y, m] = ym.split("-").map(Number);
  return long ? `${BLN_LONG[m - 1]} ${y}` : `${BLN[m - 1]} ${String(y).slice(2)}`;
};
/** "2026-11-07" -> "7 Nov" (atau "Sab, 7 Nov"). */
export const dayLabel = (t: string, withDay = false) => {
  const d = new Date(`${t}T00:00:00Z`);
  const s = `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}`;
  return withDay ? `${["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getUTCDay()]}, ${s}` : s;
};
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const isYm = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const daysIn = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const monthDays = (ym: string) => Array.from({ length: daysIn(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
export const isOff = (t: string) => [0, 6].includes(new Date(`${t}T00:00:00Z`).getUTCDay());

export const normPart = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Angka ketikan/tempelan: "12.000", "12,000", "12000" -> 12000. */
export function toQty(s: unknown): number | null {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const t = String(s ?? "").trim().replace(/\s/g, "");
  if (t === "" || t === "-") return null;
  const n = Number(t.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: XCell) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v.replace(/,/g, ""))) ? Number(v.replace(/,/g, "")) : null);

// ---------- baca file ----------
function dateCols(row: XCell[] | undefined) {
  const out: { c: number; d: Date }[] = [];
  (row ?? []).forEach((v, c) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) out.push({ c, d: v });
  });
  return out;
}

/** Baris judul harian = banyak tanggal dalam satu bulan (sheet bulanan = tanggal 1 di banyak bulan, dilewati). */
function findDailyHeader(sh: XSheet) {
  for (let r = 0; r < Math.min(sh.cells.length, 30); r++) {
    const ds = dateCols(sh.cells[r]);
    if (ds.length < 10) continue;
    const months = new Set(ds.map((x) => ymd(x.d).slice(0, 7)));
    if (months.size > 2) continue;
    const main = [...months].sort((a, b) => ds.filter((x) => ymd(x.d).startsWith(b)).length - ds.filter((x) => ymd(x.d).startsWith(a)).length)[0];
    return { r, ds: ds.filter((x) => ymd(x.d).startsWith(main)) };
  }
  return null;
}
const looksMonthly = (sh: XSheet) => {
  for (let r = 0; r < Math.min(sh.cells.length, 30); r++) {
    const ds = dateCols(sh.cells[r]);
    if (ds.length >= 3 && new Set(ds.map((x) => ymd(x.d).slice(0, 7))).size >= 3) return true;
  }
  return false;
};

/** Kolom nama part = kolom teks terbanyak di kiri kolom tanggal; No = kolom angka di kirinya; isi/box = angka pertama di kanannya (bukan "Total"). */
function findPartCols(sh: XSheet, hr: number, firstDate: number) {
  let best = -1,
    bestN = 0;
  for (let c = 0; c < firstDate; c++) {
    let n = 0;
    for (let r = hr + 1; r < Math.min(sh.cells.length, hr + 15); r++) {
      const v = sh.cells[r]?.[c];
      if (typeof v === "string" && normPart(v).length >= 3 && num(v) === null) n++;
    }
    if (n > bestN) (best = c), (bestN = n);
  }
  if (best < 0) return null;
  let noCol: number | null = null,
    boxCol: number | null = null;
  for (let c = best - 1; c >= 0 && noCol === null; c--) if (num(sh.cells[hr + 1]?.[c] ?? null) !== null) noCol = c;
  for (let c = best + 1; c < firstDate && boxCol === null; c++) {
    if (String(sh.cells[hr]?.[c] ?? "").toLowerCase().includes("total")) continue;
    if (num(sh.cells[hr + 1]?.[c] ?? null) !== null) boxCol = c;
  }
  return { partCol: best, noCol, boxCol };
}

export class ForecastParseError extends Error {}

/**
 * Baca forecast harian dari workbook. Dipakai sheet pertama yang punya baris tanggal harian
 * (nama berisi "daily"/"harian" didahulukan). Sheet bulanan, bila masih ada, diabaikan.
 */
export function parseForecastBook(sheets: XSheet[]): ParsedForecast {
  const warnings: string[] = [];
  const order = [...sheets].sort((a, b) => Number(/daily|harian/i.test(b.name)) - Number(/daily|harian/i.test(a.name)));
  let found: { sh: XSheet; r: number; ds: { c: number; d: Date }[] } | null = null;
  for (const sh of order) {
    const h = findDailyHeader(sh);
    if (h) {
      found = { sh, ...h };
      break;
    }
  }
  if (!found) {
    if (sheets.some(looksMonthly)) throw new ForecastParseError("File ini hanya berisi sheet bulanan. Upload sheet forecast harian (Part × tanggal 1–31), atau unduh template.");
    throw new ForecastParseError("Tidak menemukan baris tanggal harian (1, 2, 3, … dalam satu bulan). Pastikan memakai format template.");
  }
  const sh = found.sh;
  if (sheets.some((s) => s !== sh && looksMonthly(s))) warnings.push(`Sheet bulanan diabaikan; yang dibaca hanya sheet "${sh.name}".`);
  const { r: hr, ds } = found;
  const pc = findPartCols(sh, hr, ds[0].c);
  if (!pc) throw new ForecastParseError(`Sheet "${sh.name}": kolom nama part tidak ditemukan.`);
  const versi = ymd(ds[0].d).slice(0, 7);
  const parts: ParsedForecast["parts"] = [];
  const daily: FcDaily[] = [];
  const seen = new Map<string, ParsedForecast["parts"][number]>();
  for (let r = hr + 1; r < sh.cells.length; r++) {
    const part = normPart(sh.cells[r]?.[pc.partCol]);
    if (!part || /^(sub ?)?total\b|^jumlah\b/i.test(part)) break;
    const no = pc.noCol !== null ? num(sh.cells[r][pc.noCol]) : null;
    const box = pc.boxCol !== null ? num(sh.cells[r][pc.boxCol]) ?? 0 : 0;
    let p = seen.get(part);
    if (p) warnings.push(`Part "${part}" muncul dua kali; angkanya dijumlahkan.`);
    else {
      p = { no, part, box, total: 0 };
      seen.set(part, p);
      parts.push(p);
    }
    for (const { c, d } of ds) {
      const q = num(sh.cells[r][c] ?? null) ?? 0;
      if (q > 0) {
        daily.push({ part, tanggal: ymd(d), qty: q, box: box || undefined });
        p.total += q;
      }
    }
  }
  if (!parts.length) throw new ForecastParseError(`Sheet "${sh.name}": tidak ada baris part di bawah judul tanggal.`);
  return finish(versi, sh.name, parts, daily, warnings);
}

function finish(versi: string, sheet: string, parts: ParsedForecast["parts"], daily: FcDaily[], warnings: string[]): ParsedForecast {
  if (!daily.length) warnings.push("Semua qty forecast kosong / nol.");
  const zero = parts.filter((p) => !p.total).length;
  if (zero && daily.length) warnings.push(`${zero} part tanpa forecast bulan ini (tetap muncul di daftar input PO).`);
  const ts = daily.map((d) => d.tanggal).sort();
  return {
    versi,
    sheet,
    parts,
    daily,
    warnings,
    summary: { parts: parts.length, days: new Set(ts).size, total: daily.reduce((a, d) => a + d.qty, 0), from: ts[0] ?? `${versi}-01`, to: ts[ts.length - 1] ?? `${versi}-01` },
  };
}

/**
 * Forecast dari isian form (grid Part × tanggal). `grid[i][d]` = qty tanggal d+1.
 */
export function forecastFromGrid(versi: string, rows: { part: string; box?: number; days: (number | null)[] }[]): ParsedForecast {
  const warnings: string[] = [];
  const dates = monthDays(versi);
  const parts: ParsedForecast["parts"] = [];
  const daily: FcDaily[] = [];
  const seen = new Map<string, ParsedForecast["parts"][number]>();
  rows.forEach((r, i) => {
    const part = normPart(r.part);
    if (!part) return;
    let p = seen.get(part);
    if (p) warnings.push(`Part "${part}" diisi dua kali; angkanya dijumlahkan.`);
    else {
      p = { no: i + 1, part, box: r.box ?? 0, total: 0 };
      seen.set(part, p);
      parts.push(p);
    }
    dates.forEach((t, d) => {
      const q = r.days[d] ?? 0;
      if (q > 0) {
        daily.push({ part, tanggal: t, qty: q, box: r.box || undefined });
        p!.total += q;
      }
    });
  });
  return finish(versi, "Input", parts, daily, warnings);
}

// ---------- analisa ----------
export const ALL = "Semua customer";
export const ALL_PARTS = "Semua part";

export type DayPoint = {
  tanggal: string;
  fc: number;
  po: number | null;
  cumFc: number;
  cumPo: number | null;
  /** Achievement kumulatif s/d tanggal ini (PO ÷ forecast). */
  ach: number | null;
  /** Sesudah batas (belum ada PO). */
  future: boolean;
};
export type PartRow = {
  part: string;
  box: number;
  fcMonth: number;
  fcUpto: number;
  poUpto: number;
  diff: number;
  pct: number | null;
  ach: number | null;
  /** PO & forecast pada tanggal batas. */
  lastPo: number;
  lastFc: number;
  spark: (number | null)[];
};
export type MonthRow = { bulan: string; fc: number; po: number; fcUpto: number; poUpto: number; ach: number | null; partial: boolean; upto: string | null };

export type ForecastReport = {
  customer: string;
  customers: string[];
  part: string;
  partsList: string[];
  month: string | null;
  months: string[];
  /** Batas perbandingan: tanggal PO terakhir atau hari ini (yang lebih akhir), dalam bulan terpilih. */
  upto: string | null;
  today: string;
  days: DayPoint[];
  kpi: {
    fcMonth: number;
    fcUpto: number;
    poUpto: number;
    poMonth: number;
    ach: number | null;
    gap: number;
    gapPct: number | null;
    fcRest: number;
    /** Achievement 7 hari terakhir s/d batas, dan 7 hari sebelumnya. */
    ach7: number | null;
    ach7prev: number | null;
    /** PO bulan lalu s/d tanggal yang sama. */
    poPrevMonth: number | null;
    poDays: number;
    lastDay: DayPoint | null;
  };
  perCustomer: { customer: string; fcUpto: number; poUpto: number; fcMonth: number; ach: number | null }[];
  parts: PartRow[];
  heat: { part: string; fc: Record<string, number>; po: Record<string, number>; fcTotal: number; poTotal: number }[];
  monthly: MonthRow[];
  versions: { versi: string; customer: string; by: string; at: string; parts: number; total: number }[];
  poDates: { tanggal: string; customer: string; by: string; at: string; total: number }[];
};

const pctOf = (a: number | null, b: number | null) => (a === null || b === null || !b ? null : (a - b) / b);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Forecast terpakai: per customer + bulan, hanya versi terbaru yang mencakup bulan itu. */
export function latestForecast(fc: FcDailyStored[]): FcDailyStored[] {
  const best = new Map<string, string>();
  for (const r of fc) {
    const k = `${r.customer}|${r.tanggal.slice(0, 7)}`;
    if (!best.has(k) || r.versi > best.get(k)!) best.set(k, r.versi);
  }
  return fc.filter((r) => best.get(`${r.customer}|${r.tanggal.slice(0, 7)}`) === r.versi);
}

/** Batas perbandingan untuk satu bulan: bulan lampau = akhir bulan; bulan berjalan = max(hari ini, PO terakhir). */
function uptoOf(month: string, today: string, lastPo: string | null): string | null {
  const ds = monthDays(month);
  const thisMonth = today.slice(0, 7);
  if (month < thisMonth) return ds[ds.length - 1];
  if (month > thisMonth) return lastPo;
  return lastPo && lastPo > today ? lastPo : today;
}

export function buildForecastReport(fcAll: FcDailyStored[], poAll: PoDaily[], opts: { customer?: string; month?: string; part?: string; today: string }): ForecastReport {
  const today = opts.today;
  const thisMonth = today.slice(0, 7);
  const customers = [...new Set([...fcAll.map((r) => r.customer), ...poAll.map((r) => r.customer)])].filter(Boolean).sort();
  const customer = opts.customer && (customers.includes(opts.customer) || (opts.customer === ALL && customers.length > 1)) ? opts.customer : customers.length > 1 ? ALL : customers[0] ?? ALL;
  const picked = new Set(customer === ALL ? customers : [customer]);
  const fcC = latestForecast(fcAll).filter((r) => picked.has(r.customer));
  const poC = poAll.filter((r) => picked.has(r.customer) && r.qty);

  const versions = [...new Set(fcAll.filter((r) => picked.has(r.customer)).map((r) => `${r.versi}|${r.customer}`))]
    .sort()
    .map((k) => {
      const [versi, c] = k.split("|");
      const rs = fcAll.filter((x) => x.versi === versi && x.customer === c);
      return { versi, customer: c, by: rs[0]?.by ?? "", at: rs[0]?.at ?? "", parts: new Set(rs.map((x) => x.part)).size, total: sum(rs.map((x) => x.qty)) };
    });
  const poDates = [...new Set(poC.map((r) => `${r.tanggal}|${r.customer}`))]
    .sort()
    .reverse()
    .map((k) => {
      const [tanggal, c] = k.split("|");
      const rs = poC.filter((x) => x.tanggal === tanggal && x.customer === c);
      const last = rs.reduce((a, x) => ((x.at ?? "") > (a.at ?? "") ? x : a), rs[0]);
      return { tanggal, customer: c, by: last?.by ?? "", at: last?.at ?? "", total: sum(rs.map((x) => x.qty)) };
    });

  const months = [...new Set([...fcC.map((r) => r.tanggal.slice(0, 7)), ...poC.map((r) => r.tanggal.slice(0, 7))])].sort().reverse();
  const month = opts.month && months.includes(opts.month) ? opts.month : months.includes(thisMonth) ? thisMonth : months.find((m) => m <= thisMonth) ?? months[months.length - 1] ?? null;

  const empty: ForecastReport = {
    customer,
    customers,
    part: ALL_PARTS,
    partsList: [],
    month,
    months,
    upto: null,
    today,
    days: [],
    kpi: { fcMonth: 0, fcUpto: 0, poUpto: 0, poMonth: 0, ach: null, gap: 0, gapPct: null, fcRest: 0, ach7: null, ach7prev: null, poPrevMonth: null, poDays: 0, lastDay: null },
    perCustomer: [],
    parts: [],
    heat: [],
    monthly: [],
    versions,
    poDates,
  };
  if (!month) return empty;

  const inM = <T extends { tanggal: string }>(xs: T[], m: string) => xs.filter((x) => x.tanggal.startsWith(m));
  const fcM = inM(fcC, month);
  const poM = inM(poC, month);
  const partsList = [...new Set([...fcM.map((r) => r.part), ...poM.map((r) => r.part)])].sort();
  const part = opts.part && partsList.includes(opts.part) ? opts.part : ALL_PARTS;
  const one = part !== ALL_PARTS;
  const ofPart = <T extends { part: string }>(xs: T[]) => (one ? xs.filter((r) => r.part === part) : xs);
  const fcP = ofPart(fcM);
  const poP = ofPart(poM);

  const dates = monthDays(month);
  const upto = uptoOf(month, today, poM.map((r) => r.tanggal).sort().pop() ?? null);
  const byDay = (xs: { tanggal: string; qty: number }[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x.tanggal, (m.get(x.tanggal) ?? 0) + x.qty);
    return m;
  };
  const fcD = byDay(fcP);
  const poD = byDay(poP);
  let cf = 0,
    cp = 0;
  const days: DayPoint[] = dates.map((t) => {
    const future = !upto || t > upto;
    const fc = fcD.get(t) ?? 0;
    const po = future ? poD.get(t) ?? null : poD.get(t) ?? 0;
    cf += fc;
    if (!future) cp += po ?? 0;
    return { tanggal: t, fc, po, cumFc: cf, cumPo: future ? null : cp, ach: !future && cf ? cp / cf : null, future };
  });

  const done = days.filter((d) => !d.future);
  const fcUpto = sum(done.map((d) => d.fc));
  const poUpto = sum(done.map((d) => d.po ?? 0));
  const fcMonth = sum(days.map((d) => d.fc));
  const win = (from: number, to: number) => {
    const xs = done.slice(Math.max(0, done.length - to), Math.max(0, done.length - from));
    const f = sum(xs.map((d) => d.fc));
    return xs.length && f ? sum(xs.map((d) => d.po ?? 0)) / f : null;
  };
  const prev = addMonths(month, -1);
  const poPrevAll = ofPart(inM(poC, prev));
  const sameDay = upto ? `${prev}-${String(Math.min(Number(upto.slice(8)), daysIn(prev))).padStart(2, "0")}` : null;
  const poPrevMonth = poPrevAll.length && sameDay ? sum(poPrevAll.filter((r) => r.tanggal <= sameDay).map((r) => r.qty)) : null;
  const lastDay = [...done].reverse().find((d) => (d.po ?? 0) > 0) ?? null;

  const kpi: ForecastReport["kpi"] = {
    fcMonth,
    fcUpto,
    poUpto,
    poMonth: sum(days.map((d) => d.po ?? 0)),
    ach: fcUpto ? poUpto / fcUpto : null,
    gap: poUpto - fcUpto,
    gapPct: pctOf(poUpto, fcUpto),
    fcRest: fcMonth - fcUpto,
    ach7: win(0, 7),
    ach7prev: win(7, 14),
    poPrevMonth,
    poDays: done.filter((d) => (d.po ?? 0) > 0).length,
    lastDay,
  };

  const within = (t: string) => !!upto && t <= upto;
  const perCustomer = [...picked].map((c) => {
    const f = ofPart(fcM.filter((r) => r.customer === c));
    const p = ofPart(poM.filter((r) => r.customer === c));
    const fu = sum(f.filter((r) => within(r.tanggal)).map((r) => r.qty));
    const pu = sum(p.filter((r) => within(r.tanggal)).map((r) => r.qty));
    return { customer: c, fcUpto: fu, poUpto: pu, fcMonth: sum(f.map((r) => r.qty)), ach: fu ? pu / fu : null };
  });
  perCustomer.sort((a, b) => b.poUpto - a.poUpto || b.fcMonth - a.fcMonth);

  const boxOf = new Map<string, number>();
  for (const r of fcM) if (r.box) boxOf.set(r.part, r.box);
  const parts: PartRow[] = [];
  const heat: ForecastReport["heat"] = [];
  for (const p of one ? [part] : partsList) {
    const f = fcM.filter((r) => r.part === p);
    const q = poM.filter((r) => r.part === p);
    const fd = byDay(f);
    const qd = byDay(q);
    const fu = sum(f.filter((r) => within(r.tanggal)).map((r) => r.qty));
    const pu = sum(q.filter((r) => within(r.tanggal)).map((r) => r.qty));
    parts.push({
      part: p,
      box: boxOf.get(p) ?? 0,
      fcMonth: sum(f.map((r) => r.qty)),
      fcUpto: fu,
      poUpto: pu,
      diff: pu - fu,
      pct: pctOf(pu, fu),
      ach: fu ? pu / fu : null,
      lastPo: upto ? qd.get(upto) ?? 0 : 0,
      lastFc: upto ? fd.get(upto) ?? 0 : 0,
      spark: dates.map((t) => (within(t) ? qd.get(t) ?? 0 : null)),
    });
    heat.push({ part: p, fc: Object.fromEntries(fd), po: Object.fromEntries(qd), fcTotal: sum(f.map((r) => r.qty)), poTotal: sum(q.map((r) => r.qty)) });
  }
  parts.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.fcMonth - a.fcMonth || a.part.localeCompare(b.part));
  heat.sort((a, b) => b.fcTotal - a.fcTotal || b.poTotal - a.poTotal || a.part.localeCompare(b.part));

  // Tren bulanan: maks 12 bulan s/d bulan terpilih. Bulan berjalan dihitung s/d batasnya.
  const monthly: MonthRow[] = months
    .filter((m) => m <= month)
    .slice(0, 12)
    .reverse()
    .map((m) => {
      const f = ofPart(inM(fcC, m));
      const p = ofPart(inM(poC, m));
      const ds = monthDays(m);
      const u = uptoOf(m, today, inM(poC, m).map((r) => r.tanggal).sort().pop() ?? null);
      const fu = u ? sum(f.filter((r) => r.tanggal <= u).map((r) => r.qty)) : 0;
      const pu = u ? sum(p.filter((r) => r.tanggal <= u).map((r) => r.qty)) : 0;
      return { bulan: m, fc: sum(f.map((r) => r.qty)), po: sum(p.map((r) => r.qty)), fcUpto: fu, poUpto: pu, ach: fu ? pu / fu : null, partial: !!u && u < ds[ds.length - 1], upto: u };
    });

  return { ...empty, part, partsList, upto, days, kpi, perCustomer, parts, heat, monthly };
}

/** Status selisih PO vs forecast: dalam ±10% dianggap sesuai. */
export function diffStatus(pct: number | null): "naik" | "turun" | "sesuai" | "none" {
  if (pct === null) return "none";
  if (pct > 0.1) return "naik";
  if (pct < -0.1) return "turun";
  return "sesuai";
}
