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
export type MonthPoint = {
  bulan: string;
  kind: "actual" | "plan" | "forecast";
  actual: number | null;
  forecast: number | null;
  diff: number | null;
  pct: number | null;
  /** Kenaikan PO dibanding bulan sebelumnya / bulan yang sama tahun lalu. */
  mom: number | null;
  yoy: number | null;
  /** Untuk bulan depan: forecast versi sebelumnya (revisi forecast). */
  prevForecast: number | null;
  versi: string;
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
export type ForecastReport = {
  customer: string;
  customers: string[];
  versions: { versi: string; by: string; at: string; sumber: string }[];
  months: MonthPoint[];
  selected: string | null;
  sel: MonthPoint | null;
  nextMonth: MonthPoint | null;
  parts: PartPoint[];
  daily: { tanggal: string; qty: number; cum: number; pace: number | null }[];
  dailyParts: { part: string; days: Record<string, number>; total: number }[];
  stats: { n: number; accuracy: number | null; bias: number | null; below: number; above: number; within: number; growth12: number | null };
  revisions: { bulan: string; now: number; prev: number; diff: number; pct: number | null; prevVersi: string }[];
};

const pctOf = (a: number | null, b: number | null) => (a === null || b === null || !b ? null : (a - b) / b);

export function buildForecastReport(rowsAll: FcStored[], dailyAll: FcDailyStored[], customerIn?: string, selectedIn?: string): ForecastReport {
  const customers = [...new Set(rowsAll.map((r) => r.customer))].sort();
  const customer = customerIn && customers.includes(customerIn) ? customerIn : customers[0] ?? "";
  const rows = rowsAll.filter((r) => r.customer === customer);
  const verSet = [...new Set(rows.map((r) => r.versi))].sort();
  const versions = verSet.map((v) => {
    const r = rows.find((x) => x.versi === v)!;
    return { versi: v, by: r.by ?? "", at: r.at ?? "", sumber: r.sumber ?? "" };
  });

  // Indeks: versi -> jenis -> bulan -> part -> qty
  const idx = new Map<string, Map<string, number>>();
  const key = (v: string, j: Jenis, b: string) => `${v}|${j}|${b}`;
  const boxOf = new Map<string, number>();
  for (const r of rows) {
    const k = key(r.versi, r.jenis, r.bulan);
    const m = idx.get(k) ?? idx.set(k, new Map()).get(k)!;
    m.set(r.part, (m.get(r.part) ?? 0) + r.qty);
    if (r.box && r.part !== TOTAL) boxOf.set(r.part, r.box);
  }
  const get = (v: string, j: Jenis, b: string) => idx.get(key(v, j, b));
  const allMonths = [...new Set(rows.map((r) => r.bulan))].sort();

  type Src = { kind: MonthPoint["kind"]; versi: string; act: Map<string, number> | null; fc: Map<string, number> | null; fcTotal: number | null; prevFc: number | null };
  const srcOf = new Map<string, Src>();
  for (const b of allMonths) {
    // PO aktual: versi terbaru yang mencatat bulan ini sebagai Actual/Plan.
    let vA: string | null = null,
      jA: Jenis = "Actual";
    for (let i = verSet.length - 1; i >= 0 && !vA; i--) {
      for (const j of ["Plan", "Actual"] as Jenis[]) if (!vA && get(verSet[i], j, b)?.has(TOTAL)) (vA = verSet[i]), (jA = j);
    }
    if (vA) {
      const act = get(vA, jA, b)!;
      // Forecast: forecast lama di versi itu, atau forecast bulan ini dari versi sebelumnya yang terbaru.
      let fc = get(vA, "Forecast lama", b) ?? null;
      if (!fc) for (let i = verSet.indexOf(vA) - 1; i >= 0 && !fc; i--) fc = get(verSet[i], "Forecast", b) ?? null;
      const fcTotal = get(vA, "Forecast total", b)?.get(TOTAL) ?? fc?.get(TOTAL) ?? null;
      srcOf.set(b, { kind: jA === "Plan" ? "plan" : "actual", versi: vA, act, fc, fcTotal, prevFc: null });
    } else {
      const vs = verSet.filter((v) => get(v, "Forecast", b)?.has(TOTAL));
      if (!vs.length) continue;
      const v = vs[vs.length - 1];
      const fc = get(v, "Forecast", b)!;
      const prev = vs.length > 1 ? get(vs[vs.length - 2], "Forecast", b)!.get(TOTAL) ?? null : null;
      srcOf.set(b, { kind: "forecast", versi: v, act: null, fc, fcTotal: fc.get(TOTAL) ?? null, prevFc: prev });
    }
  }

  const months: MonthPoint[] = [];
  for (const b of allMonths) {
    const s = srcOf.get(b);
    if (!s) continue;
    const actual = s.act?.get(TOTAL) ?? null;
    const forecast = s.fcTotal;
    const prevAct = srcOf.get(addMonths(b, -1))?.act?.get(TOTAL) ?? null;
    const yAct = srcOf.get(addMonths(b, -12))?.act?.get(TOTAL) ?? null;
    const base = actual ?? (s.kind === "forecast" ? forecast : null);
    months.push({
      bulan: b,
      kind: s.kind,
      actual,
      forecast,
      diff: actual !== null && forecast !== null ? actual - forecast : null,
      pct: pctOf(actual, forecast),
      mom: pctOf(base, prevAct),
      yoy: pctOf(base, yAct),
      prevForecast: s.prevFc,
      versi: s.versi,
    });
  }

  const withAct = months.filter((m) => m.actual !== null);
  const latestVer = verSet[verSet.length - 1];
  const defaultSel = (latestVer && months.find((m) => m.bulan === latestVer && m.actual !== null)?.bulan) || withAct[withAct.length - 1]?.bulan || null;
  const selected = selectedIn && months.some((m) => m.bulan === selectedIn) ? selectedIn : defaultSel;
  const sel = months.find((m) => m.bulan === selected) ?? null;
  const nextMonth = selected ? months.find((m) => m.bulan === addMonths(selected, 1)) ?? null : null;

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
      const actual = s.act ? s.act.get(p) ?? 0 : null;
      const forecast = s.fc ? s.fc.get(p) ?? 0 : null;
      const prevActual = prevS?.act ? prevS.act.get(p) ?? 0 : null;
      const nm = nextS ? (nextS.act ?? nextS.fc)?.get(p) ?? 0 : null;
      parts.push({
        part: p,
        box: boxOf.get(p) ?? 0,
        forecast,
        actual,
        diff: actual !== null && forecast !== null ? actual - forecast : null,
        pct: pctOf(actual, forecast),
        prevActual,
        mom: pctOf(actual, prevActual),
        next: nm,
        spark: sparkMonths.map((b) => {
          const x = srcOf.get(b);
          return x?.act ? x.act.get(p) ?? 0 : null;
        }),
      });
    }
    parts.sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0) || (b.actual ?? 0) - (a.actual ?? 0) || a.part.localeCompare(b.part));
  }

  // Harian bulan terpilih: dari versi terbaru yang punya data harian bulan itu.
  let daily: ForecastReport["daily"] = [];
  let dailyParts: ForecastReport["dailyParts"] = [];
  if (selected) {
    const ds = dailyAll.filter((d) => d.customer === customer && d.tanggal.startsWith(selected));
    const v = [...new Set(ds.map((d) => d.versi))].sort().pop();
    const mine = ds.filter((d) => d.versi === v);
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
      const poDays = [...per.keys()].length;
      const fcDay = sel?.forecast && poDays ? sel.forecast / poDays : null;
      let cum = 0,
        cumPace = 0;
      for (let d = 1; d <= last; d++) {
        const t = `${selected}-${String(d).padStart(2, "0")}`;
        const q = per.get(t) ?? 0;
        cum += q;
        if (q && fcDay) cumPace += fcDay;
        daily.push({ tanggal: t, qty: q, cum, pace: fcDay ? cumPace : null });
      }
      dailyParts = [...pp].map(([part, days]) => ({ part, days, total: Object.values(days).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
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
      const sum = (from: number) => {
        let t = 0;
        for (let i = 0; i < 12; i++) {
          const a = srcOf.get(addMonths(selected, from - i))?.act?.get(TOTAL);
          if (a === undefined) return null;
          t += a;
        }
        return t;
      };
      return pctOf(sum(0), sum(-12));
    })(),
  };

  // Revisi forecast: bulan ke depan, forecast versi terbaru vs versi sebelumnya.
  const revisions: ForecastReport["revisions"] = [];
  for (const m of months) {
    if (m.kind !== "forecast" || m.forecast === null) continue;
    const vs = verSet.filter((v) => get(v, "Forecast", m.bulan)?.has(TOTAL));
    if (vs.length < 2) continue;
    const prevV = vs[vs.length - 2];
    const prev = get(prevV, "Forecast", m.bulan)!.get(TOTAL)!;
    revisions.push({ bulan: m.bulan, now: m.forecast, prev, diff: m.forecast - prev, pct: pctOf(m.forecast, prev), prevVersi: prevV });
  }

  return { customer, customers, versions, months, selected, sel, nextMonth, parts, daily, dailyParts, stats, revisions };
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
