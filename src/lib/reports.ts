// Semua report dihitung dari tab Input - Production dan Input - Lost Time di Google Sheet,
// yaitu kiriman yang sudah disetujui leader (plus baris yang diisi langsung di sheet).
import { callBackend, type RawRows, type RawSubmission } from "./backend";
import { catId, memberId as memberIdOf, partId as partIdOf } from "./ids";
import { achievement, grade, ngRate, partLabel } from "./rules";
import { addDays, formatDateId, monthEnd, monthStart } from "./dates";
import { loadMaster } from "./service";
import { uraiOiban } from "./sheets/qa";
import type { MasterData, Settings } from "./types";

export const REPORT_KINDS = ["dashboard", "daily", "member", "category", "machine", "ng-type", "ng-lot", "monthly", "waktu", "disiplin"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_TITLES: Record<ReportKind, string> = {
  dashboard: "Dashboard",
  daily: "Laporan Harian",
  member: "Laporan per Member",
  category: "Laporan per Kategori",
  machine: "Laporan Mesin PF",
  "ng-type": "Laporan Kualitas (NG)",
  "ng-lot": "Laporan NG per Lot",
  monthly: "Rekap Bulanan",
  waktu: "Laporan Waktu & Lost Time",
  disiplin: "Laporan Disiplin Lapor",
};

export type ColFormat = "text" | "int" | "dec1" | "dec2" | "pct" | "grade" | "date";
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
  /** Cari nomor lot atau oiban (report Kualitas). */
  q?: string;
};

export type Fact = {
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
  oiban: string;
  qty: number;
  qtyOt: number;
  minNormal: number;
  minOt: number;
  stki: number;
  /** Jam mesin jalan: menit MC (AM+AN) bila ada, baris lama/non-PF pakai menit orang. 0 bila tanpa MC. */
  mcHours: number;
  /** Standar MC PF (pcs/jam per MC) dari Master Data BI:BL, 0 bila belum diisi. */
  mcStd: number;
  /** Catatan member untuk NG "Lain-lain" (Input - Production kolom AW). */
  ngNote: string;
  ng: number[];
};

export type LostFact = { workDate: string; memberId: number; memberName: string; name: string; group: string; minutes: number; remarks: string };

const rowsCache = new Map<string, { at: number; data: Promise<RawRows> }>();
const ROWS_TTL = 60_000;

/** Data report disimpan 1 menit di server supaya pindah halaman/filter tidak selalu menunggu Google Sheet. */
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

export async function loadFacts(master: MasterData, from: string, to: string, categoryId?: number, memberId?: number, partId?: number) {
  const raw = await fetchRows(from, to);
  const nikOf = new Map(master.members.map((m) => [m.name, m.nik]));
  const catOf = new Map(master.categories.map((c) => [c.name, c]));
  const facts: Fact[] = [];
  for (const r of raw.prod) {
    const [workDate, member, category, part, type, , , , , lot, oiban, mc] = r.map(String);
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
      oiban: oiban === "-" ? "" : oiban,
      qty: n(5) + n(7),
      qtyOt: n(7),
      minNormal: n(6),
      minOt: n(8),
      stki: n(22) || master.parts.find((p) => p.id === pid)?.stki || 0,
      mcHours: mcNo === "-" ? 0 : r[23] === "" && r[24] === "" ? (n(6) + n(8)) / 60 : (n(23) + n(24)) / 60,
      mcStd: n(25),
      ngNote: String(r[26] ?? ""),
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
      memberName: String(r[1]),
      name,
      group: master.lostTimeTypes.find((t) => t.name === name)?.group ?? "LOST_TIME",
      minutes: Number(r[3]) || 0,
      remarks: String(r[4] ?? ""),
    });
  }
  return { facts, lost };
}

export type Agg = { qty: number; ng: number; rated: number; std: number; minNormal: number; minOt: number; count: number };
export const emptyAgg = (): Agg => ({ qty: 0, ng: 0, rated: 0, std: 0, minNormal: 0, minOt: 0, count: 0 });

export function add(a: Agg, f: Fact) {
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

export function groupBy<K extends string | number>(facts: Fact[], key: (f: Fact) => K) {
  const m = new Map<K, { first: Fact; agg: Agg }>();
  for (const f of facts) {
    const k = key(f);
    let g = m.get(k);
    if (!g) m.set(k, (g = { first: f, agg: emptyAgg() }));
    add(g.agg, f);
  }
  return m;
}

export function aggCols(a: Agg, st: Settings) {
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
  { key: "qty", label: "Hasil (pcs)", format: "int" },
  { key: "ng", label: "NG (pcs)", format: "int" },
  { key: "ngRate", label: "NG rate", format: "pct" },
  { key: "hours", label: "Jam kerja", format: "dec1" },
  { key: "stdHours", label: "Jam standar", format: "dec1" },
  { key: "ach", label: "Achievement", format: "pct" },
  { key: "grade", label: "Grade", format: "grade" },
];

function totalRow(facts: Fact[], st: Settings, label: Row): Row {
  const a = emptyAgg();
  facts.forEach((f) => add(a, f));
  return { ...label, ...aggCols(a, st) };
}

export function lostSplit(lost: LostFact[]) {
  let lt = 0,
    aj = 0;
  for (const l of lost) (l.group === "ANOTHER_JOB" ? (aj += l.minutes) : (lt += l.minutes));
  return { lt, aj };
}

export function ngLabeler(ngGroups: { id: number; codes: string[]; name: string }[]) {
  return (groupId: number | null, i: number) => {
    const g = ngGroups.find((x) => x.id === groupId);
    return g ? g.codes[i] : `NG${i + 1}`;
  };
}

export function dateRange(from: string, to: string) {
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
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
        { label: "NG (pcs)", value: t.ng, format: "int" },
        { label: "NG rate", value: t.ngRate, format: "pct" },
        { label: "Achievement", value: t.ach, format: "pct", hint: `Grade ${t.grade}` },
        { label: "Jam kerja (rated)", value: t.hours, format: "dec1" },
        { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
        { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
      ],
      charts: [
        { type: "line", title: "Hasil per hari (pcs)", xKey: "date", series: [{ key: "qty", label: "Hasil", format: "int" }], data: trend },
        { type: "line", title: "Achievement per hari", xKey: "date", series: [{ key: "ach", label: "Achievement", format: "pct" }], data: trend },
        { type: "bar", title: "NG terbanyak", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: topNg },
        { type: "bar", title: "Lost Time & Another Job per jenis (jam)", xKey: "name", series: [{ key: "hours", label: "Jam", format: "dec1" }], data: ltRows },
      ],
      tables: [
        { title: "Per kategori", columns: [{ key: "category", label: "Kategori" }, ...AGG_COLUMNS], rows: byCat },
        { title: "Member dengan achievement tertinggi", columns: [{ key: "member", label: "Member" }, ...AGG_COLUMNS], rows: byMember.slice(0, 10) },
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
        { label: "Sudah lapor (disetujui)", value: `${reported} / ${rows.length}` },
        { label: "Belum lapor", value: rows.filter((r) => r.status === "Belum lapor").length, format: "int" },
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
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
            { key: "util", label: "Total menit", format: "int" },
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
        { label: "Hasil (pcs)", value: t.qty, format: "int" },
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
          columns: [{ key: "date", label: "Tanggal", format: "date" }, ...AGG_COLUMNS, { key: "lostMin", label: "Lost Time (mnt)", format: "int" }, { key: "ajMin", label: "Another Job (mnt)", format: "int" }],
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
    // Sama dengan tab Report - Machine di Sheet: jam MC jalan per mesin dan Standar MC PF (bukan STKI part).
    const { facts } = await loadFacts(master, from, to, p.categoryId);
    const rows = [...groupBy(facts, (f) => `${f.categoryId}|${f.mcNo}`).values()]
      .map((g) => {
        const fs = facts.filter((f) => f.categoryId === g.first.categoryId && f.mcNo === g.first.mcNo);
        let mcHours = 0,
          stdHours = 0,
          ratedHours = 0;
        for (const f of fs) {
          mcHours += f.mcHours;
          if (f.mcStd > 0) {
            stdHours += f.qty / f.mcStd;
            ratedHours += f.mcHours;
          }
        }
        return {
          category: g.first.categoryName,
          mcNo: g.first.mcNo,
          line: g.first.line,
          qty: g.agg.qty,
          ng: g.agg.ng,
          ngRate: ngRate(g.agg.ng, g.agg.qty),
          mcHours,
          pcsHr: mcHours > 0 ? g.agg.qty / mcHours : null,
          stdHours: ratedHours > 0 ? stdHours : null,
          eff: ratedHours > 0 ? stdHours / ratedHours : null,
        };
      })
      .sort((a, b) => Number(b.ng) - Number(a.ng));
    return {
      ...base,
      subtitle: period,
      kpis: [],
      charts: [{ type: "bar", title: "NG per mesin (tertinggi)", xKey: "mcNo", series: [{ key: "ng", label: "NG", format: "int" }], data: rows.slice(0, 15) }],
      tables: [
        {
          title: "Per mesin (urut NG tertinggi)",
          columns: [
            { key: "category", label: "Kategori" },
            { key: "mcNo", label: "Mesin" },
            { key: "line", label: "Line" },
            { key: "qty", label: "Hasil (pcs)", format: "int" },
            { key: "ng", label: "NG (pcs)", format: "int" },
            { key: "ngRate", label: "NG rate", format: "pct" },
            { key: "mcHours", label: "Jam mesin jalan", format: "dec1" },
            { key: "pcsHr", label: "Hasil per jam", format: "dec1" },
            { key: "stdHours", label: "Jam standar MC", format: "dec1" },
            { key: "eff", label: "Efisiensi", format: "pct" },
          ],
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
    // Kualitas = jenis NG + NG per lot dalam satu halaman.
    const lotTable = (await buildReport("ng-lot", p, today)).tables[0];
    // Matriks part x jenis NG: 8 jenis NG terbanyak jadi kolom, sisanya "Lainnya".
    const topNames = [...new Set(rows.map((r) => r.ng))].slice(0, 8);
    const matrix = [...groupBy(facts, (f) => f.partId).values()]
      .map((g) => {
        const out: Row = { part: g.first.part, category: g.first.categoryName, qty: g.agg.qty, ng: g.agg.ng, ngRate: ngRate(g.agg.ng, g.agg.qty), other: 0 };
        topNames.forEach((_, j) => (out[`n${j}`] = 0));
        for (const f of facts.filter((x) => x.partId === g.first.partId))
          f.ng.forEach((n, i) => {
            if (!n) return;
            const j = topNames.indexOf(label(f.ngGroupId, i));
            const k = j >= 0 ? `n${j}` : "other";
            out[k] = Number(out[k]) + n;
          });
        return out;
      })
      .filter((r) => Number(r.ng) > 0)
      .sort((a, b) => Number(b.ng) - Number(a.ng));
    const matrixTable: Table = {
      title: "Part x jenis NG",
      columns: [
        { key: "part", label: "Part" },
        { key: "category", label: "Kategori" },
        { key: "qty", label: "Hasil (pcs)", format: "int" },
        { key: "ng", label: "NG (pcs)", format: "int" },
        { key: "ngRate", label: "NG rate", format: "pct" },
        ...topNames.map((n, j) => ({ key: `n${j}`, label: n, format: "int" as const })),
        ...(matrix.some((r) => Number(r.other) > 0) ? [{ key: "other", label: "Lainnya", format: "int" as const }] : []),
      ],
      rows: matrix,
    };
    const ngDetail = (f: Fact) =>
      f.ng
        .map((n, i) => (n ? `${label(f.ngGroupId, i)} ${n}` : ""))
        .filter(Boolean)
        .join(", ");
    const search: Table[] = [];
    if (p.q) {
      const q = p.q.toLowerCase();
      const hits = facts.filter((f) => f.lot.toLowerCase().includes(q) || (f.oiban && uraiOiban(f.oiban).list.includes(p.q!)));
      search.push({
        title: `Hasil cari lot / oiban "${p.q}"`,
        columns: [
          { key: "date", label: "Tanggal", format: "date" },
          { key: "member", label: "Member" },
          { key: "part", label: "Part" },
          { key: "mc", label: "Mesin" },
          { key: "lot", label: "Lot" },
          { key: "oiban", label: "Oiban" },
          { key: "qty", label: "Hasil (pcs)", format: "int" },
          { key: "ng", label: "NG (pcs)", format: "int" },
          { key: "detail", label: "Rincian NG" },
        ],
        rows: hits
          .sort((a, b) => a.workDate.localeCompare(b.workDate))
          .map((f) => ({ date: f.workDate, member: f.memberName, part: f.part, mc: f.mcNo, lot: f.lot, oiban: f.oiban, qty: f.qty, ng: f.ng.reduce((a, v) => a + v, 0), detail: ngDetail(f) })),
      });
    }
    return {
      ...base,
      subtitle: period,
      kpis: [{ label: "NG (pcs)", value: total, format: "int" }],
      charts: [
        { type: "bar", title: "NG per jenis", xKey: "ng", series: [{ key: "qty", label: "NG", format: "int" }], data: rows.slice(0, 15) },
        { type: "line", title: "Tren NG harian", xKey: "date", series: [{ key: "ng", label: "NG", format: "int" }], data: trend },
      ],
      tables: [
        ...search,
        {
          title: "NG per jenis",
          columns: [
            { key: "group", label: "Grup NG" },
            { key: "ng", label: "Jenis NG" },
            { key: "qty", label: "NG (pcs)", format: "int" },
            { key: "share", label: "Porsi", format: "pct" },
          ],
          rows,
        },
        matrixTable,
        lotTable,
        {
          title: "Catatan NG Lain-lain",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "part", label: "Part" },
            { key: "lot", label: "Lot" },
            { key: "qty", label: "NG Lain-lain", format: "int" },
            { key: "note", label: "Catatan" },
          ],
          rows: facts
            .filter((f) => f.ngNote)
            .map((f) => ({ date: f.workDate, member: f.memberName, part: f.part, lot: f.lot, qty: f.ng.reduce((a, v, i) => (/^lain/i.test(label(f.ngGroupId, i)) ? a + v : a), 0), note: f.ngNote })),
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
            { key: "firstDate", label: "Tanggal pertama", format: "date" },
            { key: "qty", label: "Hasil (pcs)", format: "int" },
            { key: "ng", label: "NG (pcs)", format: "int" },
            { key: "ngRate", label: "NG rate", format: "pct" },
            { key: "topNg", label: "NG terbanyak" },
          ],
          rows,
        },
      ],
    };
  }

  if (kind === "waktu") {
    const { facts, lost: allLost } = await loadFacts(master, from, to, p.categoryId);
    // Bila kategori dipilih, lost time hanya dari member-hari yang bekerja di kategori itu.
    const dayKey = (d: string, m: number) => `${d}|${m}`;
    const worked = new Set(facts.map((f) => dayKey(f.workDate, f.memberId)));
    const lost = p.categoryId ? allLost.filter((l) => worked.has(dayKey(l.workDate, l.memberId))) : allLost;
    // STKI rata-rata (berbobot menit) per member-hari, untuk menghitung potensi hasil yang hilang.
    const stkiDay = new Map<string, { w: number; min: number }>();
    for (const f of facts) {
      if (!f.stki) continue;
      const k = dayKey(f.workDate, f.memberId);
      const e = stkiDay.get(k) ?? { w: 0, min: 0 };
      e.w += f.stki * (f.minNormal + f.minOt);
      e.min += f.minNormal + f.minOt;
      stkiDay.set(k, e);
    }
    const pcsLost = (l: LostFact) => {
      if (l.group === "ANOTHER_JOB") return 0;
      const e = stkiDay.get(dayKey(l.workDate, l.memberId));
      return e && e.min ? (l.minutes / 60) * (e.w / e.min) : 0;
    };
    const { lt, aj } = lostSplit(lost);
    const workMin = facts.reduce((a, f) => a + f.minNormal, 0);
    const otMin = facts.reduce((a, f) => a + f.minOt, 0);
    const totalPcsLost = lost.reduce((a, l) => a + pcsLost(l), 0);

    const byType = new Map<string, { name: string; group: string; minutes: number; count: number; pcs: number }>();
    for (const l of lost) {
      const e = byType.get(l.name) ?? { name: l.name, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", minutes: 0, count: 0, pcs: 0 };
      e.minutes += l.minutes;
      e.count++;
      e.pcs += pcsLost(l);
      byType.set(l.name, e);
    }
    const typeRows = [...byType.values()]
      .sort((a, b) => b.minutes - a.minutes)
      .map((e) => ({ name: e.name, group: e.group, hours: e.minutes / 60, count: e.count, pcs: e.group === "Lost Time" ? Math.round(e.pcs) : null, share: lt + aj ? e.minutes / (lt + aj) : null }));

    const members = new Map<number, Row & { member: string }>();
    const mrow = (id: number, name: string) => {
      let r = members.get(id);
      if (!r) members.set(id, (r = { member: name, nik: master.members.find((m) => m.name === name)?.nik ?? "", days: 0, workHrs: 0, otHrs: 0, ltHrs: 0, ajHrs: 0, pcs: 0 }));
      return r;
    };
    for (const f of facts) {
      const r = mrow(f.memberId, f.memberName);
      r.workHrs = Number(r.workHrs) + f.minNormal / 60;
      r.otHrs = Number(r.otHrs) + f.minOt / 60;
    }
    for (const l of lost) {
      const r = mrow(l.memberId, l.memberName);
      if (l.group === "ANOTHER_JOB") r.ajHrs = Number(r.ajHrs) + l.minutes / 60;
      else r.ltHrs = Number(r.ltHrs) + l.minutes / 60;
      r.pcs = Number(r.pcs) + pcsLost(l);
    }
    for (const [id, r] of members) r.days = new Set([...facts.filter((f) => f.memberId === id).map((f) => f.workDate), ...lost.filter((l) => l.memberId === id).map((l) => l.workDate)]).size;
    const memberRows: Row[] = [...members.values()].sort((a, b) => Number(b.ltHrs) - Number(a.ltHrs)).map((r) => ({ ...r, pcs: Math.round(Number(r.pcs)) }));

    // Tren per minggu (Senin) supaya hasil perbaikan kelihatan.
    const weekOf = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
    const weeks = new Map<string, { lt: number; aj: number; ot: number }>();
    for (const l of lost) {
      const w = weeks.get(weekOf(l.workDate)) ?? { lt: 0, aj: 0, ot: 0 };
      if (l.group === "ANOTHER_JOB") w.aj += l.minutes;
      else w.lt += l.minutes;
      weeks.set(weekOf(l.workDate), w);
    }
    for (const f of facts) {
      const w = weeks.get(weekOf(f.workDate)) ?? { lt: 0, aj: 0, ot: 0 };
      w.ot += f.minOt;
      weeks.set(weekOf(f.workDate), w);
    }
    const weekRows = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([w, e]) => ({ week: `${formatDateId(w).slice(0, -5)}`, ltHrs: e.lt / 60, ajHrs: e.aj / 60, otHrs: e.ot / 60 }));

    return {
      ...base,
      subtitle: period,
      kpis: [
        { label: "Lost Time (jam)", value: lt / 60, format: "dec1" },
        { label: "Potensi hasil hilang (pcs)", value: Math.round(totalPcsLost), format: "int", hint: "Lost Time x STKI part hari itu" },
        { label: "Another Job (jam)", value: aj / 60, format: "dec1" },
        { label: "Jam lembur (OT)", value: otMin / 60, format: "dec1" },
        { label: "Porsi lost time", value: workMin + lt + aj ? lt / (workMin + lt + aj) : null, format: "pct", hint: "dari total jam normal" },
      ],
      charts: [
        { type: "bar", title: "Lost Time & Another Job per jenis (jam)", xKey: "name", series: [{ key: "hours", label: "Jam", format: "dec1" }], data: typeRows.slice(0, 12) },
        { type: "line", title: "Lost Time per minggu (jam)", xKey: "week", series: [{ key: "ltHrs", label: "Lost Time", format: "dec1" }], data: weekRows },
      ],
      tables: [
        {
          title: "Per jenis",
          columns: [
            { key: "name", label: "Jenis" },
            { key: "group", label: "Grup" },
            { key: "hours", label: "Jam", format: "dec1" },
            { key: "count", label: "Kejadian", format: "int" },
            { key: "share", label: "Porsi", format: "pct" },
            { key: "pcs", label: "Potensi hilang (pcs)", format: "int" },
          ],
          rows: typeRows,
        },
        {
          title: "Per member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "days", label: "Hari", format: "int" },
            { key: "workHrs", label: "Jam kerja normal", format: "dec1" },
            { key: "otHrs", label: "Jam OT", format: "dec1" },
            { key: "ltHrs", label: "Lost Time (jam)", format: "dec1" },
            { key: "ajHrs", label: "Another Job (jam)", format: "dec1" },
            { key: "pcs", label: "Potensi hilang (pcs)", format: "int" },
          ],
          rows: memberRows,
          total: { member: "TOTAL", workHrs: workMin / 60, otHrs: otMin / 60, ltHrs: lt / 60, ajHrs: aj / 60, pcs: Math.round(totalPcsLost) },
        },
        {
          title: "Per minggu",
          columns: [
            { key: "week", label: "Minggu mulai" },
            { key: "ltHrs", label: "Lost Time (jam)", format: "dec1" },
            { key: "ajHrs", label: "Another Job (jam)", format: "dec1" },
            { key: "otHrs", label: "Jam OT", format: "dec1" },
          ],
          rows: weekRows,
        },
        {
          title: "Rincian lost time",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "group", label: "Grup" },
            { key: "name", label: "Jenis" },
            { key: "minutes", label: "Menit", format: "int" },
            { key: "remarks", label: "Keterangan" },
          ],
          rows: [...lost]
            .sort((a, b) => b.workDate.localeCompare(a.workDate) || a.memberName.localeCompare(b.memberName))
            .map((l) => ({ date: l.workDate, member: l.memberName, group: l.group === "ANOTHER_JOB" ? "Another Job" : "Lost Time", name: l.name, minutes: l.minutes, remarks: l.remarks })),
        },
      ],
    };
  }

  if (kind === "disiplin") {
    const all = await callBackend<RawSubmission[]>("queue", {});
    const subs = all.filter((s) => s.date >= from && s.date <= to);
    const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
    const hoursBetween = (a: string, b: string) => (Date.parse(`${b.replace(" ", "T")}:00Z`) - Date.parse(`${a.replace(" ", "T")}:00Z`)) / 36e5;
    const workDays = [...new Set(subs.map((s) => s.date))].sort();
    type M = { member: string; sent: number; sameDay: number; nextDay: number; later: number; rejected: number; days: Set<string>; first: string };
    const per = new Map<string, M>();
    for (const s of subs) {
      const m = per.get(s.member) ?? { member: s.member, sent: 0, sameDay: 0, nextDay: 0, later: 0, rejected: 0, days: new Set<string>(), first: s.date };
      m.sent++;
      const late = dayDiff(s.date, s.sent);
      if (late <= 0) m.sameDay++;
      else if (late === 1) m.nextDay++;
      else m.later++;
      if (s.status === "Ditolak") m.rejected++;
      m.days.add(s.date);
      if (s.date < m.first) m.first = s.date;
      per.set(s.member, m);
    }
    const memberRows = [...per.values()]
      .map((m) => {
        // Hari tidak lapor: hari kerja (ada kiriman dari siapa pun) sejak member pertama lapor di periode ini.
        const expected = workDays.filter((d) => d >= m.first).length;
        return {
          nik: master.members.find((x) => x.name === m.member)?.nik ?? "",
          member: m.member,
          sent: m.sent,
          sameDay: m.sameDay,
          nextDay: m.nextDay,
          later: m.later,
          onTime: m.sent ? m.sameDay / m.sent : null,
          rejected: m.rejected,
          missing: Math.max(0, expected - m.days.size),
        };
      })
      .sort((a, b) => (a.onTime ?? 1) - (b.onTime ?? 1) || b.missing - a.missing);
    const decided = subs.filter((s) => s.status !== "Menunggu" && s.decided && s.sent);
    const avgHrs = decided.length ? decided.reduce((a, s) => a + Math.max(0, hoursBetween(s.sent, s.decided)), 0) / decided.length : null;
    const sameDay = subs.filter((s) => dayDiff(s.date, s.sent) <= 0).length;
    const rejected = subs.filter((s) => s.status === "Ditolak");
    const waiting = subs.filter((s) => s.status === "Menunggu");
    const byDay = workDays.map((d) => {
      const ds = subs.filter((s) => s.date === d);
      return {
        date: d,
        sent: ds.length,
        approved: ds.filter((s) => s.status === "Disetujui").length,
        waiting: ds.filter((s) => s.status === "Menunggu").length,
        rejected: ds.filter((s) => s.status === "Ditolak").length,
      };
    });
    return {
      ...base,
      subtitle: `${formatDateId(from)} – ${formatDateId(to)} · dari semua kiriman (termasuk yang belum/ditolak)`,
      kpis: [
        { label: "Kiriman", value: subs.length, format: "int" },
        { label: "Dikirim di hari yang sama", value: subs.length ? sameDay / subs.length : null, format: "pct" },
        { label: "Ditolak leader", value: rejected.length, format: "int" },
        { label: "Rata-rata waktu validasi (jam)", value: avgHrs, format: "dec1" },
        { label: "Masih menunggu", value: waiting.length, format: "int" },
      ],
      charts: [
        { type: "bar", title: "Kirim di hari yang sama per member", xKey: "member", series: [{ key: "onTime", label: "Tepat hari itu", format: "pct" }], data: memberRows.slice(0, 20) },
      ],
      tables: [
        {
          title: "Per member",
          columns: [
            { key: "nik", label: "NIK" },
            { key: "member", label: "Member" },
            { key: "sent", label: "Kiriman", format: "int" },
            { key: "sameDay", label: "Hari yang sama", format: "int" },
            { key: "nextDay", label: "H+1", format: "int" },
            { key: "later", label: "Lebih dari H+1", format: "int" },
            { key: "onTime", label: "Tepat waktu", format: "pct" },
            { key: "rejected", label: "Ditolak", format: "int" },
            { key: "missing", label: "Hari tidak lapor", format: "int" },
          ],
          rows: memberRows,
        },
        {
          title: "Alasan penolakan",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "member", label: "Member" },
            { key: "leader", label: "Leader" },
            { key: "note", label: "Alasan" },
          ],
          rows: rejected.sort((a, b) => b.date.localeCompare(a.date)).map((s) => ({ date: s.date, member: s.member, leader: s.leader, note: s.note })),
        },
        {
          title: "Per hari",
          columns: [
            { key: "date", label: "Tanggal", format: "date" },
            { key: "sent", label: "Kiriman", format: "int" },
            { key: "approved", label: "Disetujui", format: "int" },
            { key: "waiting", label: "Menunggu", format: "int" },
            { key: "rejected", label: "Ditolak", format: "int" },
          ],
          rows: byDay.reverse(),
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
      { label: "Hasil (pcs)", value: t.qty, format: "int" },
      { label: "NG (pcs)", value: t.ng, format: "int" },
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
    q: get("q")?.trim().slice(0, 40) || undefined,
  };
}
