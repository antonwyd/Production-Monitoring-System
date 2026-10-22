// Data untuk dua halaman utama web: "Hari Ini" (leader) dan "Laporan" (kepala produksi).
// Semua angka dihitung dari baris yang sudah disetujui leader, sama seperti report lain.
import { callBackend, type RawSubmission } from "./backend";
import { addDays, formatDateId, monthEnd, monthStart } from "./dates";
import {
  add,
  aggCols,
  emptyAgg,
  groupBy,
  lostSplit,
  loadFacts,
  ngLabeler,
  type Fact,
  type LostFact,
  type Report,
  type Row,
} from "./reports";
import { achievement, grade, ngRate } from "./rules";
import { loadMaster } from "./service";
import type { MasterData, Settings } from "./types";

export type Trend = { text: string; good: boolean } | null;
export type Tile = { label: string; value: string; sub: string; trend: Trend };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const p1 = (v: number | null) => (v == null ? "-" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const p0 = (v: number | null) => (v == null ? "-" : `${Math.round(v * 100)}%`);
const h1 = (min: number) => `${(min / 60).toFixed(1).replace(".", ",").replace(/,0$/, "")} jam`;

function totals(facts: Fact[], st: Settings) {
  const a = emptyAgg();
  facts.forEach((f) => add(a, f));
  const ach = achievement(a.std, a.rated);
  return { qty: a.qty, ng: a.ng, rate: ngRate(a.ng, a.qty), ach, grade: grade(ach, st) };
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
  topNg: { name: string; qty: number; bar: number }[];
  expected: number;
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
  const vs = prevDate === addDays(date, -1) ? "vs kemarin" : prevDate ? `vs ${formatDateId(prevDate).slice(0, -5)}` : "";

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

  return {
    date,
    dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    tiles: [
      { label: "Hasil", value: n0(t.qty), sub: "pcs, yang sudah disetujui", trend: vs ? trendPct(t.qty, p.qty, vs) : null },
      { label: "NG", value: n0(t.ng), sub: `NG rate ${p1(t.rate)}`, trend: vs ? trendPoint(t.rate, p.rate, vs, false, 1) : null },
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
  month: { label: string; deadline: string; total: number; complete: number; problems: { date: string; reason: string }[] };
  people: PersonRow[];
  ngTypes: { name: string; qty: number; share: number; bar: number }[];
  lots: { part: string; lot: string; ng: number; rate: number | null }[];
  notes: { what: string; who: string }[];
  machines: MachineRow[];
  categories: { name: string; qty: number; ngRate: number | null; ach: number | null; grade: string }[];
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
      { label: "NG rate", value: p1(t.rate), sub: `${n0(t.ng)} pcs NG`, trend: trendPoint(t.rate, pt.rate, vsLabel, false, 1) },
      { label: "Achievement", value: p0(t.ach), sub: t.ach == null ? "belum ada data" : `Grade ${t.grade}`, trend: trendPoint(t.ach, pt.ach, vsLabel) },
      { label: "Waktu hilang", value: h1(lt), sub: "lost time, tanpa Another Job", trend: trendPct(lt, plt, vsLabel, false) },
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
        return { name: g.first.categoryName, qty: g.agg.qty, ngRate: c.ngRate, ach: c.ach, grade: String(c.grade) };
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
    kpis: v.tiles.map((t) => ({ label: t.label, value: t.value, hint: t.sub })),
    charts: [],
    tables: [
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
          { key: "qty", label: "Qty NG", format: "int" },
          { key: "share", label: "Share", format: "pct" },
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
        columns: [
          { key: "what", label: "Catatan" },
          { key: "who", label: "Member, tanggal, part" },
        ],
        rows: v.notes as unknown as Row[],
      },
      {
        title: "Mesin PF",
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
