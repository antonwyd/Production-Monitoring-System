// Semua report dihitung dari tab Input - Production dan Input - Lost Time di Google Sheet,
// yaitu kiriman yang sudah disetujui leader (plus baris yang diisi langsung di sheet).
import { callBackend, type RawRows, type RawSubmission } from "./backend";
import { catId, memberId as memberIdOf, partId as partIdOf } from "./ids";
import { achievement, grade, ngRate, partLabel } from "./rules";
import { addDays, formatDateId, monthEnd, monthStart } from "./dates";
import { loadMaster } from "./service";
import type { MasterData, Settings } from "./types";

export const REPORT_KINDS = ["dashboard", "daily", "member", "category", "machine", "ng-type", "ng-lot", "monthly"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_TITLES: Record<ReportKind, string> = {
  dashboard: "Dashboard",
  daily: "Report Daily",
  member: "Report Member",
  category: "Report Category",
  machine: "Report Machine",
  "ng-type": "Report NG per Type",
  "ng-lot": "Report NG per Lot",
  monthly: "Laporan Bulanan",
};

export type ColFormat = "text" | "int" | "dec1" | "dec2" | "pct" | "grade";
export type Column = { key: string; label: string; format?: ColFormat };
export type Row = Record<string, string | number | null>;
export type Table = { title: string; columns: Column[]; rows: Row[]; total?: Row };
export type Chart = {
  type: "line" | "bar";
  title: string;
  xKey: string;
  series: { key: string; label: string; format?: ColFormat }[];
  data: Row[];
};
export type Kpi = { label: string; value: string | number | null; format?: ColFormat; hint?: string };
export type Report = { kind: ReportKind; title: string; subtitle: string; kpis: Kpi[]; charts: Chart[]; tables: Table[] };

export type ReportParams = {
  from?: string;
  to?: string;
  date?: string;
  month?: string; // YYYY-MM
  categoryId?: number;
  memberId?: number;
  partId?: number;
};

type Fact = {
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
  qty: number;
  qtyOt: number;
  minNormal: number;
  minOt: number;
  stki: number;
  ng: number[];
};

type LostFact = { workDate: string; memberId: number; name: string; group: string; minutes: number };

const rowsCache = new Map<string, { at: number; data: Promise<RawRows> }>();
const ROWS_TTL = 60_000;

/** Data report disimpan 1 menit di server supaya pindah halaman/filter tidak selalu menunggu Apps Script. */
function fetchRows(from: string, to: string): Promise<RawRows> {
  const key = `${from}|${to}`;
  const hit = rowsCache.get(key);
  if (hit && Date.now() - hit.at < ROWS_TTL) return hit.data;
  const data = callBackend<RawRows>("rows", { from, to });
  data.catch(() => rowsCache.delete(key));
  if (rowsCache.size > 50) rowsCache.clear();
  rowsCache.set(key, { at: Date.now(), data });
  return data;
}

export function clearReportCache() {
  rowsCache.clear();
}

async function loadFacts(master: MasterData, from: string, to: string, categoryId?: number, memberId?: number, partId?: number) {
  const raw = await fetchRows(from, to);
  const nikOf = new Map(master.members.map((m) => [m.name, m.nik]));
  const catOf = new Map(master.categories.map((c) => [c.name, c]));
  const facts: Fact[] = [];
  for (const r of raw.prod) {
    const [workDate, member, category, part, type, , , , , lot, , mc] = r.map(String);
    const n = (i: number) => Number(r[i]) || 0;
    const cid = catId(category);
    const pid = partIdOf(category, part, type);
    const mid = memberIdOf(member);
    if ((categoryId && cid !== categoryId) || (memberId && mid !== memberId) || (partId && pid !== partId)) continue;
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
      qty: n(5) + n(7),
      qtyOt: n(7),
      minNormal: n(6),
      minOt: n(8),
      stki: n(22) || master.parts.find((p) => p.id === pid)?.stki || 0,
      ng: Array.from({ length: 10 }, (_, i) => n(12 + i)),
    });
  }
  const lost: LostFact[] = [];
  for (const r of raw.lost) {
    const mid = memberIdOf(String(r[1]));
    if (memberId && mid !== memberId) continue;
    const name = String(r[2]);
    lost.push({
      workDate: String(r[0]),
      memberId: mid,
      name,
      group: master.lostTimeTypes.find((t) => t.name === name)?.group ?? "LOST_TIME",
      minutes: Number(r[3]) || 0,
    });
  }
  return { facts, lost };
}

type Agg = { qty: number; ng: number; rated: number; std: number; minNormal: number; minOt: number; count: number };
const emptyAgg = (): Agg => ({ qty: 0, ng: 0, rated: 0, std: 0, minNormal: 0, minOt: 0, count: 0 });

function add(a: Agg, f: Fact) {
  a.qty += f.qty;
  a.ng += f.ng.reduce((x, y) => x + y, 0);
  const rated = (f.minNormal + f.minOt) / 60;
  a.rated += rated;
  // Std Hours hanya dihitung untuk baris yang punya jam kerja, agar achievement = std/rated konsisten.
  if (rated > 0 && f.stki > 0) a.std += f.qty / f.stki;
  a.minNormal += f.minNormal;
  a.minOt += f.minOt;
  a.count++;
}

function groupBy<K extends string | number>(facts: Fact[], key: (f: Fact) => K) {
  const m = new Map<K, { first: Fact; agg: Agg }>();
  for (const f of facts) {
    const k = key(f);
    let g = m.get(k);
    if (!g) m.set(k, (g = { first: f, agg: emptyAgg() }));
    add(g.agg, f);
  }
  return m;
}

function aggCols(a: Agg, st: Settings) {
  const ach = achievement(a.std, a.rated);
  return {
    qty: a.qty,
    ng: a.ng,
    ngRate: ngRate(a.ng, a.qty),
    hours: a.rated,
    stdHours: a.std,
    ach,
    grade: grade(ach, st),
  };
}

const AGG_COLUMNS: Column[] = [
  { key: "qty", label: "Total Qty", format: "int" },
  { key: "ng", label: "Total NG", format: "int" },
  { key: "ngRate", label: "NG Rate", format: "pct" },
  { key: "hours", label: "Rated Hours", format: "dec1" },
  { key: "stdHours", label: "Std Hours", format: "dec1" },
  { key: "ach", label: "Achievement", format: "pct" },
  { key: "grade", label: "Grade", format: "grade" },
];

function totalRow(facts: Fact[], st: Settings, label: Row): Row {
  const a = emptyAgg();
  facts.forEach((f) => add(a, f));
  return { ...label, ...aggCols(a, st) };
}

function lostSplit(lost: LostFact[]) {
  let lt = 0,
    aj = 0;
  for (const l of lost) (l.group === "ANOTHER_JOB" ? (aj += l.minutes) : (lt += l.minutes));
  return { lt, aj };
}

function ngLabeler(ngGroups: { id: number; codes: string[]; name: string }[]) {
  return (groupId: number | null, i: number) => {
    const g = ngGroups.find((x) => x.id === groupId);
    return g ? g.codes[i] : `NG${i + 1}`;
  };
}

function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
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
        return { date: d.slice(5), qty: a.qty, ng: a.ng, ach: achievement(a.std, a.rated) };
      });
    const byMember = [...groupBy(facts, (f) => f.memberId).values()]
      .map((g) => ({ member: g.first.memberName, ...aggCols(g.agg, st) }))
      .sort((a, b) => (Number(b.ach) || 0) - (Number(a.ach) || 0));
    const ngMap = new Map<string, number>();
    for (const f of facts) f.ng.forEach((n, i) => n && ngMap.set(label(f.ngGroupId, i), (ngMap.get(label(f.ngGroupId, i)) ?? 0) + n));
    const topNg = [...ngMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ng, qty]) => ({ ng, qty }));
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
        { label: "Total Qty", value: t.qty, format: "int" },
        { label: "Total NG", value: t.ng, format: "int" },
        { label: "NG Rate", value: t.ngRate, format: "pct" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}` },
        { label: "Jam kerja (rated)", value: t.hours, format: "dec1" },
        { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
        { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
      ],
      charts: [
        { type: "line", title: "Tren harian: Qty", xKey: "date", series: [{ key: "qty", label: "Qty", format: "int" }], data: trend },
        { type: "line", title: "Tren harian: Achievement", xKey: "date", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: trend },
        { type: "bar", title: "Top NG", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: topNg },
        { type: "bar", title: "Lost Time + Another Job per jenis (jam)", xKey: "name", series: [{ key: "hours", label: "Jam", format: "dec1" }], data: ltRows },
      ],
      tables: [
        { title: "Per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: byCat },
        { title: "Top member (achievement)", columns: [{ key: "member", label: "Member" }, ...AGG_COLUMNS], rows: byMember.slice(0, 10) },
      ],
    };
  }

  if (kind === "daily") {
    const date = p.date ?? today;
    const { facts, lost } = await loadFacts(master, date, date, p.categoryId);
    const subs = await callBackend<RawSubmission[]>("queue", { date });
    const byMember = groupBy(facts, (f) => f.memberId);
    const rows: Row[] = master.members.map((m) => {
      const g = byMember.get(m.id);
      const ml = lost.filter((l) => l.memberId === m.id);
      const { lt, aj } = lostSplit(ml);
      const statuses = subs.filter((r) => r.member === m.name).map((r) => r.status);
      // Baris yang diisi langsung di sheet juga dihitung sudah lapor.
      const approved = statuses.includes("Disetujui") || !!g || ml.length > 0;
      const pending = statuses.includes("Menunggu");
      const ag = g ? aggCols(g.agg, st) : { qty: null, ng: null, ngRate: null, hours: null, stdHours: null, ach: null, grade: "-" };
      return {
        nik: m.nik,
        member: m.name,
        area: m.area,
        status: approved ? "Disetujui" : pending ? "Menunggu" : statuses.length ? "Ditolak" : "Belum lapor",
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
        { label: "Member lapor (disetujui)", value: `${reported} / ${rows.length}` },
        { label: "Belum lapor", value: rows.filter((r) => r.status === "Belum lapor").length, format: "int" },
        { label: "Total Qty", value: t.qty, format: "int" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}` },
      ],
      charts: [],
      tables: [
        {
          title: "Semua member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "area", label: "Area" },
            { key: "status", label: "Status" },
            ...AGG_COLUMNS,
            { key: "lostMin", label: "Lost Time (mnt)", format: "int" },
            { key: "ajMin", label: "Another Job (mnt)", format: "int" },
            { key: "util", label: "Utilisasi (mnt)", format: "int" },
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
        { label: "Total Qty", value: t.qty, format: "int" },
        { label: "Achievement", value: t.ach, format: "pct" },
        { label: "Grade periode", value: t.grade as string },
        { label: "Hari lapor", value: dayRows.length, format: "int" },
      ],
      charts: [
        { type: "bar", title: "Achievement per hari", xKey: "date", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: dayRows.map((r) => ({ ...r, date: String(r.date).slice(5) })) },
      ],
      tables: [
        {
          title: "Per hari",
          columns: [{ key: "date", label: "Tanggal" }, ...AGG_COLUMNS, { key: "lostMin", label: "Lost Time (mnt)", format: "int" }, { key: "ajMin", label: "Another Job (mnt)", format: "int" }],
          rows: dayRows,
          total: t,
        },
        { title: "Per part", columns: [{ key: "category", label: "Kategori" }, { key: "part", label: "Part" }, { key: "stki", label: "STKI", format: "int" }, ...AGG_COLUMNS], rows: partRows },
      ],
    };
  }

  if (kind === "category") {
    const { facts } = await loadFacts(master, from, to, p.categoryId);
    const catRows = [...groupBy(facts, (f) => f.categoryId).values()].map((g) => ({ category: g.first.categoryName, ...aggCols(g.agg, st) }));
    const partRows = [...groupBy(facts, (f) => f.partId).values()]
      .map((g) => ({ category: g.first.categoryName, part: g.first.part, stki: g.first.stki, ...aggCols(g.agg, st) }))
      .sort((a, b) => String(a.category).localeCompare(String(b.category)) || Number(b.qty) - Number(a.qty));
    return {
      ...base,
      subtitle: period,
      kpis: [],
      charts: [
        { type: "bar", title: "Achievement per kategori", xKey: "category", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: catRows },
      ],
      tables: [
        { title: "Per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: catRows, total: totalRow(facts, st, { category: "TOTAL" }) },
        { title: "Per part", columns: [{ key: "category", label: "Kategori" }, { key: "part", label: "Part" }, { key: "stki", label: "STKI", format: "int" }, ...AGG_COLUMNS], rows: partRows },
      ],
    };
  }

  if (kind === "machine") {
    const { facts } = await loadFacts(master, from, to, p.categoryId);
    const rows = [...groupBy(facts, (f) => `${f.categoryId}|${f.mcNo}`).values()]
      .map((g) => ({ category: g.first.categoryName, mcNo: g.first.mcNo, line: g.first.line, ...aggCols(g.agg, st) }))
      .sort((a, b) => Number(b.ng) - Number(a.ng));
    return {
      ...base,
      subtitle: period,
      kpis: [],
      charts: [{ type: "bar", title: "NG per mesin (tertinggi)", xKey: "mcNo", series: [{ key: "ng", label: "NG", format: "int" }], data: rows.slice(0, 15) }],
      tables: [
        {
          title: "Per MC No (urut NG tertinggi)",
          columns: [{ key: "category", label: "Kategori" }, { key: "mcNo", label: "MC No" }, { key: "line", label: "Line" }, ...AGG_COLUMNS],
          rows,
        },
      ],
    };
  }

  if (kind === "ng-type") {
    const { facts } = await loadFacts(master, from, to, p.categoryId);
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
    const trend = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, g]) => ({ date: d.slice(5), ng: g.agg.ng, ngRate: ngRate(g.agg.ng, g.agg.qty) }));
    return {
      ...base,
      subtitle: period,
      kpis: [{ label: "Total NG", value: total, format: "int" }],
      charts: [
        { type: "bar", title: "NG per jenis", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: rows.slice(0, 15) },
        { type: "line", title: "Tren NG harian", xKey: "date", series: [{ key: "ng", label: "NG", format: "int" }], data: trend },
      ],
      tables: [
        {
          title: "NG per jenis",
          columns: [
            { key: "group", label: "NG Group" },
            { key: "ng", label: "Jenis NG" },
            { key: "qty", label: "Qty NG", format: "int" },
            { key: "share", label: "Share", format: "pct" },
          ],
          rows,
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
            { key: "firstDate", label: "Tanggal pertama" },
            { key: "qty", label: "Qty", format: "int" },
            { key: "ng", label: "NG", format: "int" },
            { key: "ngRate", label: "NG Rate", format: "pct" },
            { key: "topNg", label: "NG terbanyak" },
          ],
          rows,
        },
      ],
    };
  }

  // monthly
  const month = p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : today.slice(0, 7);
  const mFrom = `${month}-01`;
  const mTo = monthEnd(mFrom);
  const { facts, lost } = await loadFacts(master, mFrom, mTo, p.categoryId);
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
      { label: "Total Qty", value: t.qty, format: "int" },
      { label: "Total NG", value: t.ng, format: "int" },
      { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}` },
      { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
      { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
    ],
    charts: [],
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
      { title: "Rekap per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: catRows },
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
  };
}
