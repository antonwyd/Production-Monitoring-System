// Data untuk dua halaman utama web: "Hari Ini" (leader) dan "Laporan" (kepala produksi).
// Semua angka dihitung dari baris yang sudah disetujui leader, sama seperti report lain.
import { callBackend, type RawSubmission } from "./backend";
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
  ppm,
  vsTarget,
} from "./reports";
import { achievement, grade, ngRate } from "./rules";
import { loadMaster } from "./service";
import type { MasterData, Settings } from "./types";

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
};

function card(s: RawSubmission, normalMin: number): QueueCard {
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
  };
}

export async function buildToday(date: string): Promise<TodayView> {
  const master = await loadMaster();
  const st = master.settings;
  // 14 hari ke belakang: untuk tren "vs kemarin" dan daftar member yang biasanya lapor.
  const [{ facts, lost }, subs] = await Promise.all([loadFacts(master, addDays(date, -14), date), callBackend<RawSubmission[]>("queue", { date })]);
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
  const expected = master.members.filter((m) => active.has(m.name));
  const missing = expected.filter((m) => !sentToday.has(m.name) && !doneToday.has(m.name)).map((m) => m.name);
  const rejected = subs
    .filter((s) => s.status === "Ditolak" && !(sentToday.get(s.member) ?? []).some((x) => x !== "Ditolak"))
    .map((s) => ({ member: s.member, note: s.note }));
  const queue = subs
    .filter((s) => s.status === "Menunggu")
    .sort((a, b) => a.sent.localeCompare(b.sent))
    .map((s) => card(s, st.normalMin));
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
    .map((g) => ({ part: g.first.part, id: g.first.partId, ppm: ppm(g.agg.ng, g.agg.qty), n: g.agg.qty + g.agg.ng }))
    .filter((x) => x.n >= 100 && (x.ppm ?? 0) > st.ngPpmMax)
    .sort((a, b) => (b.ppm ?? 0) - (a.ppm ?? 0));
  for (const x of ngParts.slice(0, 3))
    attention.push({ level: "bad", text: `NG ${x.part}: ${n0(x.ppm ?? 0)} PPM, batas ${n0(st.ngPpmMax)}`, href: `/reports/ng-type?from=${date}&to=${date}&part=${x.id}` });
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
      { label: "NG (PPM)", value: t.ppm, format: "ppm", hint: `NG rate ${p2(t.rate)}`, target: `maks ${n0(st.ngPpmMax)}`, status: vsTarget(t.ppm, st.ngPpmMax, true) },
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
    lostDetail: lost
      .filter((l) => l.workDate === date)
      .map((l) => ({ member: l.memberName, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", name: l.name, minutes: l.minutes, remarks: l.remarks })),
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
    const okMembers = new Set(ds.filter((s) => s.status !== "Ditolak").map((s) => s.member));
    const rej = new Set(ds.filter((s) => s.status === "Ditolak" && !okMembers.has(s.member)).map((s) => s.member)).size;
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
      { label: "NG (PPM)", value: t.ppm == null ? "-" : n0(t.ppm), sub: `${n0(t.ng)} pcs NG · ${p2(t.rate)}`, trend: trendPct(t.ppm ?? 0, pt.ppm ?? 0, vsLabel, false), target: `maks ${n0(st.ngPpmMax)}`, status: vsTarget(t.ppm, st.ngPpmMax, true) },
      { label: "Achievement", value: p0(t.ach), sub: t.ach == null ? "belum ada data" : `Grade ${t.grade}`, trend: trendPoint(t.ach, pt.ach, vsLabel), target: `${st.target}%`, status: vsTarget(t.ach == null ? null : t.ach * 100, st.target) },
      { label: "Waktu hilang", value: h1(lt), sub: "lost time, tanpa Another Job", trend: trendPct(lt, plt, vsLabel, false) },
    ],
    kpis: [
      { label: "Hasil (pcs)", value: t.qty, format: "int" },
      { label: "Achievement", value: t.ach, format: "pct", hint: t.ach == null ? undefined : `Grade ${t.grade}`, target: `${st.target}%`, status: vsTarget(t.ach == null ? null : t.ach * 100, st.target) },
      { label: "NG (PPM)", value: t.ppm, format: "ppm", hint: `${n0(t.ng)} pcs NG, NG rate ${p2(t.rate)}`, target: `maks ${n0(st.ngPpmMax)}`, status: vsTarget(t.ppm, st.ngPpmMax, true) },
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
          { key: "ngPpm", label: "NG (PPM)", format: "ppm" },
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
