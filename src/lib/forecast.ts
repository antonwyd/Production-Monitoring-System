// Forecast vs PO aktual customer.
//
// Setiap bulan customer mengirim file forecast (mis. "11. TKI Nov 2026.xlsx"):
//  - sheet bulanan: baris = part, kolom = bulan. Baris label di atas tanggal: actual / plan / forecast.
//    "actual" = PO yang sudah terjadi, "plan" = PO firm bulan berjalan, "forecast" = perkiraan ke depan.
//    Kolom bulan yang muncul dua kali (mis. Nov di ujung kanan berlabel forecast) = forecast lama untuk bulan itu.
//    Baris "plan" di bawah total = forecast total yang dulu diberikan untuk tiap bulan (riwayat sejak 2022).
//  - sheet harian: PO per part per tanggal untuk bulan berjalan.
// Satu file = satu "versi" (bulan file). Semua versi disimpan, sehingga forecast yang dibuat lebih dulu
// bisa dibandingkan dengan PO yang akhirnya masuk, dan tren kenaikannya terlihat.

export type Jenis = "Actual" | "Plan" | "Forecast" | "Forecast lama" | "Forecast total";
export const JENIS: Jenis[] = ["Actual", "Plan", "Forecast", "Forecast lama", "Forecast total"];
/** Baris jumlah per bulan disimpan dengan nama part ini (supaya bulan bernilai 0 tetap tercatat). */
export const TOTAL = "(TOTAL)";

export type FcRow = { part: string; jenis: Jenis; bulan: string; qty: number; box?: number };
export type FcDaily = { part: string; tanggal: string; qty: number };
/** Baris tersimpan di Sheet (tab "Forecast PO"). */
export type FcStored = FcRow & { versi: string; customer: string; by?: string; at?: string; sumber?: string };
export type FcDailyStored = FcDaily & { versi: string; customer: string };

export type ParsedForecast = {
  versi: string;
  parts: { no: number | null; part: string; box: number }[];
  rows: FcRow[];
  daily: FcDaily[];
  months: { bulan: string; jenis: Jenis }[];
  warnings: string[];
  summary: { parts: number; from: string; to: string; actual: number | null; forecast: number | null; dailyDays: number };
};

export type XCell = string | number | boolean | Date | null;
export type XSheet = { name: string; cells: XCell[][]; formula?: boolean[][] };

// ---------- bulan ----------
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const ymLabel = (ym: string, long = false) => {
  const [y, m] = ym.split("-").map(Number);
  return long ? `${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][m - 1]} ${y}` : `${BLN[m - 1]} ${String(y).slice(2)}`;
};
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const isYm = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export const normPart = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
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

/** Cari baris judul tanggal. Bulanan = tanggal 1 di banyak bulan; harian = banyak tanggal di satu bulan. */
function findHeader(sh: XSheet) {
  for (let r = 0; r < Math.min(sh.cells.length, 30); r++) {
    const ds = dateCols(sh.cells[r]);
    if (ds.length < 3) continue;
    const months = new Set(ds.map((x) => ymd(x.d).slice(0, 7)));
    if (months.size >= 3 && ds.every((x) => x.d.getUTCDate() === 1)) return { r, kind: "monthly" as const, ds };
    if (months.size <= 2 && ds.length >= 10) {
      const main = [...months].sort((a, b) => ds.filter((x) => ymd(x.d).startsWith(b)).length - ds.filter((x) => ymd(x.d).startsWith(a)).length)[0];
      return { r, kind: "daily" as const, ds: ds.filter((x) => ymd(x.d).startsWith(main)) };
    }
  }
  return null;
}

/** Kolom nama part = kolom teks terbanyak di kiri kolom tanggal; No = kolom angka 1,2,3 di kirinya; isi/box = angka di kanannya. */
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
  for (let c = best + 1; c < firstDate && boxCol === null; c++) if (num(sh.cells[hr + 1]?.[c] ?? null) !== null) boxCol = c;
  return { partCol: best, noCol, boxCol };
}

function labelOf(v: XCell): Jenis | null {
  const t = String(v ?? "").trim().toLowerCase();
  if (t.startsWith("act")) return "Actual";
  if (t.startsWith("plan") || t === "po" || t.startsWith("firm")) return "Plan";
  if (t.startsWith("fore") || t.startsWith("fcst") || t === "fc") return "Forecast";
  return null;
}

export class ForecastParseError extends Error {}

/**
 * Baca isi workbook forecast customer. `sheets` = isi sel yang sudah dihitung (tanggal sebagai Date UTC).
 * Format yang dikenali mengikuti file customer (sheet bulanan + sheet harian); urutan kolom boleh bergeser.
 */
export function parseForecastBook(sheets: XSheet[], versiOverride?: string): ParsedForecast {
  const warnings: string[] = [];
  let monthly: { sh: XSheet; r: number; ds: { c: number; d: Date }[] } | null = null;
  let dailySh: { sh: XSheet; r: number; ds: { c: number; d: Date }[] } | null = null;
  for (const sh of sheets) {
    const h = findHeader(sh);
    if (!h) continue;
    if (h.kind === "monthly" && !monthly) monthly = { sh, r: h.r, ds: h.ds };
    if (h.kind === "daily" && !dailySh) dailySh = { sh, r: h.r, ds: h.ds };
  }
  if (!monthly && !dailySh) throw new ForecastParseError("Tidak menemukan baris tanggal bulan (Apr-22, Mei-22, ...) atau tanggal harian. Pastikan memakai format template.");

  const parts: ParsedForecast["parts"] = [];
  const rows: FcRow[] = [];
  const months: { bulan: string; jenis: Jenis }[] = [];
  const byNo = new Map<number, string>();
  const known = new Set<string>();
  let versi = "";

  if (monthly) {
    const { sh, r: hr, ds } = monthly;
    const pc = findPartCols(sh, hr, ds[0].c);
    if (!pc) throw new ForecastParseError(`Sheet "${sh.name}": kolom nama part tidak ditemukan.`);
    // Baris part: dari bawah judul sampai nama part kosong.
    let r = hr + 1;
    const partRows: number[] = [];
    while (r < sh.cells.length) {
      const name = normPart(sh.cells[r]?.[pc.partCol]);
      if (!name) break;
      partRows.push(r);
      r++;
    }
    if (!partRows.length) throw new ForecastParseError(`Sheet "${sh.name}": tidak ada baris part di bawah judul bulan.`);
    // Baris forecast total ("plan") di bawah baris jumlah.
    let fcTotalRow: number | null = null;
    for (let rr = r; rr < Math.min(sh.cells.length, r + 8); rr++) {
      for (let c = 0; c < ds[0].c; c++) {
        const t = String(sh.cells[rr]?.[c] ?? "").trim().toLowerCase();
        if (t === "plan" || t === "forecast" || t === "fcst") fcTotalRow = rr;
      }
      if (fcTotalRow !== null) break;
    }
    // Kolom bulan: kemunculan pertama = utama, kemunculan berikutnya = forecast lama.
    const seen = new Set<string>();
    const cols: { c: number; bulan: string; jenis: Jenis | null; dup: boolean }[] = [];
    for (const { c, d } of ds) {
      const bulan = ymd(d).slice(0, 7);
      const dup = seen.has(bulan);
      seen.add(bulan);
      cols.push({ c, bulan, jenis: labelOf(sh.cells[hr - 1]?.[c] ?? null), dup });
    }
    const main = cols.filter((x) => !x.dup);
    const dups = cols.filter((x) => x.dup);
    // Versi = bulan PO harian, atau bulan yang punya forecast lama, atau bulan "plan" terakhir.
    const plans = main.filter((x) => x.jenis === "Plan").map((x) => x.bulan);
    const firstFc = main.find((x) => x.jenis === "Forecast")?.bulan;
    versi = versiOverride || (dailySh ? ymd(dailySh.ds[0].d).slice(0, 7) : "") || dups[0]?.bulan || plans[plans.length - 1] || (firstFc ? addMonths(firstFc, -1) : "");
    if (!isYm(versi)) throw new ForecastParseError("Bulan versi file tidak bisa ditentukan. Isi bulan versi secara manual.");
    for (const x of main) {
      if (!x.jenis) x.jenis = x.bulan < versi ? "Actual" : x.bulan === versi ? "Plan" : "Forecast";
      months.push({ bulan: x.bulan, jenis: x.jenis });
    }
    const sums = new Map<string, number>();
    for (const pr of partRows) {
      const part = normPart(sh.cells[pr][pc.partCol]);
      const box = pc.boxCol !== null ? num(sh.cells[pr][pc.boxCol]) ?? 0 : 0;
      const no = pc.noCol !== null ? num(sh.cells[pr][pc.noCol]) : null;
      if (known.has(part)) warnings.push(`Part "${part}" muncul dua kali; angkanya dijumlahkan.`);
      known.add(part);
      parts.push({ no, part, box });
      if (no !== null) byNo.set(no, part);
      for (const x of [...main, ...dups]) {
        const q = num(sh.cells[pr][x.c] ?? null) ?? 0;
        const jenis: Jenis = x.dup ? "Forecast lama" : x.jenis!;
        const k = `${jenis}|${x.bulan}`;
        sums.set(k, (sums.get(k) ?? 0) + q);
        if (q) rows.push({ part, jenis, bulan: x.bulan, qty: q, box });
      }
    }
    for (const [k, q] of sums) {
      const [jenis, bulan] = k.split("|") as [Jenis, string];
      rows.push({ part: TOTAL, jenis, bulan, qty: q });
    }
    if (fcTotalRow !== null) {
      for (const x of main) {
        if (x.jenis === "Forecast") continue; // bulan depan: forecast total = jumlah part, tidak perlu
        if (sh.formula?.[fcTotalRow]?.[x.c]) continue; // rumus (mis. =BG52) = belum ada forecast tersendiri
        const q = num(sh.cells[fcTotalRow]?.[x.c] ?? null);
        if (q !== null && q > 0) rows.push({ part: TOTAL, jenis: "Forecast total", bulan: x.bulan, qty: q });
      }
    }
  }

  // ---------- harian ----------
  const daily: FcDaily[] = [];
  if (dailySh) {
    const { sh, r: hr, ds } = dailySh;
    const pc = findPartCols(sh, hr, ds[0].c);
    if (!pc) warnings.push(`Sheet "${sh.name}": kolom part tidak ditemukan, data harian dilewati.`);
    else {
      if (!versi) versi = versiOverride || ymd(ds[0].d).slice(0, 7);
      let renamed = 0;
      const unknown: string[] = [];
      for (let r = hr + 1; r < sh.cells.length; r++) {
        let part = normPart(sh.cells[r]?.[pc.partCol]);
        if (!part) break;
        const no = pc.noCol !== null ? num(sh.cells[r][pc.noCol]) : null;
        // Nama di sheet harian kadang beda tipis dengan sheet bulanan: cocokkan lewat No urut.
        if (known.size && !known.has(part) && no !== null && byNo.has(no)) {
          part = byNo.get(no)!;
          renamed++;
        } else if (known.size && !known.has(part)) unknown.push(part);
        for (const { c, d } of ds) {
          const q = num(sh.cells[r][c] ?? null) ?? 0;
          if (q) daily.push({ part, tanggal: ymd(d), qty: q });
        }
      }
      if (renamed) warnings.push(`${renamed} nama part di sheet harian berbeda dengan sheet bulanan; disamakan lewat nomor urut.`);
      if (unknown.length) warnings.push(`Part harian tidak ada di sheet bulanan: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`);
      if (!monthly) {
        // Hanya sheet harian: PO bulan itu = jumlah harian.
        const per = new Map<string, number>();
        for (const d of daily) per.set(d.part, (per.get(d.part) ?? 0) + d.qty);
        for (const [part, qty] of per) rows.push({ part, jenis: "Plan", bulan: versi, qty });
        rows.push({ part: TOTAL, jenis: "Plan", bulan: versi, qty: [...per.values()].reduce((a, b) => a + b, 0) });
        months.push({ bulan: versi, jenis: "Plan" });
      }
    }
  }

  const tot = (j: Jenis, b: string) => rows.find((x) => x.part === TOTAL && x.jenis === j && x.bulan === b)?.qty ?? null;
  const act = tot("Plan", versi) ?? tot("Actual", versi);
  const fc = tot("Forecast total", versi) ?? tot("Forecast lama", versi);
  if (monthly && dailySh) {
    const dSum = daily.reduce((a, b) => a + b.qty, 0);
    if (act !== null && Math.abs(dSum - act) > 0.5) warnings.push(`Jumlah PO harian (${Math.round(dSum).toLocaleString("id-ID")}) tidak sama dengan PO bulan ${ymLabel(versi)} di sheet bulanan (${Math.round(act).toLocaleString("id-ID")}).`);
  }
  const ms = months.map((m) => m.bulan).sort();
  return {
    versi,
    parts,
    rows,
    daily,
    months,
    warnings,
    summary: { parts: parts.length || new Set(daily.map((d) => d.part)).size, from: ms[0] ?? versi, to: ms[ms.length - 1] ?? versi, actual: act, forecast: fc, dailyDays: new Set(daily.map((d) => d.tanggal)).size },
  };
}

// ---------- analisa ----------
export const ALL = "Semua customer";
export const ALL_PARTS = "Semua part";
/** Fiscal year Apr–Mar: FY2026 = Apr 2026 – Mar 2027. */
export const fyOf = (ym: string) => (Number(ym.slice(5, 7)) >= 4 ? Number(ym.slice(0, 4)) : Number(ym.slice(0, 4)) - 1);
export const fyMonths = (fy: number) => Array.from({ length: 12 }, (_, i) => addMonths(`${fy}-04`, i));
export const fyLabel = (fy: number) => `FY${fy} (Apr ${fy} – Mar ${fy + 1})`;

export type MonthPoint = {
  bulan: string;
  kind: "actual" | "plan" | "forecast" | "none";
  actual: number | null;
  forecast: number | null;
  diff: number | null;
  pct: number | null;
  /** Achievement = PO / forecast. */
  ach: number | null;
  /** Kenaikan PO dibanding bulan sebelumnya / bulan yang sama tahun lalu. */
  mom: number | null;
  yoy: number | null;
  /** Untuk bulan depan: forecast versi sebelumnya (revisi forecast). */
  prevForecast: number | null;
};
export type PartPoint = {
  part: string;
  box: number;
  forecast: number | null;
  actual: number | null;
  diff: number | null;
  pct: number | null;
  prevActual: number | null;
  mom: number | null;
  next: number | null;
  spark: (number | null)[];
};
export type FySummary = {
  months: number;
  matched: number;
  forecast: number | null;
  actual: number | null;
  achievement: number | null;
  gap: number | null;
  gapPct: number | null;
  actualAll: number;
  prevActual: number | null;
  prevForecast: number | null;
  actualGrowth: number | null;
  forecastGrowth: number | null;
  /** Forecast bulan sisa FY (belum ada PO). */
  remaining: number | null;
  remainingMonths: number;
  last: MonthPoint | null;
};
export type ForecastReport = {
  customer: string;
  customers: string[];
  part: string;
  partsList: string[];
  fy: number;
  fys: number[];
  versions: { versi: string; customer: string; by: string; at: string; sumber: string }[];
  months: MonthPoint[];
  fyPoints: MonthPoint[];
  fySum: FySummary;
  perCustomer: { customer: string; actual: number; forecast: number | null; ach: number | null }[];
  selected: string | null;
  sel: MonthPoint | null;
  nextMonth: MonthPoint | null;
  parts: PartPoint[];
  daily: { tanggal: string; qty: number; cum: number; pace: number | null }[];
  dailyParts: { part: string; days: Record<string, number>; total: number }[];
  stats: { n: number; accuracy: number | null; bias: number | null; below: number; above: number; within: number; growth12: number | null };
  revisions: { bulan: string; now: number; prev: number; diff: number; pct: number | null }[];
};

const pctOf = (a: number | null, b: number | null) => (a === null || b === null || !b ? null : (a - b) / b);

type Src = { kind: "actual" | "plan" | "forecast"; act: Map<string, number> | null; fc: Map<string, number> | null; fcTotal: number | null; prevFc: Map<string, number> | null };

/** Sumber angka per bulan untuk satu customer (lihat aturan di atas file). */
function sourcesFor(rows: FcStored[]) {
  const verSet = [...new Set(rows.map((r) => r.versi))].sort();
  const idx = new Map<string, Map<string, number>>();
  const key = (v: string, j: Jenis, b: string) => `${v}|${j}|${b}`;
  for (const r of rows) {
    const k = key(r.versi, r.jenis, r.bulan);
    const m = idx.get(k) ?? idx.set(k, new Map()).get(k)!;
    m.set(r.part, (m.get(r.part) ?? 0) + r.qty);
  }
  const get = (v: string, j: Jenis, b: string) => idx.get(key(v, j, b));
  const srcOf = new Map<string, Src>();
  for (const b of [...new Set(rows.map((r) => r.bulan))].sort()) {
    // PO aktual: versi terbaru yang mencatat bulan ini sebagai Actual/Plan.
    let vA: string | null = null,
      jA: Jenis = "Actual";
    for (let i = verSet.length - 1; i >= 0 && !vA; i--) for (const j of ["Plan", "Actual"] as Jenis[]) if (!vA && get(verSet[i], j, b)?.has(TOTAL)) (vA = verSet[i]), (jA = j);
    if (vA) {
      // Forecast: forecast lama di versi itu, atau forecast bulan ini dari versi sebelumnya yang terbaru.
      let fc = get(vA, "Forecast lama", b) ?? null;
      if (!fc) for (let i = verSet.indexOf(vA) - 1; i >= 0 && !fc; i--) fc = get(verSet[i], "Forecast", b) ?? null;
      const fcTotal = get(vA, "Forecast total", b)?.get(TOTAL) ?? fc?.get(TOTAL) ?? null;
      srcOf.set(b, { kind: jA === "Plan" ? "plan" : "actual", act: get(vA, jA, b)!, fc, fcTotal, prevFc: null });
    } else {
      const vs = verSet.filter((v) => get(v, "Forecast", b)?.has(TOTAL));
      if (!vs.length) continue;
      const fc = get(vs[vs.length - 1], "Forecast", b)!;
      srcOf.set(b, { kind: "forecast", act: null, fc, fcTotal: fc.get(TOTAL) ?? null, prevFc: vs.length > 1 ? get(vs[vs.length - 2], "Forecast", b)! : null });
    }
  }
  return srcOf;
}

function addMap(a: Map<string, number> | null, b: Map<string, number> | null) {
  if (!a) return b ? new Map(b) : null;
  if (!b) return a;
  const out = new Map(a);
  b.forEach((v, k) => out.set(k, (out.get(k) ?? 0) + v));
  return out;
}

/** Gabung beberapa customer: angka dijumlah per bulan. */
function mergeSources(list: Map<string, Src>[]): Map<string, Src> {
  if (list.length === 1) return list[0];
  const out = new Map<string, Src>();
  for (const src of list)
    for (const [b, s] of src) {
      const o = out.get(b);
      if (!o) {
        out.set(b, { ...s, act: s.act && new Map(s.act), fc: s.fc && new Map(s.fc), prevFc: s.prevFc && new Map(s.prevFc) });
        continue;
      }
      o.kind = o.kind === "plan" || s.kind === "plan" ? "plan" : o.kind === "actual" || s.kind === "actual" ? "actual" : "forecast";
      o.act = addMap(o.act, s.act);
      o.fc = addMap(o.fc, s.fc);
      o.prevFc = addMap(o.prevFc, s.prevFc);
      o.fcTotal = o.fcTotal === null && s.fcTotal === null ? null : (o.fcTotal ?? 0) + (s.fcTotal ?? 0);
    }
  return out;
}

export function buildForecastReport(
  rowsAll: FcStored[],
  dailyAll: FcDailyStored[],
  opts: { customer?: string; month?: string; fy?: number | string; part?: string } = {},
): ForecastReport {
  const customers = [...new Set(rowsAll.map((r) => r.customer))].sort();
  const customer = opts.customer && customers.includes(opts.customer) ? opts.customer : customers.length > 1 ? ALL : customers[0] ?? ALL;
  const picked = customer === ALL ? customers : [customer];
  const perCust = new Map(picked.map((c) => [c, sourcesFor(rowsAll.filter((r) => r.customer === c))]));
  const srcOf = mergeSources([...perCust.values()]);
  const rows = rowsAll.filter((r) => picked.includes(r.customer));
  const versions = [...new Set(rows.map((r) => `${r.versi}|${r.customer}`))].sort().map((k) => {
    const [versi, c] = k.split("|");
    const r = rows.find((x) => x.versi === versi && x.customer === c)!;
    return { versi, customer: c, by: r.by ?? "", at: r.at ?? "", sumber: r.sumber ?? "" };
  });
  const boxOf = new Map<string, number>();
  for (const r of rows) if (r.box && r.part !== TOTAL) boxOf.set(r.part, r.box);
  const partsList = [...new Set(rows.filter((r) => r.part !== TOTAL).map((r) => r.part))].sort();
  const part = opts.part && partsList.includes(opts.part) ? opts.part : ALL_PARTS;
  const one = part !== ALL_PARTS;

  const actOf = (s: Src | undefined) => (!s?.act ? null : one ? s.act.get(part) ?? 0 : s.act.get(TOTAL) ?? null);
  const fcOf = (s: Src | undefined) => (!s ? null : one ? (s.fc ? s.fc.get(part) ?? 0 : null) : s.fcTotal);
  const point = (b: string): MonthPoint => {
    const s = srcOf.get(b);
    const actual = actOf(s);
    const forecast = fcOf(s);
    const base = actual ?? (s?.kind === "forecast" ? forecast : null);
    const prevFc = s?.prevFc ? (one ? s.prevFc.get(part) ?? 0 : s.prevFc.get(TOTAL) ?? null) : null;
    return {
      bulan: b,
      kind: s?.kind ?? "none",
      actual,
      forecast,
      diff: actual !== null && forecast !== null ? actual - forecast : null,
      pct: pctOf(actual, forecast),
      ach: actual !== null && forecast ? actual / forecast : null,
      mom: pctOf(base, actOf(srcOf.get(addMonths(b, -1)))),
      yoy: pctOf(base, actOf(srcOf.get(addMonths(b, -12)))),
      prevForecast: prevFc,
    };
  };
  const months = [...srcOf.keys()].sort().map(point);

  // Bulan terpilih (untuk detail part & harian) dan fiscal year.
  const withAct = months.filter((m) => m.actual !== null);
  const latest = withAct[withAct.length - 1]?.bulan ?? null;
  const fys = [...new Set(months.map((m) => fyOf(m.bulan)))].sort((a, b) => b - a);
  const fyIn = Number(opts.fy);
  const selIn = opts.month && withAct.some((m) => m.bulan === opts.month) ? opts.month : null;
  const fy = fys.includes(fyIn) ? fyIn : selIn ? fyOf(selIn) : latest ? fyOf(latest) : fys[0] ?? fyOf(new Date().toISOString().slice(0, 7));
  const inFy = withAct.filter((m) => fyOf(m.bulan) === fy);
  const selected = selIn && fyOf(selIn) === fy ? selIn : inFy[inFy.length - 1]?.bulan ?? latest;
  const sel = months.find((m) => m.bulan === selected) ?? null;
  const nextMonth = selected ? months.find((m) => m.bulan === addMonths(selected, 1)) ?? null : null;

  // Ringkasan FY: PO & forecast s/d bulan PO terakhir di FY; achievement hanya bulan yang punya keduanya.
  const fyPoints = fyMonths(fy).map((b) => months.find((m) => m.bulan === b) ?? { ...point(b), kind: "none" as const });
  const done = fyPoints.filter((m) => m.actual !== null);
  const pairs = done.filter((m) => m.forecast !== null);
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, v) => a + (v ?? 0), 0);
  const fcM = pairs.length ? sum(pairs.map((m) => m.forecast)) : null;
  // Belum ada forecast sama sekali di FY ini: PO tetap ditampilkan (semua bulan).
  const base = pairs.length ? pairs : done;
  const acM = base.length ? sum(base.map((m) => m.actual)) : null;
  const prevYear = (m: MonthPoint) => srcOf.get(addMonths(m.bulan, -12));
  // Pembanding FY lalu = bulan yang sama dengan bulan yang dibandingkan (ada PO & forecast).
  const prevAct = base.length && base.every((m) => actOf(prevYear(m)) !== null) ? sum(base.map((m) => actOf(prevYear(m)))) : null;
  const prevFc = pairs.length && pairs.every((m) => fcOf(prevYear(m)) !== null) ? sum(pairs.map((m) => fcOf(prevYear(m)))) : null;
  const rest = fyPoints.filter((m) => m.actual === null && m.forecast !== null);
  const fySum: FySummary = {
    months: done.length,
    matched: pairs.length,
    forecast: fcM,
    actual: acM,
    achievement: fcM ? acM! / fcM : null,
    gap: fcM !== null ? acM! - fcM : null,
    gapPct: fcM !== null ? pctOf(acM, fcM) : null,
    actualAll: sum(done.map((m) => m.actual)),
    prevActual: prevAct,
    prevForecast: prevFc,
    actualGrowth: pctOf(acM, prevAct),
    forecastGrowth: pctOf(fcM, prevFc),
    remaining: rest.length ? sum(rest.map((m) => m.forecast)) : null,
    remainingMonths: rest.length,
    last: done[done.length - 1] ?? null,
  };

  // Per customer (FY s/d bulan terakhir).
  const perCustomer = [...perCust].map(([c, src]) => {
    let a = 0,
      aM = 0,
      f = 0,
      n = 0;
    for (const b of fyMonths(fy)) {
      const s = src.get(b);
      const av = actOf(s);
      if (av === null) continue;
      a += av;
      const fv = fcOf(s);
      if (fv !== null) (f += fv), (aM += av), n++;
    }
    return { customer: c, actual: a, forecast: n ? f : null, ach: n && f ? aM / f : null };
  });
  perCustomer.sort((x, y) => y.actual - x.actual);

  // Per part untuk bulan terpilih.
  const parts: PartPoint[] = [];
  if (selected) {
    const s = srcOf.get(selected)!;
    const prevS = srcOf.get(addMonths(selected, -1));
    const nextS = srcOf.get(addMonths(selected, 1));
    const names = new Set<string>();
    for (const m of [s.act, s.fc, nextS?.act ?? nextS?.fc ?? null]) m?.forEach((_, p) => p !== TOTAL && names.add(p));
    const sparkMonths = Array.from({ length: 12 }, (_, i) => addMonths(selected, i - 11));
    for (const p of names) {
      if (one && p !== part) continue;
      const actual = s.act ? s.act.get(p) ?? 0 : null;
      const forecast = s.fc ? s.fc.get(p) ?? 0 : null;
      const prevActual = prevS?.act ? prevS.act.get(p) ?? 0 : null;
      parts.push({
        part: p,
        box: boxOf.get(p) ?? 0,
        forecast,
        actual,
        diff: actual !== null && forecast !== null ? actual - forecast : null,
        pct: pctOf(actual, forecast),
        prevActual,
        mom: pctOf(actual, prevActual),
        next: nextS ? (nextS.act ?? nextS.fc)?.get(p) ?? 0 : null,
        spark: sparkMonths.map((b) => {
          const x = srcOf.get(b);
          return x?.act ? x.act.get(p) ?? 0 : null;
        }),
      });
    }
    parts.sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0) || (b.actual ?? 0) - (a.actual ?? 0) || a.part.localeCompare(b.part));
  }

  // Harian bulan terpilih: per customer dari versi terbaru yang punya data harian bulan itu.
  let daily: ForecastReport["daily"] = [];
  let dailyParts: ForecastReport["dailyParts"] = [];
  if (selected) {
    const mine: FcDailyStored[] = [];
    for (const c of picked) {
      const ds = dailyAll.filter((d) => d.customer === c && d.tanggal.startsWith(selected) && (!one || d.part === part));
      const v = [...new Set(ds.map((d) => d.versi))].sort().pop();
      mine.push(...ds.filter((d) => d.versi === v));
    }
    if (mine.length) {
      const per = new Map<string, number>();
      const pp = new Map<string, Record<string, number>>();
      for (const d of mine) {
        per.set(d.tanggal, (per.get(d.tanggal) ?? 0) + d.qty);
        const rec = pp.get(d.part) ?? pp.set(d.part, {}).get(d.part)!;
        rec[d.tanggal] = (rec[d.tanggal] ?? 0) + d.qty;
      }
      const [y, m] = selected.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const fcDay = sel?.forecast && per.size ? sel.forecast / per.size : null;
      let cum = 0,
        cumPace = 0;
      for (let d = 1; d <= last; d++) {
        const t = `${selected}-${String(d).padStart(2, "0")}`;
        const q = per.get(t) ?? 0;
        cum += q;
        if (q && fcDay) cumPace += fcDay;
        daily.push({ tanggal: t, qty: q, cum, pace: fcDay ? cumPace : null });
      }
      dailyParts = [...pp].map(([p, days]) => ({ part: p, days, total: Object.values(days).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
    }
  }

  // Statistik 12 bulan terakhir yang punya forecast & aktual (sampai bulan terpilih).
  const hist = months.filter((m) => m.pct !== null && (!selected || m.bulan <= selected)).slice(-12);
  const tol = 0.1;
  const stats = {
    n: hist.length,
    accuracy: hist.length ? 1 - hist.reduce((a, m) => a + Math.abs(m.pct!), 0) / hist.length : null,
    bias: hist.length ? hist.reduce((a, m) => a + m.pct!, 0) / hist.length : null,
    below: hist.filter((m) => m.pct! < -tol).length,
    above: hist.filter((m) => m.pct! > tol).length,
    within: hist.filter((m) => Math.abs(m.pct!) <= tol).length,
    growth12: (() => {
      if (!selected) return null;
      const total = (from: number) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const a = actOf(srcOf.get(addMonths(selected, from - i)));
          if (a === null) return null;
          t += a;
        }
        return t;
      };
      return pctOf(total(0), total(-12));
    })(),
  };

  // Revisi forecast: bulan ke depan, forecast versi terbaru vs versi sebelumnya.
  const revisions = months
    .filter((m) => m.kind === "forecast" && m.forecast !== null && m.prevForecast !== null)
    .map((m) => ({ bulan: m.bulan, now: m.forecast!, prev: m.prevForecast!, diff: m.forecast! - m.prevForecast!, pct: pctOf(m.forecast, m.prevForecast) }));

  return { customer, customers, part, partsList, fy, fys, versions, months, fyPoints, fySum, perCustomer, selected, sel, nextMonth, parts, daily, dailyParts, stats, revisions };
}

/** Status selisih PO vs forecast: dalam ±10% dianggap sesuai. */
export function diffStatus(pct: number | null): "naik" | "turun" | "sesuai" | "none" {
  if (pct === null) return "none";
  if (pct > 0.1) return "naik";
  if (pct < -0.1) return "turun";
  return "sesuai";
}

/** Gabungkan input manual satu bulan ke baris versi bulan itu. */
export function mergeManual(existing: FcRow[], bulan: string, items: { part: string; forecast: number | null; actual: number | null; box?: number }[]): FcRow[] {
  const touched = new Set(items.map((i) => normPart(i.part)));
  const keep = existing.filter((r) => {
    if (r.bulan !== bulan) return true;
    if (r.part === TOTAL) return !["Plan", "Actual", "Forecast lama", "Forecast total"].includes(r.jenis);
    if (r.jenis === "Plan" || r.jenis === "Actual") return !touched.has(r.part);
    if (r.jenis === "Forecast lama") return !touched.has(r.part);
    return true;
  });
  const actJenis: Jenis = existing.some((r) => r.bulan === bulan && r.jenis === "Actual" && r.part !== TOTAL) ? "Actual" : "Plan";
  for (const it of items) {
    const part = normPart(it.part);
    if (!part) continue;
    if (it.actual) keep.push({ part, jenis: actJenis, bulan, qty: it.actual, box: it.box });
    if (it.forecast) keep.push({ part, jenis: "Forecast lama", bulan, qty: it.forecast, box: it.box });
  }
  // Hitung ulang total bulan itu.
  const hasFc = keep.some((r) => r.bulan === bulan && r.jenis === "Forecast lama");
  for (const j of [actJenis, ...(hasFc ? (["Forecast lama"] as Jenis[]) : [])]) {
    const q = keep.filter((r) => r.bulan === bulan && r.jenis === j && r.part !== TOTAL).reduce((a, r) => a + r.qty, 0);
    keep.push({ part: TOTAL, jenis: j, bulan, qty: q });
  }
  return keep;
}
