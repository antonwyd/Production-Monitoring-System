// Rencana Lembur: dari PO per type dihitung kebutuhan jam PF, Seiretsu, Senbetsu, member, dan lembur.
// Urutan: PO dikerjakan di PF dulu (mesin, Std MC). Yang tidak terkejar di PF sampai jam target pindah ke
// Seiretsu (manual, STKI). Senbetsu (opsional) dihitung untuk semua qty PO. Logika murni, dipakai browser & tes.

export type Family = { key: string; name: string; pf?: string; seiretsu?: string; senbetsu?: string };

/** Kelompok part: kategori PF, Seiretsu, dan Senbetsu yang mengerjakan part yang sama. */
export const FAMILIES: Family[] = [
  { key: "iron", name: "Iron Cage", pf: "PF Iron Cage", seiretsu: "Seiretsu Iron Cage", senbetsu: "Senbetsu Iron Cage" },
  { key: "plastik", name: "Plastik Cage", pf: "PF Plastik", seiretsu: "Seiretsu Plastik Cage", senbetsu: "Senbetsu Plastik Cage" },
  { key: "shield", name: "Shield Cage", senbetsu: "Senbetsu Shield Cage" },
];

export type Step = "pf" | "seiretsu" | "senbetsu";
export const STEPS: Step[] = ["pf", "seiretsu", "senbetsu"];
export const STEP_NAME: Record<Step, string> = { pf: "PF", seiretsu: "Seiretsu", senbetsu: "Senbetsu" };

/** Part yang bisa dipilih di PO. rate = pcs/jam per mesin (PF, Std MC) atau per orang (STKI). */
export type Product = { key: string; family: string; name: string; type: string; rate: Partial<Record<Step, number>> };

export type PlanMasterPart = { category: string; name: string; type: string; stki: number; stdMc: number };
export type PlanMaster = {
  parts: PlanMasterPart[];
  /** Jumlah mesin aktif per kategori PF. */
  machines: Record<string, number>;
  normalMin: number;
  otLimitHrs: number;
  /** Rata-rata member/mesin per hari 2 minggu terakhir per kategori (saran awal). */
  recent: Record<string, number>;
};

/** Nama part di kategori berbeda kadang ditulis beda ("608 T1X PF" = "608T1X", "625 -H*KD" = "625-H"). */
export function partKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/\*KD/g, "")
    .replace(/[\s\-_.]/g, "")
    .replace(/PF$/, "")
    .replace(/^S(?=\d)/, "");
}

const typeKey = (t: string) => (t && t !== "-" ? t.trim().toUpperCase() : "");

export function buildProducts(m: PlanMaster): Product[] {
  const out = new Map<string, Product>();
  for (const f of FAMILIES)
    for (const step of STEPS) {
      const cat = f[step];
      if (!cat) continue;
      for (const p of m.parts.filter((x) => x.category === cat)) {
        const key = `${f.key}|${partKey(p.name)}|${typeKey(p.type)}`;
        const rate = step === "pf" ? p.stdMc || p.stki : p.stki;
        const cur = out.get(key) ?? { key, family: f.key, name: p.name, type: typeKey(p.type), rate: {} };
        // Nama yang tampil diambil dari Seiretsu/Senbetsu (penulisan paling bersih), PF hanya bila tidak ada.
        if (step !== "pf" && out.has(key) && !cur.rate.seiretsu && !cur.rate.senbetsu) cur.name = p.name;
        if (rate > 0) cur.rate[step] = rate;
        out.set(key, cur);
      }
    }
  return [...out.values()].sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
}

export const productLabel = (p: { name: string; type: string }) => (p.type ? `${p.name} ${p.type}` : p.name);

/** Cari part dari teks tempelan Excel ("627-J", "D1"). Iron didahulukan bila nama sama di dua kelompok. */
export function findProduct(products: Product[], name: string, type: string): Product | undefined {
  const k = partKey(name);
  const t = typeKey(type);
  const same = products.filter((p) => partKey(p.name) === k || p.key.split("|")[1] === k);
  return same.find((p) => p.type === t) ?? (t ? undefined : same.length === 1 ? same[0] : undefined);
}

const isNum = (c: string) => /^\d[\d.,]*$/.test(c);
const numOf = (c: string) => Number(c.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;

/**
 * Kode part customer di file PO: "GDD627*D1  J" = 627-J D1, "GDD625-H-*D2  J" = 625-H D2,
 * "GDD629*D2-NC  J" = 629-J NC D2, plastik "GD 6900T1X-DF  J" = 6900T1X.
 * Huruf di akhir (J) ditambahkan ke Iron bila nama belum berakhiran -H/-J.
 */
export function fromPoCode(text: string): { name: string; type: string } | null {
  const t = text.trim();
  const m = t.match(/^GDD\s*(.+?)\*\s*(D\d)(-NC)?(?:\s+([A-Z]))?$/i);
  if (m) {
    let name = m[1].trim().replace(/-+$/, "");
    if (m[4] && !/-[A-Z]$/i.test(name)) name += `-${m[4].toUpperCase()}`;
    if (m[3]) name += " NC";
    return { name, type: m[2].toUpperCase() };
  }
  const p = t.match(/^GD\s+(\S+?)(?:-DF)?(?:\s+[A-Z])?$/i);
  return p ? { name: p[1], type: "" } : null;
}

const BULAN_PO: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };

/** "29-Oct", "29 Okt", "29/10" -> "10-29" (bulan-tanggal), selain itu null. */
function headerDate(c: string): string | null {
  const m = c.trim().match(/^(\d{1,2})[-\s/.]([A-Za-z]{3})[a-z]*\.?$/) ?? null;
  const n = c.trim().match(/^(\d{1,2})[/.-](\d{1,2})$/);
  const mon = m ? BULAN_PO[m[2].toLowerCase()] : n ? Number(n[2]) : 0;
  const day = Number((m ?? n)?.[1] ?? 0);
  if (!mon || mon > 12 || !day || day > 31) return null;
  return `${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type PoPaste = {
  rows: { name: string; type: string; qtys: number[]; raw: string; /** kolom (indeks sel) qty pertama */ col: number }[];
  /** Tanggal per kolom dari baris judul ("29-Oct"), format "MM-DD"; kosong bila tidak ada judul tanggal. */
  colDates: (string | null)[];
};

/**
 * Baca tempelan dari Excel/WhatsApp: tiap baris "Part  Type  Qty [Qty2 Qty3 ...]" (Tab, ;, atau spasi).
 * Beberapa qty = qty per tanggal berurutan. Type boleh kosong atau ikut di nama ("627-J D1").
 * Bila ada baris judul berisi tanggal (29-Oct 30-Oct), qty dipasangkan ke tanggal kolomnya.
 */
export function parsePo(text: string): PoPaste {
  const rows: PoPaste["rows"] = [];
  let colDates: (string | null)[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const tabbed = raw.includes("\t") || raw.includes(";");
    const cells = (tabbed ? raw.replace(/\s+$/, "").split(/[\t;]/) : raw.trim().split(/\s+/)).map((c) => c.trim());
    const dates = cells.map(headerDate);
    if (dates.filter(Boolean).length >= 1 && !cells.some((c) => isNum(c) && !headerDate(c))) {
      colDates = dates;
      continue;
    }
    let end = cells.length;
    while (end > 1 && (isNum(cells[end - 1]) || cells[end - 1] === "")) end--;
    const qtys = cells.slice(end).map((c) => (c === "" ? 0 : Math.round(numOf(c))));
    const head = cells.slice(0, end).filter(Boolean);
    if (tabbed && head.length >= 3 && isNum(head[0])) head.shift(); // kolom "No"
    if (!head.length || !qtys.some((q) => q > 0)) continue;
    let type = head.length > 1 && /^(D\d|-)$/i.test(head[head.length - 1]) ? head.pop()! : "";
    let name = head.join(" ");
    const code = fromPoCode(name);
    if (code) ({ name, type } = code);
    const m = !type && name.match(/^(.*\S)\s+(D\d)$/i);
    if (m) [name, type] = [m[1], m[2]];
    rows.push({ name: name.trim(), type, qtys, raw: raw.trim(), col: end });
  }
  return { rows, colDates };
}

/** Versi sederhana tanpa info kolom (untuk tes & tempelan satu tanggal). */
export const parsePoText = (text: string) => parsePo(text).rows.map(({ name, type, qtys, raw }) => ({ name, type, qtys, raw }));

/** Tanggal "YYYY-MM-DD" untuk qty ke-i satu baris: dari judul kolom bila ada, selain itu berurutan mulai `first`. */
export function poDateOf(p: PoPaste, row: PoPaste["rows"][number], i: number, year: number, fallback: (i: number) => string | undefined): string | undefined {
  if (p.colDates.some(Boolean)) {
    const md = p.colDates[row.col + i];
    return md ? `${year}-${md}` : undefined;
  }
  return fallback(i);
}

// ---------- Jam kerja ----------

export type Schedule = {
  /** Jam masuk, istirahat, dalam menit sejak 00:00. */
  start: number;
  breakAt: number;
  breakMin: number;
  /** Menit rutin awal hari yang tidak produktif (5S, briefing, input laporan). */
  routineMin: number;
  /** Jam kerja normal per hari (Master Data, 480). */
  normalMin: number;
  /** Batas lembur per orang per hari (menit). */
  otMaxMin: number;
  /** Hari pertama baru mulai dikerjakan jam ini (mis. 13:00 = sisa waktu sore ini). 0 = dari jam masuk. */
  firstFrom?: number;
};

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toClock = (min: number) => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const normalEnd = (s: Schedule) => s.start + s.normalMin + s.breakMin;

/** Jendela kerja produktif satu hari; hari ke-0 dipotong mulai `firstFrom`. */
function windows(s: Schedule, otMin: number, day = 1): [number, number][] {
  const end = normalEnd(s);
  const from = s.start + s.routineMin;
  const w: [number, number][] = [];
  if (s.breakMin > 0 && s.breakAt > from && s.breakAt < end) w.push([from, s.breakAt], [s.breakAt + s.breakMin, end]);
  else w.push([from, end]);
  if (otMin > 0) w.push([end, end + otMin]);
  const cut = day === 0 ? (s.firstFrom ?? 0) : 0;
  return w.map(([x, y]) => [Math.min(y, Math.max(x, cut)), y]);
}

const total = (w: [number, number][]) => w.reduce((a, [x, y]) => a + Math.max(0, y - x), 0);

/** Menit produktif normal per hari penuh. */
export const normalProd = (s: Schedule) => total(windows(s, 0));

/** Menit produktif hari ke-d (normal + lembur). */
export const dayProd = (s: Schedule, d: number, otMin = 0) => total(windows(s, otMin, d));

/** Menit produktif dari awal hari ke-d sampai jam tertentu (tanpa lembur). */
export function prodBefore(s: Schedule, clock: number, day = 1): number {
  return windows(s, 0, day).reduce((a, [x, y]) => a + Math.max(0, Math.min(y, clock) - x), 0);
}

/** Jam ketika `prod` menit produktif tercapai pada hari ke-d (termasuk lembur `otMin`). */
export function clockAt(s: Schedule, prod: number, otMin: number, day = 1): number {
  let left = prod;
  const w = windows(s, otMin, day).filter(([x, y]) => y > x);
  for (const [x, y] of w) {
    if (left <= y - x) return x + left;
    left -= y - x;
  }
  return w.length ? w[w.length - 1][1] : normalEnd(s);
}

export type Finish = { done: true; day: number; clock: number; ot: boolean } | { done: false; leftMin: number };

/** Kerjakan `perUnit` menit per orang/mesin mulai hari 0, dengan lembur ot[d] menit per hari. */
export function runSchedule(s: Schedule, perUnit: number, days: number, ot: number[] = []): Finish {
  let left = perUnit;
  if (left <= 0) return { done: true, day: 0, clock: Math.max(s.start + s.routineMin, s.firstFrom ?? 0), ot: false };
  for (let d = 0; d < days; d++) {
    const o = ot[d] ?? 0;
    const np = dayProd(s, d);
    if (left <= np + o) return { done: true, day: d, clock: clockAt(s, left, o, d), ot: left > np };
    left -= np + o;
  }
  return { done: false, leftMin: left };
}

// ---------- Rencana ----------

export type StationKey = `${string}:${Step}`;
export type StationSet = {
  /** Orang (Seiretsu/Senbetsu) atau mesin (PF). null = otomatis (minimum agar tiap tanggal selesai sebelum target). */
  units: number | null;
  /** PF saja: member operator PF. */
  members?: number;
  /** PF saja: lembur mesin PF per hari (menit). */
  otMin?: number;
};

/** Satu part/type di PO, qty per tanggal kirim (YYYY-MM-DD). */
export type PoLine = { key: string; qty: Record<string, number> };

export type PlanInput = {
  /** Tanggal hari kerja periode ini (sudah tanpa hari libur). PO jatuh tempo jam `target` di tanggalnya. */
  dates: string[];
  target: number;
  schedule: Schedule;
  pool: number;
  senbetsu: boolean;
  lines: PoLine[];
  stations: Record<string, StationSet>;
};

export type DueRow = { date: string; qty: number; finish: Finish; ok: boolean };

export type StationResult = {
  key: string;
  family: Family;
  step: Step;
  category: string;
  unit: "mesin" | "orang";
  qty: number;
  /** Beban total dalam jam-orang / jam-mesin. */
  loadHrs: number;
  units: number;
  auto: boolean;
  maxUnits: number | null;
  /** Menit kerja per orang/mesin dengan setting sekarang. */
  perUnitMin: number;
  /** Minimal orang/mesin agar semua tanggal selesai sebelum target tanpa lembur / dengan lembur maksimal. */
  needNoOt: number;
  needWithOt: number | null;
  /** penuh = PF terpakai sampai target, sisa PO pindah ke Seiretsu. */
  status: "kosong" | "aman" | "lembur" | "kurang" | "penuh";
  /** Lembur per orang/mesin per hari (menit) pada hari ke-0..otDays-1. */
  otPerDay: number;
  otDays: number;
  /** Total jam lembur (orang/mesin x jam). */
  otHrs: number;
  /** Selesai semua pekerjaan dengan setting sekarang. */
  finish: Finish;
  perDate: DueRow[];
  /** PF: persen PO yang terkejar di PF. */
  pfShare?: number;
  members: number;
  missingRate: string[];
};

export type LineResult = {
  key: string;
  product: Product | undefined;
  qty: number;
  pfQty: number;
  restQty: number;
  hrs: Partial<Record<Step, number>>;
};

export type PlanResult = {
  stations: StationResult[];
  lines: LineResult[];
  totalQty: number;
  pfQty: number;
  restQty: number;
  usedMembers: number;
  freeMembers: number;
  otHrs: number;
  status: "aman" | "lembur" | "kurang";
};

const ceil30 = (m: number) => Math.ceil(m / 30 - 1e-9) * 30;
const EPS = 1e-6;

/** Kalkulasi waktu satu periode: kapasitas kumulatif per orang/mesin sampai jam target tiap tanggal. */
function clock(input: PlanInput) {
  const s = input.schedule;
  const n = Math.max(1, input.dates.length);
  /** Menit tersedia per unit dari awal periode sampai target hari d, dengan lembur ot[k] di hari k < d. */
  const cumAvail = (d: number, ot: number[]) => {
    let a = prodBefore(s, input.target, d);
    for (let k = 0; k < d; k++) a += dayProd(s, k) + (ot[k] ?? 0);
    return a;
  };
  const otArr = (per: number, days: number) => Array.from({ length: n }, (_, k) => (k < days ? per : 0));
  return { s, n, cumAvail, otArr };
}

type Clock = ReturnType<typeof clock>;

/** Orang/mesin minimal supaya beban kumulatif tiap tanggal selesai sebelum target. */
function needUnits(c: Clock, cum: number[], ot: number[]) {
  let need = 0;
  cum.forEach((l, d) => l > EPS && (need = Math.max(need, Math.ceil(l / c.cumAvail(d, ot) - 1e-9))));
  return need;
}

function dueRows(c: Clock, input: PlanInput, qty: number[], cum: number[], units: number, ot: number[]): DueRow[] {
  const rows: DueRow[] = [];
  cum.forEach((l, d) => {
    if (qty[d] <= 0) return;
    const finish = units > 0 ? runSchedule(c.s, l / units, c.n + 30, ot) : ({ done: false, leftMin: Infinity } as Finish);
    const ok = finish.done && (finish.day < d || (finish.day === d && finish.clock <= input.target + 0.5));
    rows.push({ date: input.dates[d], qty: qty[d], finish, ok });
  });
  return rows;
}

const cumsum = (a: number[]) => a.reduce<number[]>((o, x, i) => (o.push((o[i - 1] ?? 0) + x), o), []);
const lastIdx = (a: number[]) => a.reduce((m, x, i) => (x > EPS ? i : m), -1);

export function computePlan(input: PlanInput, products: Product[], m: PlanMaster): PlanResult {
  const c = clock(input);
  const { s, n } = c;
  const byKey = new Map(products.map((p) => [p.key, p]));
  const qtyAt = (l: PoLine) => input.dates.map((d) => Math.max(0, Math.round(Number(l.qty[d]) || 0)));
  const lines = input.lines.map((l) => ({ src: l, q: qtyAt(l), pf: input.dates.map(() => 0), res: { key: l.key, product: byKey.get(l.key), qty: 0, pfQty: 0, restQty: 0, hrs: {} } as LineResult }));
  for (const l of lines) l.res.qty = l.q.reduce((a, x) => a + x, 0);
  const stations: StationResult[] = [];

  for (const f of FAMILIES) {
    const fl = lines.filter((l) => l.res.product?.family === f.key && l.res.qty > 0);
    if (!fl.length) continue;

    // 1) PF: isi mesin dari tanggal paling awal; yang tidak terkejar sampai jam target tanggal itu pindah ke Seiretsu.
    if (f.pf) {
      const key = `${f.key}:pf`;
      const set = input.stations[key] ?? { units: null };
      const maxUnits = m.machines[f.pf] ?? null;
      const pl = fl.filter((l) => l.res.product!.rate.pf);
      const rate = (l: (typeof fl)[number]) => l.res.product!.rate.pf!;
      const demand = input.dates.map((_, d) => pl.reduce((a, l) => a + (l.q[d] / rate(l)) * 60, 0));
      const last = lastIdx(demand);
      const otMin = Math.min(s.otMaxMin, Math.max(0, set.otMin ?? 0));
      const ot = c.otArr(otMin, Math.max(0, last));
      const needNoOt = needUnits(c, cumsum(demand), c.otArr(0, 0));
      const auto = set.units == null;
      const units = auto ? Math.min(needNoOt, maxUnits ?? needNoOt) : Math.max(0, Math.round(set.units!));
      let doneCum = 0;
      const done = demand.map((dm, d) => {
        const take = Math.max(0, Math.min(dm, units * c.cumAvail(d, ot) - doneCum));
        doneCum += take;
        const share = dm > 0 ? take / dm : 0;
        for (const l of pl) l.pf[d] = Math.round(l.q[d] * share);
        return take;
      });
      for (const l of pl) {
        l.res.pfQty = l.pf.reduce((a, x) => a + x, 0);
        l.res.hrs.pf = l.res.pfQty / rate(l);
      }
      const total = demand.reduce((a, x) => a + x, 0);
      const doneLoad = done.reduce((a, x) => a + x, 0);
      const cum = cumsum(done);
      const pfQtyD = input.dates.map((_, d) => pl.reduce((a, l) => a + l.pf[d], 0));
      const fitsNoOt = units > 0 && cum.every((l, d) => l <= units * c.cumAvail(d, c.otArr(0, 0)) + EPS);
      const status: StationResult["status"] = !pl.length || !units ? "kosong" : doneLoad < total - EPS ? "penuh" : fitsNoOt ? "aman" : "lembur";
      const usedOt = status === "aman" || status === "kosong" ? 0 : otMin;
      const otDays = usedOt ? Math.max(0, last) : 0;
      stations.push({
        key,
        family: f,
        step: "pf",
        category: f.pf,
        unit: "mesin",
        qty: pfQtyD.reduce((a, x) => a + x, 0),
        loadHrs: doneLoad / 60,
        units,
        auto,
        maxUnits,
        perUnitMin: units ? doneLoad / units : 0,
        needNoOt,
        needWithOt: n > 1 ? needUnits(c, cumsum(demand), c.otArr(s.otMaxMin, Math.max(0, last))) : null,
        status,
        otPerDay: usedOt,
        otDays,
        otHrs: (usedOt * otDays * units) / 60,
        finish: units ? runSchedule(s, doneLoad / units, n + 30, ot) : { done: false, leftMin: Infinity },
        perDate: dueRows(c, input, pfQtyD, cum, units, ot),
        pfShare: total > 0 ? doneLoad / total : 0,
        members: Math.max(0, Math.round(set.members ?? 0)),
        missingRate: fl.filter((l) => !l.res.product!.rate.pf).map((l) => productLabel(l.res.product!)),
      });
    }
    for (const l of fl) l.res.restQty = l.res.qty - l.res.pfQty;

    // 2) Seiretsu: sisa PF per tanggal. 3) Senbetsu: semua qty PO (bila dipakai).
    for (const step of ["seiretsu", "senbetsu"] as const) {
      const cat = f[step];
      if (!cat || (step === "senbetsu" && !input.senbetsu)) continue;
      const qd = (l: (typeof fl)[number], d: number) => (step === "seiretsu" ? l.q[d] - l.pf[d] : l.q[d]);
      const qtyD = input.dates.map((_, d) => fl.reduce((a, l) => a + qd(l, d), 0));
      if (step === "seiretsu" && !qtyD.some((x) => x > 0)) continue;
      const key = `${f.key}:${step}`;
      const set = input.stations[key] ?? { units: null };
      const rated = fl.filter((l) => l.res.product!.rate[step]);
      const demand = input.dates.map((_, d) => rated.reduce((a, l) => a + (qd(l, d) / l.res.product!.rate[step]!) * 60, 0));
      for (const l of rated) l.res.hrs[step] = input.dates.reduce((a, _, d) => a + qd(l, d), 0) / l.res.product!.rate[step]!;
      const cum = cumsum(demand);
      const load = cum[cum.length - 1] ?? 0;
      const last = lastIdx(demand);
      const needNoOt = needUnits(c, cum, c.otArr(0, 0));
      const auto = set.units == null;
      const units = auto ? needNoOt : Math.max(0, Math.round(set.units!));
      // Lembur rata per hari (kelipatan 30 menit) pada hari sebelum tanggal PO terakhir.
      let otPer = 0;
      let ok = units > 0 || load <= EPS;
      if (units > 0)
        cum.forEach((l, d) => {
          const short = l / units - c.cumAvail(d, c.otArr(0, 0));
          if (short <= EPS || demand.slice(0, d + 1).every((x) => x <= EPS)) return;
          if (d === 0) ok = false;
          else otPer = Math.max(otPer, ceil30(short / d));
        });
      if (otPer > s.otMaxMin) ok = false;
      otPer = Math.min(otPer, s.otMaxMin);
      if (!ok && units > 0) otPer = last > 0 ? s.otMaxMin : 0;
      const otDays = otPer ? Math.max(0, last) : 0;
      const ot = c.otArr(otPer, otDays);
      stations.push({
        key,
        family: f,
        step,
        category: cat,
        unit: "orang",
        qty: qtyD.reduce((a, x) => a + x, 0),
        loadHrs: load / 60,
        units,
        auto,
        maxUnits: null,
        perUnitMin: units ? load / units : 0,
        needNoOt,
        needWithOt: n > 1 ? needUnits(c, cum, c.otArr(s.otMaxMin, Math.max(0, last))) : null,
        status: load <= EPS ? "kosong" : !ok ? "kurang" : otPer ? "lembur" : "aman",
        otPerDay: otPer,
        otDays,
        otHrs: (otPer * otDays * units) / 60,
        finish: units ? runSchedule(s, load / units, n + 30, ot) : { done: false, leftMin: Infinity },
        perDate: dueRows(c, input, qtyD, cum, units, ot),
        members: units,
        missingRate: fl.filter((l) => !l.res.product!.rate[step] && input.dates.some((_, d) => qd(l, d) > 0)).map((l) => productLabel(l.res.product!)),
      });
    }
  }

  const res = lines.map((l) => l.res);
  const usedMembers = stations.reduce((a, x) => a + x.members, 0);
  const otHrs = stations.reduce((a, x) => a + x.otHrs, 0);
  const bad =
    res.some((l) => !l.product && l.qty > 0) ||
    stations.some((x) => x.step !== "pf" && (x.status === "kurang" || x.missingRate.length > 0)) ||
    stations.some((x) => x.step === "pf" && x.status === "penuh" && !stations.some((y) => y.family === x.family && y.step === "seiretsu"));
  return {
    stations,
    lines: res,
    totalQty: res.reduce((a, l) => a + l.qty, 0),
    pfQty: res.reduce((a, l) => a + l.pfQty, 0),
    restQty: res.reduce((a, l) => a + l.restQty, 0),
    usedMembers,
    freeMembers: input.pool - usedMembers,
    otHrs,
    status: bad ? "kurang" : otHrs > 0 ? "lembur" : "aman",
  };
}

// ---------- Tanggal ----------

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** n hari kerja mulai `start` (Minggu selalu libur, Sabtu libur kecuali `sat`). */
export function workDates(start: string, n: number, sat: boolean): string[] {
  const out: string[] = [];
  const t = new Date(`${start}T00:00:00Z`);
  for (let guard = 0; out.length < n && guard < 60; guard++) {
    const w = t.getUTCDay();
    if (w !== 0 && (sat || w !== 6)) out.push(t.toISOString().slice(0, 10));
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

export const dayName = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return `${HARI[t.getUTCDay()]} ${t.getUTCDate()} ${BLN[t.getUTCMonth()]}`;
};

/** "Rab 30 Okt 13:40" atau "lewat periode" untuk hari ke-d (bisa melewati periode). */
export function finishText(f: Finish, dates: string[], sat: boolean): string {
  if (!f.done) return "tidak selesai";
  const d = f.day < dates.length ? dates[f.day] : workDates(dates[dates.length - 1], f.day - dates.length + 2, sat)[f.day - dates.length + 1];
  return `${dayName(d)} ${toClock(f.clock)}`;
}
