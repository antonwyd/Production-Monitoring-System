// Data untuk dua halaman utama web: "Hari Ini" (leader) dan "Laporan" (kepala produksi).
// Semua angka dihitung dari baris yang sudah disetujui leader, sama seperti report lain.
import { callBackend, openRejections, type RawSubmission } from "./backend";
import { addDays, formatDateId, monthEnd, monthStart, nowJakarta } from "./dates";
import {
  add,
  aggCols,
  emptyAgg,
  groupBy,
  lostSplit,
  loadFacts,
  ngLabeler,
  type Fact,
  type Kpi,
  type LostFact,
  type Report,
  type Row,
  ngMax,
  ngMaxText,
  ppm,
  vsTarget,
} from "./reports";
import { achievement, grade, ngRate } from "./rules";
import { loadMaster } from "./service";
import { isQaMember, type MasterData, type Settings } from "./types";

export type Trend = { text: string; good: boolean } | null;
export type Tile = { label: string; value: string; sub: string; trend: Trend; target?: string; status?: "good" | "bad" };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const p2 = (v: number | null) => (v == null ? "-" : `${(v * 100).toFixed(2).replace(".", ",")}%`);
const p0 = (v: number | null) => (v == null ? "-" : `${Math.round(v * 100)}%`);
const h1 = (min: number) => `${(min / 60).toFixed(1).replace(".", ",").replace(/,0$/, "")} jam`;

function totals(facts: Fact[], st: Settings) {
  const a = emptyAgg();
  facts.forEach((f) => add(a, f));
  const ach = achievement(a.std, a.rated);
  return { qty: a.qty, ng: a.ng, rate: ngRate(a.ng, a.qty), ppm: ppm(a.ng, a.qty), ach, grade: grade(ach, st) };
}

/** Panah tren: naik/turun dibanding pembanding. higherIsBetter menentukan warna. */
function trendPct(now: number, prev: number, vs: string, higherIsBetter = true): Trend {
  if (!prev) return null;
  const d = (now - prev) / prev;
  if (Math.abs(d) < 0.005) return { text: `= ${vs}`, good: true };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.round(Math.abs(d) * 100)}% ${vs}`, good: d > 0 === higherIsBetter };
}
function trendPoint(now: number | null, prev: number | null, vs: string, higherIsBetter = true, digits = 0): Trend {
  if (now == null || prev == null) return null;
  const d = (now - prev) * 100;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return { text: `= ${vs}`, good: true };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(digits).replace(".", ",")}% ${vs}`, good: d > 0 === higherIsBetter };
}

function topNg(facts: Fact[], master: MasterData, limit: number) {
  const label = ngLabeler(master.ngGroups);
  const map = new Map<string, number>();
  let total = 0;
  for (const f of facts)
    f.ng.forEach((v, i) => {
      if (!v) return;
      const k = label(f.ngGroupId, i);
      map.set(k, (map.get(k) ?? 0) + v);
      total += v;
    });
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = rows[0]?.[1] ?? 0;
  return rows.map(([name, qty]) => ({ name, qty, share: total ? qty / total : 0, bar: max ? Math.round((qty / max) * 100) : 0 }));
}

// ---------- Hari Ini ----------

export type QueueCard = {
  id: string;
  member: string;
  detail: string;
  qty: number;
  ng: number;
  minutes: number;
  warnings: string[];
  sent: string;
  mcs: string[];
  procs: string[];
};

export type TodayView = {
  date: string;
  dateLabel: string;
  tiles: Tile[];
  queue: QueueCard[];
  rejected: { member: string; note: string }[];
  missing: string[];
  topNg: { name: string; qty: number; bar: number; share: number }[];
  expected: number;
  /** Ringkas untuk kartu dashboard. */
  stats: {
    qty: number;
    ng: number;
    rate: number | null;
    ppm: number | null;
    ppmMax: number;
    ach: number | null;
    grade: string;
    target: number;
    reported: number;
    waiting: number;
    /** Hari itu sudah lengkap (semua lapor & divalidasi) atau sudah lewat: aman dibandingkan. */
    complete: boolean;
    qtyTrend: Trend;
    rateTrend: Trend;
  };
  /** Hal yang perlu ditindaklanjuti, merah dulu. */
  attention: { level: "bad" | "warn" | "info"; text: string; href?: string }[];
  /** 7 hari sampai tanggal itu: hasil, NG, NG rate per hari. */
  trend: { date: string; label: string; qty: number; ng: number; rate: number | null }[];
  /** Kiriman & keputusan leader untuk tanggal itu, terbaru dulu. */
  activity: { time: string; kind: "kirim" | "ok" | "no"; text: string; by: string }[];
  /** Mesin dengan NG terbanyak pada tanggal itu. */
  machines: { mc: string; category: string; ng: number; rate: number | null; bar: number }[];
  kpis: Kpi[];
  detail: Row[];
  lostDetail: Row[];
  dash: Dash;
};

function card(s: RawSubmission, normalMin: number, procOf: Map<string, string> = new Map()): QueueCard {
  const items = s.items ?? [];
  const num = (v: unknown) => Number(v) || 0;
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const mcs = [...new Set(items.map((i) => i.mc).filter((m) => m && m !== "-"))];
  const qty = items.reduce((a, i) => a + num(i.normalQty) + num(i.otQty), 0);
  const ng = items.reduce((a, i) => a + (i.ng ?? []).reduce((x: number, v) => x + num(v), 0), 0);
  const lost = (s.lostTimes ?? []).reduce((a, l) => a + num(l.minutes), 0);
  const minutes = Math.round((items.reduce((a, i) => a + num(i.normalMin), 0) + lost) * 100) / 100;
  const warnings = [...(s.meta?.warnings ?? [])];
  if (Math.abs(minutes - normalMin) >= 1)
    warnings.push(`Total menit ${n0(minutes)}, ${minutes < normalMin ? "kurang" : "lebih"} ${n0(Math.abs(normalMin - minutes))} dari ${normalMin}`);
  const parts = items.length ? `${items.length} part` : "hanya lost time";
  return {
    id: s.id,
    member: s.member,
    detail: [cats.join(", "), mcs.join(", "), parts].filter(Boolean).join(" · "),
    qty,
    ng,
    minutes,
    warnings,
    sent: s.sent.slice(11, 16),
    mcs,
    procs: [...new Set(cats.map((c) => procOf.get(c) ?? c))],
  };
}

export type DashOpts = { proc?: string; days?: number; ngBy?: string };

export async function buildToday(date: string, opts: DashOpts = {}): Promise<TodayView> {
  const master = await loadMaster();
  const st = master.settings;
  // Filter proses = semua kategori dengan Process yang sama di Master Data (mis. Senbetsu, Bowl PF).
  const procs = [...new Set(master.categories.map((c) => c.process).filter(Boolean))];
  const proc = opts.proc && procs.includes(opts.proc) ? opts.proc : "";
  const procCats = proc ? master.categories.filter((c) => c.process === proc) : null;
  const days = opts.days === 14 || opts.days === 30 ? opts.days : 7;
  // Minimal 14 hari ke belakang: untuk tren "vs kemarin" dan daftar member yang biasanya lapor.
  const [{ facts, lost }, allSubs] = await Promise.all([
    loadFacts(master, addDays(date, -Math.max(14, days)), date, procCats?.map((c) => c.id)),
    callBackend<RawSubmission[]>("queue", { date }),
  ]);
  const procNames = new Set(procCats?.map((c) => c.name));
  const subs = procCats ? allSubs.filter((x) => (x.items ?? []).some((i) => procNames.has(i.category))) : allSubs;
  const today = facts.filter((f) => f.workDate === date);
  const prevDate = [...new Set(facts.map((f) => f.workDate).filter((d) => d < date))].sort().pop();
  const prev = prevDate ? facts.filter((f) => f.workDate === prevDate) : [];
  const t = totals(today, st);
  const p = totals(prev, st);
  const vsText = prevDate === addDays(date, -1) ? "vs kemarin" : prevDate ? `vs ${formatDateId(prevDate).slice(0, -5)}` : "";

  // Member yang diharapkan lapor: yang punya data 14 hari terakhir atau mengirim hari ini.
  const sentToday = new Map<string, string[]>();
  for (const s of subs) sentToday.set(s.member, [...(sentToday.get(s.member) ?? []), s.status]);
  const active = new Set([...facts.map((f) => f.memberName), ...lost.map((l) => lostMember(l, master)), ...sentToday.keys()]);
  const doneToday = new Set([...today.map((f) => f.memberName), ...lost.filter((l) => l.workDate === date).map((l) => lostMember(l, master))]);
  // Section selain QA hanya dihitung kalau hari ini ikut lapor (perbantuan/lembur di QA).
  const expected = master.members.filter((m) => active.has(m.name) && (isQaMember(m) || sentToday.has(m.name) || doneToday.has(m.name)));
  const missing = expected.filter((m) => !sentToday.has(m.name) && !doneToday.has(m.name)).map((m) => m.name);
  const rejected = openRejections(subs)
    .map((s) => ({ member: s.member, note: s.note }));
  const queue = subs
    .filter((s) => s.status === "Menunggu")
    .sort((a, b) => a.sent.localeCompare(b.sent))
    .map((s) => card(s, st.normalMin, new Map(master.categories.map((c) => [c.name, c.process]))));
  const reported = expected.filter((m) => doneToday.has(m.name) || (sentToday.get(m.name) ?? []).some((x) => x !== "Ditolak")).length;
  // Hari berjalan yang belum lengkap jangan dibandingkan dengan hari penuh: angkanya pasti terlihat turun.
  const now = nowJakarta();
  const complete = date < now.slice(0, 10) || (missing.length === 0 && queue.length === 0 && rejected.length === 0);
  const vs = complete ? vsText : "";

  const attention: TodayView["attention"] = [];
  const hoursWaiting = (sent: string) => (Date.parse(`${now.slice(0, 10)}T${now.slice(11, 16)}:00Z`) - Date.parse(`${date}T${sent}:00Z`)) / 36e5;
  const old = queue.filter((c) => date === now.slice(0, 10) && hoursWaiting(c.sent) >= 2);
  if (old.length) attention.push({ level: "bad", text: `${old.length} laporan menunggu validasi lebih dari 2 jam (${old.map((c) => c.member).join(", ")})`, href: "/?page=leader" });
  if (rejected.length) attention.push({ level: "warn", text: `${rejected.length} laporan ditolak belum dikirim ulang: ${rejected.map((r) => r.member).join(", ")}` });
  const lowAch = [...groupBy(today, (f) => f.memberId).values()]
    .map((g) => ({ name: g.first.memberName, ach: achievement(g.agg.std, g.agg.rated) }))
    .filter((m) => m.ach != null && m.ach * 100 < st.gradeC)
    .sort((a, b) => (a.ach ?? 0) - (b.ach ?? 0));
  if (lowAch.length)
    attention.push({ level: "bad", text: `Achievement di bawah ${st.gradeC}%: ${lowAch.map((m) => `${m.name} ${p0(m.ach)}`).join(", ")}`, href: `/reports/daily?date=${date}` });
  const ngParts = [...groupBy(today, (f) => f.partId).values()]
    .map((g) => ({ part: g.first.part, id: g.first.partId, ppm: ppm(g.agg.ng, g.agg.qty), ng: g.agg.ng, qty: g.agg.qty, n: g.agg.qty + g.agg.ng }))
    .filter((x) => x.n >= 100 && (x.ppm ?? 0) > st.ngPpmMax) // sama dengan NG rate > batas
    .sort((a, b) => (b.ppm ?? 0) - (a.ppm ?? 0));
  for (const x of ngParts.slice(0, 3))
    attention.push({ level: "bad", text: `NG ${x.part}: ${p2(ngRate(x.ng, x.qty))}, batas ${ngMaxText(st)}`, href: `/reports/ng-type?from=${date}&to=${date}&part=${x.id}` });
  if (missing.length && (date < now.slice(0, 10) || Number(now.slice(11, 13)) >= 15))
    attention.push({ level: "warn", text: `${missing.length} member belum kirim laporan: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ", ..." : ""}` });
  if (today.length) {
    const running = new Set(today.filter((f) => f.mcNo !== "-").map((f) => `${f.categoryId}|${f.mcNo}`));
    const idle = master.machines.filter((m) => !running.has(`${m.categoryId}|${m.mcNo}`)).length;
    if (idle) attention.push({ level: "info", text: `${idle} dari ${master.machines.length} mesin tidak jalan`, href: `/reports/machine?from=${date}&to=${date}` });
  }

  return {
    date,
    dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    tiles: [
      { label: "Hasil", value: n0(t.qty), sub: "pcs, yang sudah disetujui", trend: vs ? trendPct(t.qty, p.qty, vs) : null },
      { label: "NG", value: n0(t.ng), sub: `NG rate ${p2(t.rate)}`, trend: vs ? trendPoint(t.rate, p.rate, vs, false, 2) : null },
      { label: "Achievement", value: p0(t.ach), sub: t.ach == null ? "belum ada data" : `Grade ${t.grade}, target ${st.target}%`, trend: vs ? trendPoint(t.ach, p.ach, vs) : null },
      {
        label: "Laporan masuk",
        value: `${reported} / ${expected.length}`,
        sub: `${queue.length} menunggu, ${missing.length} belum kirim`,
        trend: null,
      },
    ],
    queue,
    rejected,
    missing,
    topNg: topNg(today, master, 5),
    expected: expected.length,
    stats: {
      qty: t.qty,
      ng: t.ng,
      rate: t.rate,
      ppm: t.ppm,
      ppmMax: st.ngPpmMax,
      ach: t.ach,
      grade: String(t.grade),
      target: st.target,
      reported,
      waiting: queue.length,
      complete,
      qtyTrend: vs ? trendPct(t.qty, p.qty, vs) : null,
      rateTrend: vs ? trendPoint(t.rate, p.rate, vs, false, 2) : null,
    },
    attention: attention.sort((a, b) => ["bad", "warn", "info"].indexOf(a.level) - ["bad", "warn", "info"].indexOf(b.level)),
    activity: subs
      .flatMap((x) => {
        const parts = x.items?.length ? `${x.items.length} part` : "lost time";
        const a: TodayView["activity"] = [{ time: x.sent, kind: "kirim", text: `Laporan ${x.member} dikirim (${parts})`, by: x.member }];
        if (x.status !== "Menunggu" && x.decided)
          a.push({ time: x.decided, kind: x.status === "Disetujui" ? "ok" : "no", text: `Laporan ${x.member} ${x.status === "Disetujui" ? "disetujui" : "ditolak"}`, by: x.leader });
        return a;
      })
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 6)
      .map((a) => ({ ...a, time: a.time.slice(0, 10) === date ? a.time.slice(11, 16) : `${formatDateId(a.time.slice(0, 10)).split(" ").slice(0, 2).join(" ")} ${a.time.slice(11, 16)}` })),
    machines: (() => {
      const by = new Map<string, { mc: string; category: string; ng: number; qty: number }>();
      for (const f of today) {
        if (!f.mcNo || f.mcNo === "-") continue;
        const k = `${f.categoryName}|${f.mcNo}`;
        const m = by.get(k) ?? { mc: f.mcNo, category: f.categoryName, ng: 0, qty: 0 };
        m.ng += f.ng.reduce((x, y) => x + y, 0);
        m.qty += f.qty;
        by.set(k, m);
      }
      const rows = [...by.values()].filter((m) => m.ng > 0).sort((a, b) => b.ng - a.ng).slice(0, 5);
      const max = rows[0]?.ng ?? 0;
      return rows.map((m) => ({ mc: m.mc, category: m.category, ng: m.ng, rate: ngRate(m.ng, m.qty), bar: max ? Math.round((m.ng / max) * 100) : 0 }));
    })(),
    trend: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      const x = totals(facts.filter((f) => f.workDate === d), st);
      return { date: d, label: formatDateId(d).split(" ").slice(0, 2).join(" "), qty: x.qty, ng: x.ng, rate: x.rate };
    }),
    kpis: [
      { label: "Hasil (pcs)", value: t.qty, format: "int" },
      { label: "NG (pcs)", value: t.ng, format: "int" },
      { label: "NG rate", value: t.rate, format: "pct", target: `maks ${ngMaxText(st)}`, status: vsTarget(t.rate, ngMax(st), true) },
      { label: "Achievement", value: t.ach, format: "pct", hint: t.ach == null ? undefined : `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : t.ach * 100, st.target) },
      { label: "Laporan masuk", value: `${reported} dari ${expected.length}`, hint: `${queue.length} menunggu, ${missing.length} belum kirim` },
    ],
    detail: today
      .sort((a, b) => a.memberName.localeCompare(b.memberName))
      .map((f) => {
        const a = emptyAgg();
        add(a, f);
        const c = aggCols(a, st);
        return { member: f.memberName, category: f.categoryName, part: f.part, mc: f.mcNo, lot: f.lot, oiban: f.oiban, qty: f.qty, ng: a.ng, ngRate: c.ngRate, min: f.minNormal + f.minOt, ach: c.ach, grade: String(c.grade) };
      }),
    dash: buildDash({ master, date, facts, lost, today, prev, prevDate, queue, missing, procs, proc, days, ngBy: opts.ngBy === "qty" ? "qty" : "rate" }),
    lostDetail: lost
      .filter((l) => l.workDate === date)
      .map((l) => ({ member: l.memberName, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", name: l.name, minutes: l.minutes, remarks: l.remarks })),
  };
}

// ---------- Dashboard v2 ----------

/** Produksi mesin di bawah ini tidak diranking NG rate-nya: angkanya belum bisa dipercaya. */
export const NG_RANK_MIN_QTY = 500;

export type Dash = {
  procs: string[];
  proc: string;
  days: number;
  ngBy: "rate" | "qty";
  /** Lost Time (grup Lost Time) & Another Job dalam menit, plus menit kerja orang (normal + OT + lost + another job). */
  lost: { lt: number; aj: number; work: number; pct: number | null; prevLt: number | null; vs: string };
  prevQty: number | null;
  prevRate: number | null;
  prevAch: number | null;
  /** Kiriman tertua yang masih menunggu, "HH:MM", dan berapa jam sudah menunggu (hari ini saja). */
  oldest: { sent: string; hours: number | null } | null;
  trend: { date: string; label: string; qty: number; ach: number | null; rate: number | null; lt: number }[];
  byProc: { proc: string; qty: number; ng: number; rate: number | null; ach: number | null; lt: number; members: number }[];
  machines: { key: string; mc: string; category: string; categoryId: number; proc: string; line: string; status: "jalan" | "kosong"; qty: number; ng: number; rate: number | null; alert: boolean }[];
  topNg: { mc: string; category: string; categoryId: number; proc: string; qty: number; ng: number; rate: number | null }[];
  /** Mesin yang tidak ikut ranking NG rate karena produksinya di bawah NG_RANK_MIN_QTY. */
  ngSkipped: number;
  missing: { member: string; mcs: string; proc: string; status: "belum" | "lewat" | "terlambat" }[];
  topLost: { name: string; minutes: number; members: string[] }[];
};

function buildDash(a: {
  master: MasterData;
  date: string;
  facts: Fact[];
  lost: LostFact[];
  today: Fact[];
  prev: Fact[];
  prevDate: string | undefined;
  queue: QueueCard[];
  missing: string[];
  procs: string[];
  proc: string;
  days: number;
  ngBy: "rate" | "qty";
}): Dash {
  const { master, date, facts, lost, today, prev, prevDate } = a;
  const st = master.settings;
  const procOf = new Map(master.categories.map((c) => [c.id, c.process]));
  const ltOf = (rows: LostFact[]) => lostSplit(rows);
  const todayLost = lost.filter((l) => l.workDate === date);
  const { lt, aj } = ltOf(todayLost);
  const work = today.reduce((x, f) => x + f.minNormal + f.minOt, 0) + lt + aj;
  const prevLt = prevDate ? ltOf(lost.filter((l) => l.workDate === prevDate)).lt : null;
  const p = prev.length ? totals(prev, st) : null;
  const now = nowJakarta();
  const isToday = date === now.slice(0, 10);

  // Lost time tidak menyimpan kategori: menit per member-hari dibagi ke proses sesuai porsi menit kerjanya.
  const ltByProc = new Map<string, number>();
  const minsBy = new Map<string, Map<string, number>>();
  for (const f of today) {
    const m = minsBy.get(f.memberName) ?? new Map<string, number>();
    const pr = procOf.get(f.categoryId) ?? f.categoryName;
    m.set(pr, (m.get(pr) ?? 0) + f.minNormal + f.minOt);
    minsBy.set(f.memberName, m);
  }
  for (const l of todayLost) {
    if (l.group === "ANOTHER_JOB") continue;
    const m = minsBy.get(l.memberName);
    const all = m ? [...m.values()].reduce((x, y) => x + y, 0) : 0;
    if (!m || !all) continue;
    for (const [pr, v] of m) ltByProc.set(pr, (ltByProc.get(pr) ?? 0) + (l.minutes * v) / all);
  }
  const byProc = (a.proc ? [a.proc] : a.procs).map((pr) => {
    const rows = today.filter((f) => (procOf.get(f.categoryId) ?? "") === pr);
    const x = totals(rows, st);
    return { proc: pr, qty: x.qty, ng: x.ng, rate: x.rate, ach: x.ach, lt: Math.round(ltByProc.get(pr) ?? 0), members: new Set(rows.map((f) => f.memberName)).size };
  });

  // Mesin: status hanya dari laporan (bukan sinyal mesin).
  const byMc = new Map<string, { qty: number; ng: number }>();
  for (const f of today) {
    if (f.mcNo === "-") continue;
    const k = `${f.categoryId}|${f.mcNo}`;
    const e = byMc.get(k) ?? { qty: 0, ng: 0 };
    e.qty += f.qty;
    e.ng += f.ng.reduce((x, y) => x + y, 0);
    byMc.set(k, e);
  }
  const limit = ngMax(st);
  const cats = new Map(master.categories.map((c) => [c.id, c]));
  const machines = master.machines
    .filter((m) => !a.proc || procOf.get(m.categoryId) === a.proc)
    .map((m) => {
      const key = `${m.categoryId}|${m.mcNo}`;
      const e = byMc.get(key);
      const rate = e ? ngRate(e.ng, e.qty) : null;
      return {
        key,
        mc: m.mcNo,
        category: cats.get(m.categoryId)?.name ?? "",
        categoryId: m.categoryId,
        proc: procOf.get(m.categoryId) ?? "",
        line: m.line,
        status: e ? ("jalan" as const) : ("kosong" as const),
        qty: e?.qty ?? 0,
        ng: e?.ng ?? 0,
        rate,
        alert: !!e && e.qty >= NG_RANK_MIN_QTY && rate != null && rate > limit,
      };
    });
  const ran = machines.filter((m) => m.status === "jalan" && (m.ng > 0 || m.qty > 0));
  const eligible = a.ngBy === "rate" ? ran.filter((m) => m.qty >= NG_RANK_MIN_QTY && m.ng > 0) : ran.filter((m) => m.ng > 0);
  const topNg = eligible
    .sort((x, y) => (a.ngBy === "rate" ? (y.rate ?? 0) - (x.rate ?? 0) || y.ng - x.ng : y.ng - x.ng || (y.rate ?? 0) - (x.rate ?? 0)))
    .slice(0, 5)
    .map(({ mc, category, categoryId, proc, qty, ng, rate }) => ({ mc, category, categoryId, proc, qty, ng, rate }));

  // Belum kirim: mesin & proses yang biasa dipegang (laporan terakhir dalam 14 hari).
  const lastOf = new Map<string, Fact[]>();
  for (const f of facts) {
    if (f.workDate >= date) continue;
    const cur = lastOf.get(f.memberName);
    if (!cur || cur[0].workDate < f.workDate) lastOf.set(f.memberName, [f]);
    else if (cur[0].workDate === f.workDate) cur.push(f);
  }
  const hour = Number(now.slice(11, 13));
  const missStatus = !isToday && date < now.slice(0, 10) ? "terlambat" : hour >= 15 ? "lewat" : "belum";
  const missing = a.missing.map((m) => {
    const rows = lastOf.get(m) ?? [];
    return {
      member: m,
      mcs: [...new Set(rows.map((f) => f.mcNo).filter((x) => x !== "-"))].join(", "),
      proc: [...new Set(rows.map((f) => procOf.get(f.categoryId) ?? f.categoryName))].join(", "),
      status: missStatus as Dash["missing"][number]["status"],
    };
  });

  const ltMap = new Map<string, { minutes: number; members: Set<string> }>();
  for (const l of todayLost) {
    if (l.group === "ANOTHER_JOB" || !l.minutes) continue;
    const e = ltMap.get(l.name) ?? { minutes: 0, members: new Set<string>() };
    e.minutes += l.minutes;
    e.members.add(l.memberName);
    ltMap.set(l.name, e);
  }
  const topLost = [...ltMap.entries()]
    .sort((x, y) => y[1].minutes - x[1].minutes)
    .slice(0, 5)
    .map(([name, e]) => ({ name, minutes: Math.round(e.minutes), members: [...e.members] }));

  const old = a.queue[0];
  const hoursWaiting = old && isToday ? (Date.parse(`${date}T${now.slice(11, 16)}:00Z`) - Date.parse(`${date}T${old.sent}:00Z`)) / 36e5 : null;

  return {
    procs: a.procs,
    proc: a.proc,
    days: a.days,
    ngBy: a.ngBy,
    lost: {
      lt: Math.round(lt),
      aj: Math.round(aj),
      work: Math.round(work),
      pct: work > 0 ? lt / work : null,
      prevLt: prevLt == null ? null : Math.round(prevLt),
      vs: prevDate === addDays(date, -1) ? "vs kemarin" : prevDate ? `vs ${formatDateId(prevDate).slice(0, -5)}` : "",
    },
    prevQty: p ? p.qty : null,
    prevRate: p ? p.rate : null,
    prevAch: p ? p.ach : null,
    oldest: old ? { sent: old.sent, hours: hoursWaiting } : null,
    trend: Array.from({ length: a.days }, (_, i) => {
      const d = addDays(date, i - a.days + 1);
      const x = totals(facts.filter((f) => f.workDate === d), st);
      return { date: d, label: formatDateId(d).split(" ").slice(0, 2).join(" "), qty: x.qty, ach: x.ach, rate: x.rate, lt: Math.round(ltOf(lost.filter((l) => l.workDate === d)).lt) };
    }),
    byProc,
    machines,
    topNg,
    ngSkipped: a.ngBy === "rate" ? ran.filter((m) => m.ng > 0 && m.qty < NG_RANK_MIN_QTY).length : 0,
    missing,
    topLost,
  };
}

function lostMember(l: LostFact, master: MasterData) {
  return master.members.find((m) => m.id === l.memberId)?.name ?? "";
}

// ---------- Laporan ----------

export type PersonRow = {
  id: number; name: string; nik: string; days: number; qty: number; ngRate: number | null; lostMin: number; ach: number | null; grade: string };
export type MachineRow = { mc: string; category: string; line: string; hours: number; pcsHr: number | null; eff: number | null; qty: number };

export type LaporanView = {
  from: string;
  to: string;
  categoryId?: number;
  period: string;
  vsLabel: string;
  tiles: Tile[];
  kpis: Kpi[];
  month: { label: string; deadline: string; total: number; complete: number; problems: { date: string; reason: string }[] };
  people: PersonRow[];
  ngTypes: { name: string; qty: number; share: number; bar: number }[];
  lots: { part: string; lot: string; ng: number; rate: number | null }[];
  notes: { what: string; who: string }[];
  machines: MachineRow[];
  categories: { name: string; qty: number; ngRate: number | null; ngPpm: number | null; ach: number | null; grade: string }[];
  totalNg: number;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Periode pembanding: bulan lalu pada tanggal yang sama bila mulai tgl 1, selain itu periode sama panjang sebelumnya. */
function previousPeriod(from: string, to: string) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
  if (from === monthStart(from)) {
    const pFrom = monthStart(addDays(from, -1));
    const pTo = addDays(pFrom, days) > monthEnd(pFrom) ? monthEnd(pFrom) : addDays(pFrom, days);
    return { pFrom, pTo, label: `vs ${BULAN[Number(pFrom.slice(5, 7)) - 1].slice(0, 3)}` };
  }
  const pTo = addDays(from, -1);
  return { pFrom: addDays(pTo, -days), pTo, label: "vs periode sebelumnya" };
}

export async function buildLaporan(p: { from?: string; to?: string; categoryId?: number }, today: string): Promise<LaporanView> {
  const master = await loadMaster();
  const st = master.settings;
  const from = p.from ?? monthStart(today);
  const to = p.to ?? today;
  const { pFrom, pTo, label: vsLabel } = previousPeriod(from, to);
  const mFrom = monthStart(to);
  const mTo = monthEnd(to) < today ? monthEnd(to) : today;
  const [{ facts, lost }, prevData, monthData, subs] = await Promise.all([
    loadFacts(master, from, to, p.categoryId),
    loadFacts(master, pFrom, pTo, p.categoryId),
    loadFacts(master, mFrom, mTo),
    callBackend<RawSubmission[]>("queue", {}),
  ]);

  const t = totals(facts, st);
  const pt = totals(prevData.facts, st);
  const lt = lostSplit(lost).lt;
  const plt = lostSplit(prevData.lost).lt;

  // Status laporan bulanan: hari yang ada data/kiriman, dan hari yang masih belum beres.
  const mSubs = subs.filter((s) => s.date >= mFrom && s.date <= mTo);
  const days = [...new Set([...monthData.facts.map((f) => f.workDate), ...monthData.lost.map((l) => l.workDate), ...mSubs.map((s) => s.date)])].sort();
  const problems: { date: string; reason: string }[] = [];
  for (const d of days) {
    const ds = mSubs.filter((s) => s.date === d);
    const wait = ds.filter((s) => s.status === "Menunggu").length;
    const rej = new Set(openRejections(ds).map((s) => s.member)).size;
    const why = [wait ? `${wait} laporan belum divalidasi` : "", rej ? `${rej} laporan ditolak belum dikirim ulang` : ""].filter(Boolean).join(", ");
    if (why) problems.push({ date: d, reason: why });
  }
  const next = addDays(monthEnd(to), 1);

  // Orang
  const lostByMember = new Map<number, number>();
  for (const l of lost) if (l.group !== "ANOTHER_JOB") lostByMember.set(l.memberId, (lostByMember.get(l.memberId) ?? 0) + l.minutes);
  const people: PersonRow[] = [...groupBy(facts, (f) => f.memberId).entries()].map(([id, g]) => {
    const c = aggCols(g.agg, st);
    return {
      id,
      name: g.first.memberName,
      nik: g.first.nik,
      days: new Set(facts.filter((f) => f.memberId === id).map((f) => f.workDate)).size,
      qty: g.agg.qty,
      ngRate: c.ngRate,
      lostMin: lostByMember.get(id) ?? 0,
      ach: c.ach,
      grade: String(c.grade),
    };
  });
  people.sort((a, b) => (a.ach ?? 9) - (b.ach ?? 9) || a.name.localeCompare(b.name));

  // Part & NG
  const lots = [...groupBy(facts, (f) => `${f.partId}|${f.lot}`).values()]
    .filter((g) => g.agg.ng > 0)
    .map((g) => ({ part: g.first.part, lot: g.first.lot, ng: g.agg.ng, rate: ngRate(g.agg.ng, g.agg.qty) }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, 5);
  const label = ngLabeler(master.ngGroups);
  const notes = facts
    .filter((f) => f.ngNote)
    .sort((a, b) => b.workDate.localeCompare(a.workDate))
    .slice(0, 20)
    .map((f) => {
      const qty = f.ng.reduce((a, v, i) => (/^lain/i.test(label(f.ngGroupId, i)) ? a + v : a), 0);
      return { what: `${f.ngNote}${qty ? ` (${n0(qty)} pcs)` : ""}`, who: `${f.memberName}, ${formatDateId(f.workDate).slice(0, -5)} · ${f.part}` };
    });

  // Mesin PF: jam mesin jalan dan efisiensi terhadap Standar MC (sama dengan tab Report - Machine).
  const machines: MachineRow[] = [...groupBy(facts.filter((f) => f.mcNo !== "-"), (f) => `${f.categoryId}|${f.mcNo}`).values()]
    .map((g) => {
      const fs = facts.filter((f) => f.categoryId === g.first.categoryId && f.mcNo === g.first.mcNo);
      let hours = 0,
        std = 0,
        rated = 0;
      for (const f of fs) {
        hours += f.mcHours;
        if (f.mcStd > 0) {
          std += f.qty / f.mcStd;
          rated += f.mcHours;
        }
      }
      return { mc: g.first.mcNo, category: g.first.categoryName, line: g.first.line, hours, qty: g.agg.qty, pcsHr: hours > 0 ? g.agg.qty / hours : null, eff: rated > 0 ? std / rated : null };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.mc.localeCompare(b.mc, "id", { numeric: true }));

  const catName = p.categoryId ? master.categories.find((c) => c.id === p.categoryId)?.name : undefined;
  return {
    from,
    to,
    categoryId: p.categoryId,
    period: `${formatDateId(from)} – ${formatDateId(to)}${catName ? ` · ${catName}` : ""}`,
    vsLabel,
    tiles: [
      { label: "Hasil", value: n0(t.qty), sub: "pcs", trend: trendPct(t.qty, pt.qty, vsLabel) },
      { label: "NG rate", value: p2(t.rate), sub: `${n0(t.ng)} pcs NG`, trend: trendPct(t.rate ?? 0, pt.rate ?? 0, vsLabel, false), target: `maks ${ngMaxText(st)}`, status: vsTarget(t.rate, ngMax(st), true) },
      { label: "Achievement", value: p0(t.ach), sub: t.ach == null ? "belum ada data" : `Grade ${t.grade}`, trend: trendPoint(t.ach, pt.ach, vsLabel), target: `${st.target}%`, status: vsTarget(t.ach == null ? null : t.ach * 100, st.target) },
      { label: "Waktu hilang", value: h1(lt), sub: "lost time, tanpa Another Job", trend: trendPct(lt, plt, vsLabel, false) },
    ],
    kpis: [
      { label: "Hasil (pcs)", value: t.qty, format: "int" },
      { label: "Achievement", value: t.ach, format: "pct", hint: t.ach == null ? undefined : `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : t.ach * 100, st.target) },
      { label: "NG rate", value: t.rate, format: "pct", hint: `${n0(t.ng)} pcs NG`, target: `maks ${ngMaxText(st)}`, status: vsTarget(t.rate, ngMax(st), true) },
      { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
      { label: "Hari kerja lengkap", value: `${days.length - problems.length} dari ${days.length}`, hint: `bulan ${BULAN[Number(mFrom.slice(5, 7)) - 1]}, batas kirim 10 ${BULAN[Number(next.slice(5, 7)) - 1]}` },
    ],
    month: {
      label: `Laporan bulan ${BULAN[Number(mFrom.slice(5, 7)) - 1]} ${mFrom.slice(0, 4)}`,
      deadline: `10 ${BULAN[Number(next.slice(5, 7)) - 1]}`,
      total: days.length,
      complete: days.length - problems.length,
      problems,
    },
    people,
    ngTypes: topNg(facts, master, 8),
    lots,
    notes,
    machines,
    categories: [...groupBy(facts, (f) => f.categoryId).values()]
      .map((g) => {
        const c = aggCols(g.agg, st);
        return { name: g.first.categoryName, qty: g.agg.qty, ngRate: c.ngRate, ngPpm: c.ngPpm, ach: c.ach, grade: String(c.grade) };
      })
      .sort((a, b) => b.qty - a.qty),
    totalNg: t.ng,
  };
}

/** Bentuk Report biasa supaya Laporan bisa diunduh ke Excel dengan pengekspor yang sama. */
export function laporanToReport(v: LaporanView): Report {
  return {
    kind: "monthly",
    title: "Laporan Produksi QA",
    subtitle: v.period,
    kpis: v.kpis,
    charts: [
      {
        type: "pareto",
        title: "Pareto NG (pcs)",
        xKey: "name",
        series: [{ key: "qty", label: "NG", format: "int" }],
        data: v.ngTypes.reduce<Row[]>((acc, n) => [...acc, { name: n.name, qty: n.qty, cum: (Number(acc.at(-1)?.cum) || 0) + n.share }], []),
      },
    ],
    tables: [
      {
        title: "Per kategori",
        columns: [
          { key: "name", label: "Kategori" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ngRate", label: "NG rate", format: "pct" },
          { key: "ach", label: "Achievement", format: "pct" },
          { key: "grade", label: "Grade", format: "grade" },
        ],
        rows: v.categories as unknown as Row[],
      },
      {
        title: "Orang",
        columns: [
          { key: "nik", label: "NIK" },
          { key: "name", label: "Member" },
          { key: "days", label: "Hari kerja", format: "int" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ngRate", label: "NG rate", format: "pct" },
          { key: "lostHrs", label: "Waktu hilang (jam)", format: "dec1" },
          { key: "ach", label: "Achievement", format: "pct" },
          { key: "grade", label: "Grade", format: "grade" },
        ],
        rows: v.people.map((r) => ({ ...r, lostHrs: r.lostMin / 60 }) as Row),
      },
      {
        title: "NG per jenis",
        columns: [
          { key: "name", label: "Jenis NG" },
          { key: "qty", label: "NG (pcs)", format: "int" },
          { key: "share", label: "Porsi", format: "pct" },
        ],
        rows: v.ngTypes as unknown as Row[],
      },
      {
        title: "Lot NG tertinggi",
        columns: [
          { key: "part", label: "Part" },
          { key: "lot", label: "Lot" },
          { key: "ng", label: "NG (pcs)", format: "int" },
          { key: "rate", label: "NG rate", format: "pct" },
        ],
        rows: v.lots as unknown as Row[],
      },
      {
        title: "Catatan NG Lain-lain",
        detail: true,
        columns: [
          { key: "what", label: "Catatan" },
          { key: "who", label: "Member, tanggal, part" },
        ],
        rows: v.notes as unknown as Row[],
      },
      {
        title: "Mesin",
        columns: [
          { key: "category", label: "Kategori" },
          { key: "mc", label: "MC" },
          { key: "hours", label: "Jam mesin jalan", format: "dec1" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "pcsHr", label: "Hasil per jam", format: "dec1" },
          { key: "eff", label: "Efisiensi", format: "pct" },
        ],
        rows: v.machines as unknown as Row[],
      },
    ],
  };
}

/** Halaman Hari Ini dalam bentuk Report, untuk diunduh ke Excel. */
export function todayToReport(v: TodayView): Report {
  return {
    kind: "daily",
    title: "Laporan Hari Ini",
    subtitle: v.dateLabel,
    kpis: v.kpis,
    charts: [],
    tables: [
      {
        title: "Detail produksi (disetujui)",
        columns: [
          { key: "member", label: "Member" },
          { key: "category", label: "Kategori" },
          { key: "part", label: "Part" },
          { key: "mc", label: "Mesin" },
          { key: "lot", label: "Lot" },
          { key: "oiban", label: "Oiban" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ng", label: "NG (pcs)", format: "int" },
          { key: "ngRate", label: "NG rate", format: "pct" },
          { key: "min", label: "Menit", format: "int" },
          { key: "ach", label: "Achievement", format: "pct" },
          { key: "grade", label: "Grade", format: "grade" },
        ],
        rows: v.detail,
      },
      {
        title: "Lost time",
        columns: [
          { key: "member", label: "Member" },
          { key: "group", label: "Grup" },
          { key: "name", label: "Jenis" },
          { key: "minutes", label: "Menit", format: "int" },
          { key: "remarks", label: "Keterangan" },
        ],
        rows: v.lostDetail,
      },
      {
        title: "Menunggu validasi",
        columns: [
          { key: "member", label: "Member" },
          { key: "sent", label: "Jam kirim" },
          { key: "detail", label: "Isi" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ng", label: "NG (pcs)", format: "int" },
          { key: "minutes", label: "Menit", format: "int" },
          { key: "warn", label: "Perlu dicek" },
        ],
        rows: v.queue.map((c) => ({ member: c.member, sent: c.sent, detail: c.detail, qty: c.qty, ng: c.ng, minutes: c.minutes, warn: c.warnings.join("; ") })),
      },
      { title: "Belum kirim", columns: [{ key: "member", label: "Member" }], rows: v.missing.map((m) => ({ member: m })) },
      {
        title: "Ditolak",
        columns: [
          { key: "member", label: "Member" },
          { key: "note", label: "Alasan" },
        ],
        rows: v.rejected,
      },
    ],
  };
}
