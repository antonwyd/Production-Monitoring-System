// Rencana Hari Ini (Perencanaan): alokasi orang & mesin pagi hari, estimasi hasil s/d jam tertentu, dan status per
// part x proses terhadap target. Logika murni (tanpa Sheet), dipakai browser, server, dan tes.
//
// Aturan bisnis:
//  - Seiretsu & Senbetsu = proses manual: kapasitas per ORANG = STKI x efisiensi x jam efektif.
//  - Drum PF & Bowl PF = proses mesin: kapasitas per MC = Std MC x efisiensi x jam MC jalan. Operator boleh pegang
//    beberapa MC (sampai batas per kategori); menambah orang/MC di luar batas tidak menambah kapasitas.
//  - MC hanya jalan bila ada operatornya. Satu MC tidak bisa dipegang dua orang di jam yang sama.
//  - Satu orang hanya punya satu penugasan aktif per waktu: penugasan berupa urutan segmen (mulai jam X), segmen
//    berikutnya otomatis mengakhiri segmen sebelumnya.
//  - Jam kerja: masuk 07:00, rutin awal 20 menit (5S, briefing, input laporan), istirahat 12:00-13:00,
//    normal 480 menit (s/d 16:00), lembur sesudahnya.
import { partKey } from "./overtime";

export type Step = "pf" | "seiretsu" | "senbetsu";
export const STEPS: Step[] = ["pf", "seiretsu", "senbetsu"];
export const STEP_NAME: Record<Step, string> = { pf: "PF", seiretsu: "Seiretsu", senbetsu: "Senbetsu" };
export type Status = "SAFE" | "WARNING" | "CRITICAL";
const RANK: Record<Status, number> = { SAFE: 0, WARNING: 1, CRITICAL: 2 };
export const worst = (a: Status, b: Status): Status => (RANK[b] > RANK[a] ? b : a);
/** Cadangan minimum supaya status SAFE (estimasi >= target x 1,1). */
export const SAFE_BUFFER = 0.1;

export type PCat = { name: string; step: Step; family: string; mc: boolean };
export type PPart = { id: string; category: string; name: string; type: string; rate: number; key: string; label: string };
export type PMachine = { category: string; mc: string; line: string; opts: string[] };
export type PMember = { name: string; nik: string };
export type PMaster = {
  cats: PCat[];
  parts: PPart[];
  machines: PMachine[];
  members: PMember[];
  normalMin: number;
  otLimitMin: number;
  /** Batas MC per operator per kategori mesin. */
  maxMc: Record<string, number>;
  /** Efisiensi perencanaan per kategori (0,5-1,1), dari achievement 30 hari atau setting Master Data. */
  eff: Record<string, number>;
};

/** Segmen penugasan: mulai `at` (menit sejak 00:00) sampai segmen berikutnya / akhir hari. */
export type Seg = { at: number; cat: string; part?: string; mcs?: string[] };
export type PPerson = { name: string; absent?: string; note?: string; segs: Seg[] };
export type PlanState = {
  date: string;
  /** Lembur (menit) untuk semua yang bekerja. */
  ot: number;
  /** Part yang dipasang di tiap MC: "Kategori|MC" -> id part ("" = belum diatur). */
  machines: Record<string, string>;
  /** Target hari ini per produk (kunci produk) per proses, pcs. */
  targets: Record<string, Partial<Record<Step, number>>>;
  people: PPerson[];
};

// ---------- Master ----------

export const typeKey = (t: string) => (t && t !== "-" ? t.trim().toUpperCase() : "");
export const norm = (s: string) => s.toUpperCase().replace(/\*KD/g, "").replace(/[\s\-_.]/g, "");
export const familyOf = (cat: string) => (/plastik/i.test(cat) ? "plastik" : /shield/i.test(cat) ? "shield" : "iron");
export function stepOf(cat: string, process: string): Step | null {
  const p = `${process} ${cat}`.toLowerCase();
  if (/seiretsu/.test(p)) return "seiretsu";
  if (/senbetsu/.test(p)) return "senbetsu";
  if (/\bpf\b|drum|bowl/.test(p)) return "pf";
  return null;
}
export const productKey = (cat: string, name: string, type: string) => `${familyOf(cat)}|${partKey(name)}|${typeKey(type)}`;
export const partLabel = (name: string, type: string) => (typeKey(type) ? `${name} ${typeKey(type)}` : name);
/** Nama tampilan: "625 -H*KD" (Drum PF) -> "625-H". */
export const cleanName = (n: string) => n.replace(/\s*\*KD/gi, "").replace(/\s+-/g, "-").trim();
export const mcKey = (cat: string, mc: string) => `${cat}|${mc}`;

export type RawMaster = {
  categories: { name: string; process: string }[];
  parts: { category: string; name: string; type: string; stki: number; stdMc: number }[];
  machines: { category: string; mc: string; line: string; main: string; alt: string }[];
  members: PMember[];
  normalMin: number;
  otLimitHrs: number;
  maxMc?: Record<string, number>;
  eff?: Record<string, number>;
};

/** Ubah daftar "627-J D1, 629-J D1" di tblMesin menjadi id part kategori itu. */
export function machineOpts(text: string, parts: PPart[]): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,;/]/)) {
    const k = norm(raw);
    if (!k) continue;
    const p = parts.find((x) => norm(x.name + typeKey(x.type)) === k) ?? parts.find((x) => norm(x.name) === k);
    if (p && !out.includes(p.id)) out.push(p.id);
  }
  return out;
}

export function buildMaster(r: RawMaster): PMaster {
  const cats: PCat[] = [];
  for (const c of r.categories) {
    const step = stepOf(c.name, c.process);
    if (step) cats.push({ name: c.name, step, family: familyOf(c.name), mc: step === "pf" });
  }
  const catSet = new Map(cats.map((c) => [c.name, c]));
  const parts: PPart[] = [];
  for (const p of r.parts) {
    const c = catSet.get(p.category);
    if (!c) continue;
    const rate = c.mc ? p.stdMc || p.stki : p.stki;
    parts.push({ id: `${p.category}|${p.name}|${p.type}`, category: p.category, name: p.name, type: p.type, rate, key: productKey(p.category, p.name, p.type), label: partLabel(cleanName(p.name), p.type) });
  }
  const machines: PMachine[] = r.machines
    .filter((m) => catSet.get(m.category)?.mc)
    .map((m) => {
      const own = parts.filter((p) => p.category === m.category);
      return { category: m.category, mc: m.mc, line: m.line, opts: machineOpts(`${m.main},${m.alt}`, own) };
    });
  const maxMc: Record<string, number> = {};
  const eff: Record<string, number> = {};
  for (const c of cats) {
    if (c.mc) maxMc[c.name] = Math.max(1, Math.round(r.maxMc?.[c.name] ?? 3));
    const e = r.eff?.[c.name];
    eff[c.name] = e && e > 0 ? Math.min(1.1, Math.max(0.5, e)) : 1;
  }
  return { cats, parts, machines, members: r.members, normalMin: r.normalMin || 480, otLimitMin: Math.round((r.otLimitHrs || 4) * 60), maxMc, eff };
}

// ---------- Jam kerja ----------

export const START = 7 * 60;
export const ROUTINE = 20;
export const BREAK_AT = 12 * 60;
export const BREAK_MIN = 60;
export const normalEnd = (m: Pick<PMaster, "normalMin">) => START + m.normalMin + BREAK_MIN;
export const dayEnd = (m: Pick<PMaster, "normalMin">, ot: number) => normalEnd(m) + Math.max(0, ot);

export function windows(m: Pick<PMaster, "normalMin">, ot: number): [number, number][] {
  const end = normalEnd(m);
  const w: [number, number][] = [
    [START + ROUTINE, BREAK_AT],
    [BREAK_AT + BREAK_MIN, end],
  ];
  if (ot > 0) w.push([end, end + ot]);
  return w;
}

/** Menit produktif di antara a dan b. */
export function prodBetween(m: Pick<PMaster, "normalMin">, ot: number, a: number, b: number): number {
  if (b <= a) return 0;
  return windows(m, ot).reduce((s, [x, y]) => s + Math.max(0, Math.min(y, b) - Math.max(x, a)), 0);
}

export const toMin = (hhmm: string) => {
  const [h, mm] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (mm || 0);
};
export const toClock = (min: number) => {
  const r = Math.round(min);
  return `${String(Math.floor(r / 60) % 24).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
};

// ---------- Hitung ----------

export type Issue = { level: "error" | "warn"; text: string; who?: string };
export type Row = {
  key: string;
  step: Step;
  label: string;
  /** Kategori yang mengerjakan (mis. PF Iron Cage + Drum PF). */
  cats: string[];
  people: string[];
  mcs: string[];
  /** pcs/jam susunan di akhir hari (per orang manual = STKI x eff). */
  rateEnd: number;
  /** pcs/jam satu orang (manual) atau satu MC (PF). */
  unit: number;
  est: number;
  estEnd: number;
  need: number;
  short: number;
  status: Status;
  /** Jam tambahan dengan susunan sekarang (lembur). */
  extraHours: number;
  /** Tambahan orang (manual) atau MC (PF) dari sekarang s/d akhir hari. */
  extraUnits: number;
  /** Orang yang bisa dilepas tanpa membuat target kurang (manual). */
  surplus: number;
  /** Estimasi s/d akhir hari bila lembur maksimal. */
  estMaxOt: number;
};
export type StepSum = { step: Step; status: Status; people: number; mcs: number; est: number; need: number; short: number; extraUnits: number; surplus: number };
export type Result = {
  rows: Row[];
  steps: StepSum[];
  issues: Issue[];
  present: number;
  absent: number;
  pool: string[];
  idleMcs: string[];
  end: number;
};

type Acc = { cats: Set<string>; people: Set<string>; mcs: Set<string>; est: number; estEnd: number; estMax: number; rateEnd: number; unit: number; label: string };

/** Segmen orang yang sudah dirapikan: urut, berakhir di segmen berikutnya. */
export function spans(p: PPerson, end: number): (Seg & { to: number })[] {
  const s = [...p.segs].sort((a, b) => a.at - b.at);
  return s.map((x, i) => ({ ...x, to: Math.min(end, i + 1 < s.length ? s[i + 1].at : end) })).filter((x) => x.to > x.at);
}

export function compute(m: PMaster, st: PlanState, at: number, now = START): Result {
  const end = dayEnd(m, st.ot);
  const maxEnd = dayEnd(m, m.otLimitMin);
  const T = Math.min(at, end);
  const catOf = new Map(m.cats.map((c) => [c.name, c]));
  const partOf = new Map(m.parts.map((p) => [p.id, p]));
  const mcOf = new Map(m.machines.map((x) => [mcKey(x.category, x.mc), x]));
  const issues: Issue[] = [];
  const acc = new Map<string, Acc>();
  const get = (key: string, step: Step, label: string, unit: number) => {
    const k = `${key}#${step}`;
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { cats: new Set(), people: new Set(), mcs: new Set(), est: 0, estEnd: 0, estMax: 0, rateEnd: 0, unit, label }));
    if (!a.unit) a.unit = unit;
    return a;
  };
  // Menit produktif sebuah interval s/d T, s/d akhir hari, dan s/d akhir lembur maksimal (bila segmen sampai akhir).
  const mins = (a: number, b: number, open: boolean) => ({
    t: prodBetween(m, st.ot, a, Math.min(b, T)),
    e: prodBetween(m, st.ot, a, b),
    x: prodBetween(m, m.otLimitMin, a, open ? maxEnd : b),
  });

  // Klaim MC per menit: siapa memegang MC kapan (untuk deteksi ganda & union jam jalan).
  const claims = new Map<string, { who: string; a: number; b: number; open: boolean }[]>();
  let present = 0;
  let absent = 0;
  const pool: string[] = [];

  for (const p of st.people) {
    if (p.absent) {
      absent++;
      if (p.segs.length) issues.push({ level: "warn", who: p.name, text: `${p.name} tidak masuk (${p.absent}), penugasannya tidak dihitung.` });
      continue;
    }
    present++;
    const sp = spans(p, end);
    if (!sp.some((x) => x.cat)) {
      pool.push(p.name);
      continue;
    }
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      const open = i === sp.length - 1;
      if (!s.cat) continue;
      const c = catOf.get(s.cat);
      if (!c) {
        issues.push({ level: "warn", who: p.name, text: `${p.name}: kategori ${s.cat} tidak dikenal.` });
        continue;
      }
      if (!c.mc) {
        const part = s.part ? partOf.get(s.part) : undefined;
        if (!part || part.category !== c.name) {
          issues.push({ level: "warn", who: p.name, text: `${p.name}: part belum dipilih di ${c.name} (${toClock(s.at)}).` });
          continue;
        }
        if (!part.rate) issues.push({ level: "warn", who: p.name, text: `${part.label} di ${c.name} belum ada STKI.` });
        const r = part.rate * (m.eff[c.name] ?? 1);
        const a = get(part.key, c.step, part.label, r);
        a.cats.add(c.name);
        a.people.add(p.name);
        const x = mins(s.at, s.to, open);
        a.est += (r * x.t) / 60;
        a.estEnd += (r * x.e) / 60;
        a.estMax += (r * x.x) / 60;
        if (open) a.rateEnd += r;
        continue;
      }
      const list = (s.mcs ?? []).filter((id) => mcOf.has(mcKey(c.name, id)));
      const limit = m.maxMc[c.name] ?? 3;
      if (list.length > limit)
        issues.push({ level: "error", who: p.name, text: `${p.name} memegang ${list.length} MC ${c.name}, batasnya ${limit}. ${list.length - limit} MC terakhir (${list.slice(limit).join(", ")}) tidak dihitung.` });
      if (!list.length) issues.push({ level: "warn", who: p.name, text: `${p.name}: belum memilih MC di ${c.name} (${toClock(s.at)}).` });
      for (const id of list.slice(0, limit)) {
        const k = mcKey(c.name, id);
        (claims.get(k) ?? claims.set(k, []).get(k)!).push({ who: p.name, a: s.at, b: s.to, open });
      }
    }
  }

  // MC: gabungan jam semua yang memegang (tidak dihitung dobel); bentrok dilaporkan.
  const idleMcs: string[] = [];
  for (const mc of m.machines) {
    const k = mcKey(mc.category, mc.mc);
    const cl = (claims.get(k) ?? []).sort((x, y) => x.a - y.a);
    if (!cl.length) {
      idleMcs.push(k);
      continue;
    }
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++)
        if (cl[j].a < cl[i].b && cl[i].who !== cl[j].who)
          issues.push({ level: "error", who: cl[j].who, text: `${mc.category} ${mc.mc} dipegang ${cl[i].who} dan ${cl[j].who} di jam yang sama (${toClock(Math.max(cl[i].a, cl[j].a))}–${toClock(Math.min(cl[i].b, cl[j].b))}).` });
    const partId = st.machines[k] ?? "";
    const part = partOf.get(partId);
    if (!part) {
      issues.push({ level: "warn", text: `${mc.category} ${mc.mc} dipegang ${cl[0].who} tapi part-nya belum diatur, tidak dihitung.` });
      continue;
    }
    if (mc.opts.length && !mc.opts.includes(partId)) issues.push({ level: "warn", text: `${mc.category} ${mc.mc}: ${part.label} bukan Part utama / Bisa ganti ke di Master Data.` });
    if (!part.rate) issues.push({ level: "warn", text: `${part.label} di ${mc.category} belum ada Std MC.` });
    // Union interval.
    const merged: { a: number; b: number; open: boolean }[] = [];
    for (const c of cl) {
      const last = merged[merged.length - 1];
      if (last && c.a <= last.b) {
        if (c.b >= last.b) last.open = c.open || (c.b === last.b && last.open);
        last.b = Math.max(last.b, c.b);
      } else merged.push({ a: c.a, b: c.b, open: c.open });
    }
    const r = part.rate * (m.eff[mc.category] ?? 1);
    const a = get(part.key, "pf", part.label, r);
    a.cats.add(mc.category);
    a.mcs.add(mc.mc);
    cl.forEach((c) => a.people.add(c.who));
    for (const g of merged) {
      const open = g.open && g.b >= end;
      const x = mins(g.a, g.b, open);
      a.est += (r * x.t) / 60;
      a.estEnd += (r * x.e) / 60;
      a.estMax += (r * x.x) / 60;
      if (open) a.rateEnd += r;
    }
  }

  // Baris: semua yang dikerjakan + semua target.
  for (const [key, need] of Object.entries(st.targets))
    for (const step of STEPS)
      if ((need[step] ?? 0) > 0) {
        const p = m.parts.find((x) => x.key === key && catOf.get(x.category)?.step === step) ?? m.parts.find((x) => x.key === key);
        get(key, step, p?.label ?? key.split("|").slice(1).join(" "), p && catOf.get(p.category)?.step === step ? p.rate * (m.eff[p.category] ?? 1) : 0);
      }
  const left = prodBetween(m, st.ot, Math.max(now, START), end) / 60;
  const rows: Row[] = [];
  for (const [k, a] of acc) {
    const [key, step] = k.split("#") as [string, Step];
    const need = Math.round(st.targets[key]?.[step] ?? 0);
    const est = Math.round(a.est);
    const estEnd = Math.round(a.estEnd);
    const estMax = Math.round(a.estMax);
    const short = Math.max(0, need - estEnd);
    let status: Status = "SAFE";
    if (need > 0) {
      if (estEnd < need) status = estMax >= need && a.rateEnd > 0 ? "WARNING" : "CRITICAL";
      else if (estEnd < need * (1 + SAFE_BUFFER)) status = "WARNING";
    }
    const extraHours = short && a.rateEnd ? short / a.rateEnd : 0;
    const extraUnits = short && a.unit && left > 0 ? Math.ceil(short / (a.unit * left)) : 0;
    let surplus = 0;
    if (step !== "pf" && need > 0 && a.unit > 0 && a.people.size > 1) {
      const perDay = a.unit * (prodBetween(m, st.ot, START, end) / 60);
      surplus = Math.max(0, Math.min(a.people.size - 1, Math.floor((estEnd - need * (1 + SAFE_BUFFER)) / perDay)));
    }
    rows.push({ key, step, label: a.label, cats: [...a.cats], people: [...a.people], mcs: [...a.mcs], rateEnd: a.rateEnd, unit: a.unit, est, estEnd, need, short, status, extraHours, extraUnits, surplus, estMaxOt: estMax });
  }
  rows.sort((x, y) => RANK[y.status] - RANK[x.status] || STEPS.indexOf(x.step) - STEPS.indexOf(y.step) || x.label.localeCompare(y.label));

  const steps: StepSum[] = STEPS.map((step) => {
    const rs = rows.filter((r) => r.step === step);
    const people = new Set(rs.flatMap((r) => r.people));
    return {
      step,
      status: rs.reduce<Status>((s, r) => worst(s, r.status), "SAFE"),
      people: people.size,
      mcs: rs.reduce((s, r) => s + r.mcs.length, 0),
      est: rs.reduce((s, r) => s + r.est, 0),
      need: rs.reduce((s, r) => s + r.need, 0),
      short: rs.reduce((s, r) => s + r.short, 0),
      extraUnits: rs.reduce((s, r) => s + r.extraUnits, 0),
      surplus: rs.reduce((s, r) => s + r.surplus, 0),
    };
  });
  return { rows, steps, issues, present, absent, pool, idleMcs, end };
}

// ---------- Ubah penugasan (satu pola: "mulai jam X kerjakan Y") ----------

/** Tugaskan orang mulai jam `at`: segmen sebelum `at` tetap, sesudahnya diganti. at <= 07:00 = ganti semua. */
export function assign(p: PPerson, seg: Seg): PPerson {
  const keep = seg.at <= START ? [] : p.segs.filter((s) => s.at < seg.at);
  return { ...p, segs: [...keep, { ...seg, at: Math.max(START, seg.at) }] };
}
/** Tugaskan orang hanya dari `seg.at` sampai `until`; sesudah `until` kembali ke tugas lamanya (atau cadangan). */
export function assignRange(p: PPerson, seg: Seg, until: number, end: number): PPerson {
  if (until >= end) return assign(p, seg);
  const old = spans(p, end).find((s) => s.at <= until && until < s.to);
  const pre = seg.at <= START ? [] : p.segs.filter((s) => s.at < seg.at);
  const post = p.segs.filter((s) => s.at > until);
  const back: Seg = old && old.cat ? { at: until, cat: old.cat, part: old.part, mcs: old.mcs } : { at: until, cat: "" };
  const clean = (x: Seg): Seg => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as Seg;
  return { ...p, segs: [...pre, { ...seg, at: Math.max(START, seg.at) }, clean(back), ...post] };
}

/** Naikkan lembur ke `ot`: orang lain tetap pulang di jam akhir lama (tidak ikut lembur otomatis). */
export function extendOt(m: Pick<PMaster, "normalMin">, st: PlanState, ot: number): PlanState {
  if (ot <= st.ot) return st;
  const oldEnd = dayEnd(m, st.ot);
  return {
    ...st,
    ot,
    people: st.people.map((p) => {
      const last = spans(p, oldEnd).at(-1);
      return last && last.cat ? { ...p, segs: [...p.segs, { at: oldEnd, cat: "" }] } : p;
    }),
  };
}

/** Lepas orang (cadangan) mulai jam `at`. */
export function release(p: PPerson, at: number): PPerson {
  if (at <= START) return { ...p, segs: [] };
  const keep = p.segs.filter((s) => s.at < at);
  return { ...p, segs: keep.length ? [...keep, { at, cat: "" }] : [] };
}

/** MC yang sedang dipegang orang lain pada jam `at` (untuk mencegah pilih ganda di layar). */
export function mcHolders(st: PlanState, m: PMaster, at: number, except?: string): Map<string, string> {
  const out = new Map<string, string>();
  const end = dayEnd(m, st.ot);
  for (const p of st.people) {
    if (p.absent || p.name === except) continue;
    for (const s of spans(p, end)) if (s.at <= at && at < s.to) for (const id of s.mcs ?? []) out.set(mcKey(s.cat, id), p.name);
  }
  return out;
}

// ---------- Saran ----------

export type Suggestion = { text: string; who: string; seg: Seg; row: string };

/**
 * Saran pindah untuk baris CRITICAL proses manual: ambil dulu dari cadangan, lalu dari baris lain (proses sama)
 * yang punya kelebihan orang. Mulai jam `from` (sekarang).
 */
export function suggest(m: PMaster, st: PlanState, res: Result, from: number): Suggestion[] {
  const out: Suggestion[] = [];
  const used = new Set<string>();
  const pool = [...res.pool];
  const donors = res.rows.filter((r) => r.surplus > 0).map((r) => ({ r, left: r.surplus }));
  const at = Math.max(START, Math.ceil(from / 30) * 30);
  for (const r of res.rows) {
    if (r.status !== "CRITICAL" || r.step === "pf") continue;
    const part = m.parts.find((p) => p.key === r.key && m.cats.find((c) => c.name === p.category)?.step === r.step);
    if (!part) continue;
    let need = r.extraUnits || 1;
    while (need > 0) {
      let who = pool.find((n) => !used.has(n));
      let txt = "dari cadangan";
      if (!who) {
        const d = donors.find((x) => x.left > 0 && x.r.step === r.step && x.r.key !== r.key);
        if (!d) break;
        who = d.r.people.find((n) => !used.has(n));
        if (!who) {
          d.left = 0;
          continue;
        }
        d.left--;
        txt = `dari ${STEP_NAME[d.r.step]} ${d.r.label} (lebih orang)`;
      }
      used.add(who);
      need--;
      out.push({ who, row: `${r.key}#${r.step}`, seg: { at, cat: part.category, part: part.id }, text: `${who} ${txt} → ${part.category} ${part.label} mulai ${toClock(at)}` });
    }
  }
  return out;
}

/** Ringkasan satu orang, mis. "07:00 Seiretsu Iron Cage 629-J D2 → 13:00 PF Iron Cage MC 18, MC 19". */
export function describe(m: PMaster, p: PPerson, end: number): string {
  if (p.absent) return `Tidak masuk (${p.absent})`;
  const sp = spans(p, end);
  if (!sp.some((x) => x.cat)) return "Cadangan";
  return sp
    .map((s) => {
      if (!s.cat) return `${toClock(s.at)} cadangan`;
      const what = s.mcs?.length ? s.mcs.join(", ") : (m.parts.find((x) => x.id === s.part)?.label ?? "part ?");
      return `${toClock(s.at)} ${s.cat} ${what}`;
    })
    .join(" → ");
}

/** Daftar type yang bisa diberi PO (satu baris per key produk), label terpendek. */
export function poTypes(m: Pick<PMaster, "parts" | "cats">): { key: string; label: string }[] {
  const ok = new Set(m.cats.map((c) => c.name));
  const out = new Map<string, string>();
  for (const p of m.parts) {
    if (!ok.has(p.category)) continue;
    const cur = out.get(p.key);
    if (!cur || p.label.length < cur.length) out.set(p.key, p.label);
  }
  return [...out].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, "id", { numeric: true }));
}

/**
 * Baca PO yang ditempel dari Excel/WA: satu baris = nama type + jumlah.
 * Contoh: "627-J D1   800.000", "GDD627*D1 J 800000", "629J D2\t300,000".
 * Cocok bila nomor part (tanpa digit lain di sebelahnya), huruf varian (J/H) dan type (D1/D2) ada di baris.
 */
export function parsePo(text: string, m: Pick<PMaster, "parts" | "cats">): { po: Record<string, number>; miss: string[] } {
  const types = poTypes(m).map((t) => {
    const mm = /^(\d+[A-Z]?)-?([A-Z])?\s*(D\d)?/i.exec(t.label.replace(/\s+-/g, "-")) ?? [];
    return { ...t, num: (mm[1] ?? "").toUpperCase(), suf: (mm[2] ?? "").toUpperCase(), typ: (mm[3] ?? "").toUpperCase() };
  });
  const po: Record<string, number> = {};
  const miss: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const q = /(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:pcs)?\s*$/i.exec(line);
    if (!q) {
      miss.push(line);
      continue;
    }
    const qty = Number(q[1].replace(/[.,]/g, ""));
    const head = line.slice(0, q.index).toUpperCase();
    const hit = types
      .filter((t) => t.num && new RegExp(`(?<!\\d)${t.num}(?![\\dA-Z]*\\d)`).test(head))
      .filter((t) => !t.typ || new RegExp(`${t.typ}(?!\\d)`).test(head.replace(/\s+/g, "")))
      .filter((t) => !t.suf || new RegExp(`${t.num}${t.suf}|${t.num}.*?(?<![A-Z])${t.suf}(?![A-Z0-9])`).test(head))
      .sort((a, b) => b.num.length - a.num.length || b.label.length - a.label.length);
    if (!hit.length || !qty) miss.push(line);
    else po[hit[0].key] = (po[hit[0].key] ?? 0) + qty;
  }
  return { po, miss };
}

export type Move = { name: string; from: { cat: string; part: string } | null; to: { cat: string; part: string }; gain: number };

/** Total kekurangan semua sel (type × proses) yang punya target, sampai jam T. */
/**
 * Alur PO (logika Anton 11 Nov): PF dan Seiretsu sama-sama sortir, hasil keduanya DIJUMLAH untuk memenuhi PO.
 * Senbetsu (cek akhir) memeriksa semua hasil sortir, jadi juga harus = PO, dan tidak bisa melebihi hasil sortir.
 */
export type Flow = { key: string; po: number; pf: number; sei: number; sortir: number; sen: number; final: number; gapSortir: number; gapSen: number; gap: number; status: Status };
export const poOf = (st: Pick<PlanState, "targets">): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(st.targets)) {
    const q = Math.max(0, ...Object.values(v).map((x) => x ?? 0));
    if (q > 0) o[k] = q;
  }
  return o;
};
export function poFlow(res: Pick<Result, "rows">, po: Record<string, number>): Map<string, Flow> {
  const est = (key: string, step: Step) => res.rows.find((r) => r.key === key && r.step === step)?.est ?? 0;
  const out = new Map<string, Flow>();
  for (const [key, q] of Object.entries(po)) {
    const pf = est(key, "pf");
    const sei = est(key, "seiretsu");
    const sortir = pf + sei;
    const sen = est(key, "senbetsu");
    const final = Math.min(sen, sortir);
    const status: Status = final >= q * (1 + SAFE_BUFFER) ? "SAFE" : final >= q ? "WARNING" : "CRITICAL";
    out.set(key, { key, po: q, pf, sei, sortir, sen, final, gapSortir: Math.max(0, q - sortir), gapSen: Math.max(0, q - sen), gap: Math.max(0, q - final), status });
  }
  return out;
}
const flowCost = (f: Flow) => f.gapSortir + f.gap;

/** Total kekurangan semua PO (sortir + hasil akhir) sampai jam T. */
export function shortfall(m: PMaster, st: PlanState, T: number, now = START): number {
  let t = 0;
  for (const f of poFlow(compute(m, st, T, now), poOf(st)).values()) t += flowCost(f);
  return t;
}

/**
 * Usulan "Seimbangkan": pindahkan orang (proses manual, bukan operator MC) mulai jam `at`
 * ke sel yang kurang, hanya bila total kekurangan semua sel turun. Rakus: sel paling kurang dulu.
 */
export function balance(m: PMaster, st: PlanState, at: number, T: number, now = START, maxMoves = 20): Move[] {
  const catOf = new Map(m.cats.map((c) => [c.name, c]));
  const end = dayEnd(m, st.ot);
  const nowSeg = (p: PPerson) => spans(p, end).find((s) => s.at <= at && at < s.to);
  const po = poOf(st);
  const manualPart = (key: string, step: Step) => m.parts.find((p) => p.key === key && catOf.get(p.category)?.step === step && !catOf.get(p.category)?.mc);
  const moves: Move[] = [];
  const stuck = new Set<string>();
  let cur = st;
  let flows = poFlow(compute(m, cur, T, now), po);
  let obj = [...flows.values()].reduce((a, f) => a + flowCost(f), 0);
  for (let guard = 0; moves.length < maxMoves && obj > 0 && guard < 80; guard++) {
    // Sel tujuan: sortir kurang -> Seiretsu type itu; sortir cukup tapi cek akhir kurang -> Senbetsu.
    const cells = [...flows.values()]
      .flatMap((f) => {
        const out: { key: string; step: Step; gap: number }[] = [];
        if (f.gapSortir > 0) out.push({ key: f.key, step: "seiretsu", gap: f.gapSortir });
        if (f.gapSen > 0 && f.sen < f.sortir) out.push({ key: f.key, step: "senbetsu", gap: f.gapSen });
        return out;
      })
      .filter((c) => !stuck.has(`${c.key}#${c.step}`) && manualPart(c.key, c.step))
      .sort((a, b) => b.gap - a.gap);
    if (!cells.length) break;
    const cell = cells[0];
    const part = manualPart(cell.key, cell.step)!;
    let best: { st: PlanState; obj: number; flows: Map<string, Flow>; move: Move } | null = null;
    // Yang belum bekerja dicoba dulu, jadi dipilih bila hasilnya sama.
    const order = [...cur.people].sort((a, b) => Number(!!nowSeg(a)?.cat) - Number(!!nowSeg(b)?.cat));
    for (const p of order) {
      if (p.absent || moves.some((x) => x.name === p.name)) continue; // satu orang dipindah sekali saja
      const s = nowSeg(p);
      if (s?.cat && (catOf.get(s.cat)?.mc ?? true)) continue; // operator MC / kategori lain tidak dipindah
      if (s?.cat === part.category && s.part === part.id) continue;
      const next = { ...cur, people: cur.people.map((x) => (x.name === p.name ? assign(x, { at, cat: part.category, part: part.id }) : x)) };
      const nf = poFlow(compute(m, next, T, now), po);
      const o = [...nf.values()].reduce((a, f) => a + flowCost(f), 0);
      // Type asal tidak boleh jadi lebih kurang (hanya ambil dari yang lebih / tanpa PO).
      const srcKey = s?.part ? m.parts.find((x) => x.id === s.part)?.key : undefined;
      if (srcKey && srcKey !== cell.key && flows.get(srcKey) && flowCost(nf.get(srcKey)!) > flowCost(flows.get(srcKey)!)) continue;
      if (o < obj - 1 && (!best || o < best.obj))
        best = { st: next, obj: o, flows: nf, move: { name: p.name, from: s?.cat ? { cat: s.cat, part: s.part ?? "" } : null, to: { cat: part.category, part: part.id }, gain: Math.round(obj - o) } };
    }
    if (!best) {
      stuck.add(`${cell.key}#${cell.step}`);
      continue;
    }
    moves.push(best.move);
    cur = best.st;
    obj = best.obj;
    flows = best.flows;
  }
  return moves;
}
