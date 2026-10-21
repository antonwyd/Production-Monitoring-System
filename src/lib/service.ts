// Lapisan data: form, antrian leader, dan master. Semua data dibaca dan ditulis lewat
// Google Apps Script ke Google Sheet; di sini hanya validasi dan konversi id <-> nama.
import { callBackend, type RawItem, type RawLost, type RawMaster, type RawSubmission } from "./backend";
import { catId, ltId, mcId, memberId, ngGroupId, partId } from "./ids";
import { isBlankPartRow, validateSubmission } from "./rules";
import type { MasterData, SubmissionInput, SubmissionStatus, SubmissionView } from "./types";

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" "));
  }
}

// ---------- Master ----------

let masterCache: { at: number; data: MasterData } | null = null;
const MASTER_TTL = 60_000;

export function invalidateMaster() {
  masterCache = null;
}

export function masterFromRaw(raw: RawMaster): MasterData {
  const groups = new Map<string, string[]>();
  for (const c of raw.categories) if (c.ngGroup && !groups.has(c.ngGroup)) groups.set(c.ngGroup, c.ng);
  return {
    categories: raw.categories.map((c) => ({
      id: catId(c.name),
      name: c.name,
      process: c.process,
      area: c.process,
      ngGroupId: c.ngGroup ? ngGroupId(c.ngGroup) : null,
    })),
    parts: raw.parts.map((p) => ({ id: partId(p.category, p.name, p.type), categoryId: catId(p.category), name: p.name, type: p.type, stki: p.stki })),
    machines: raw.machines.map((m) => ({
      id: mcId(m.category, m.mc),
      categoryId: catId(m.category),
      mcNo: m.mc,
      line: m.line,
      mainPart: m.main,
      canSwitchTo: m.alt.replace(/[;\n]/g, ","),
    })),
    lostTimeTypes: raw.lostTypes.map((t) => ({ id: ltId(t.name), name: t.name, group: /another/i.test(t.group) ? "ANOTHER_JOB" : "LOST_TIME" })),
    members: raw.members.map((m) => ({ id: memberId(m.name), nik: m.nik, name: m.name, area: "" })),
    ngGroups: [...groups.entries()].map(([name, codes]) => ({
      id: ngGroupId(name),
      name,
      codes: Array.from({ length: 10 }, (_, i) => codes[i] || `NG${i + 1}`),
    })),
    settings: { ...raw.settings, stkiHighPct: 150, stkiLowPct: 30 },
  };
}

export async function loadMaster(opts: { fresh?: boolean } = {}): Promise<MasterData> {
  if (!opts.fresh && masterCache && Date.now() - masterCache.at < MASTER_TTL) return masterCache.data;
  const data = masterFromRaw(await callBackend<RawMaster>("master"));
  masterCache = { at: Date.now(), data };
  return data;
}

// ---------- Kiriman ----------

function sanitizeInput(raw: unknown): SubmissionInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (v === "" || v == null ? null : typeof v === "number" ? v : Number(v));
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    workDate: typeof r.workDate === "string" ? r.workDate : "",
    memberId: n(r.memberId),
    parts: arr(r.parts)
      .slice(0, 50)
      .map((p: Record<string, unknown>) => ({
        categoryId: n(p.categoryId),
        partId: n(p.partId),
        machineId: p.machineId === "-" ? ("-" as const) : n(p.machineId),
        qtyNormal: n(p.qtyNormal),
        minNormal: n(p.minNormal),
        qtyOt: n(p.qtyOt),
        minOt: n(p.minOt),
        lot: str(p.lot),
        oiban: str(p.oiban),
        ng: Array.from({ length: 10 }, (_, i) => n(arr(p.ng)[i])),
      }))
      .filter((p) => !isBlankPartRow(p)),
    lostTimes: arr(r.lostTimes)
      .slice(0, 50)
      .map((l: Record<string, unknown>) => ({
        lostTimeTypeId: n(l.lostTimeTypeId),
        minutes: n(l.minutes),
        note: str(l.note),
      }))
      .filter((l) => l.lostTimeTypeId != null || l.minutes != null),
  };
}

const STATUS_TO_SHEET: Record<SubmissionStatus, RawSubmission["status"]> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};
const STATUS_FROM_SHEET: Record<string, SubmissionStatus> = { Menunggu: "pending", Disetujui: "approved", Ditolak: "rejected" };

async function fetchQueue(f: { status?: SubmissionStatus; workDate?: string; member?: string }) {
  return callBackend<RawSubmission[]>("queue", {
    status: f.status ? STATUS_TO_SHEET[f.status] : "",
    date: f.workDate ?? "",
    member: f.member ?? "",
  });
}

export async function createSubmission(raw: unknown, opts: { submittedBy: string | null; forceMemberId?: number | null }) {
  const input = sanitizeInput(raw);
  if (opts.forceMemberId != null) {
    if (input.memberId != null && input.memberId !== opts.forceMemberId)
      throw new ValidationError(["Operator hanya bisa mengirim laporan atas nama sendiri."]);
    input.memberId = opts.forceMemberId;
  }
  const master = await loadMaster({ fresh: true });
  const member = master.members.find((m) => m.id === input.memberId);
  const dup =
    !!member && !!input.workDate && (await fetchQueue({ status: "approved", workDate: input.workDate, member: member.name })).length > 0;
  const v = validateSubmission(input, master, { hasApprovedSameDay: dup });
  if (v.errors.length) throw new ValidationError(v.errors);

  const num = (x: number | null) => (x == null ? "" : x);
  const items: RawItem[] = input.parts.map((p) => {
    const part = master.parts.find((x) => x.id === p.partId)!;
    const cat = master.categories.find((c) => c.id === part.categoryId)!;
    const mc = typeof p.machineId === "number" ? master.machines.find((m) => m.id === p.machineId)?.mcNo ?? "" : p.machineId === "-" ? "-" : "";
    return {
      category: cat.name,
      part: part.name,
      type: part.type,
      mc,
      normalQty: num(p.qtyNormal),
      normalMin: num(p.minNormal),
      otQty: num(p.qtyOt),
      otMin: num(p.minOt),
      lot: p.lot,
      oiban: p.oiban,
      ng: p.ng.map(num),
    };
  });
  const lostTimes: RawLost[] = input.lostTimes.map((l) => ({
    type: master.lostTimeTypes.find((t) => t.id === l.lostTimeTypeId)!.name,
    minutes: num(l.minutes),
    remarks: l.note,
  }));
  const res = await callBackend<{ id: string }>("submit", {
    payload: {
      date: input.workDate,
      member: member!.name,
      items,
      lostTimes,
      meta: { needsCheck: v.needsCheck, warnings: v.warnings, by: opts.submittedBy ?? "", via: "web" },
    },
  });
  return { id: res.id, warnings: v.warnings, needsCheck: v.needsCheck };
}

/** "2026-10-21 08:15" waktu Jakarta -> ISO. */
function jakartaIso(t: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t)) return null;
  return new Date(`${t.replace(" ", "T")}:00+07:00`).toISOString();
}

export function toView(s: RawSubmission, master: MasterData): SubmissionView {
  const n = (v: unknown) => Number(v) || 0;
  const parts = s.items.map((it) => {
    const cat = master.categories.find((c) => c.name === it.category);
    const codes = master.ngGroups.find((g) => g.id === cat?.ngGroupId)?.codes;
    return {
      categoryName: it.category,
      partName: it.part,
      type: it.type ?? "",
      mcNo: it.mc || "-",
      qtyNormal: n(it.normalQty),
      minNormal: n(it.normalMin),
      qtyOt: n(it.otQty),
      minOt: n(it.otMin),
      lot: it.lot ?? "",
      oiban: it.oiban ?? "",
      ng: (it.ng ?? []).map((q, i) => ({ label: codes?.[i] ?? `NG${i + 1}`, qty: n(q) })).filter((x) => x.qty > 0),
    };
  });
  const lostTimes = s.lostTimes.map((l) => ({
    name: l.type,
    group: master.lostTimeTypes.find((t) => t.name === l.type)?.group ?? "LOST_TIME",
    minutes: n(l.minutes),
    note: l.remarks ?? "",
  }));
  const warnings = [...(s.meta?.warnings ?? [])];
  if (s.edited) warnings.push(`Diedit oleh ${s.edited}.`);
  return {
    id: s.id,
    workDate: s.date,
    memberId: memberId(s.member),
    memberName: s.member,
    memberNik: master.members.find((m) => m.name === s.member)?.nik ?? "",
    submittedAt: jakartaIso(s.sent) ?? new Date(0).toISOString(),
    status: STATUS_FROM_SHEET[s.status] ?? "pending",
    leaderName: s.leader || null,
    decidedAt: jakartaIso(s.decided),
    leaderNote: s.note || null,
    needsCheck: !!s.meta?.needsCheck,
    warnings,
    parts,
    lostTimes,
    totals: {
      qty: parts.reduce((a, p) => a + p.qtyNormal + p.qtyOt, 0),
      minNormal: parts.reduce((a, p) => a + p.minNormal, 0),
      minOt: parts.reduce((a, p) => a + p.minOt, 0),
      lostMin: lostTimes.reduce((a, l) => a + l.minutes, 0),
      ng: parts.reduce((a, p) => a + p.ng.reduce((b, x) => b + x.qty, 0), 0),
    },
  };
}

export type SubmissionFilter = {
  status?: SubmissionStatus;
  workDate?: string;
  memberId?: number;
  limit?: number;
};

function sortViews(list: SubmissionView[], status?: SubmissionStatus) {
  return status === "pending"
    ? list.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    : list.sort((a, b) => (b.decidedAt ?? b.submittedAt).localeCompare(a.decidedAt ?? a.submittedAt));
}

export async function listSubmissions(f: SubmissionFilter): Promise<SubmissionView[]> {
  const master = await loadMaster();
  const member = f.memberId ? master.members.find((m) => m.id === f.memberId)?.name ?? "__none__" : "";
  const raw = await fetchQueue({ status: f.status, workDate: f.workDate, member });
  return sortViews(raw.map((s) => toView(s, master)), f.status).slice(0, f.limit ?? 100);
}

/** Antrian leader + jumlah per status dalam satu panggilan ke Apps Script. */
export async function queueOverview(status: SubmissionStatus, workDate?: string) {
  const [master, all] = await Promise.all([loadMaster(), fetchQueue({})]);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const s of all) counts[STATUS_FROM_SHEET[s.status] ?? "pending"]++;
  const items = all
    .filter((s) => (STATUS_FROM_SHEET[s.status] ?? "pending") === status && (!workDate || s.date === workDate))
    .map((s) => toView(s, master));
  return { items: sortViews(items, status).slice(0, status === "pending" ? 500 : 100), counts };
}

export type DecideResult = { id: string; ok: boolean; message?: string };

/**
 * Approve atau reject. Apps Script mengunci sheet, memproses hanya kiriman yang masih
 * Menunggu (R14), dan saat approve memvalidasi ulang terhadap Master Data (R13) lalu
 * menulis baris ke Input - Production / Input - Lost Time.
 */
export async function decide(opts: { ids: string[]; action: "approve" | "reject"; note?: string; leaderName: string; bulk?: boolean }): Promise<DecideResult[]> {
  const note = (opts.note ?? "").trim();
  if (opts.action === "reject" && !note) throw new ValidationError(["Alasan reject wajib diisi."]); // R12
  let ids = [...new Set(opts.ids)].slice(0, 200);
  const results: DecideResult[] = [];
  if (opts.action === "approve" && opts.bulk) {
    // R11: kiriman "Perlu dicek" tidak boleh ikut approve massal.
    const pending = await fetchQueue({ status: "pending" });
    const flagged = new Set(pending.filter((s) => s.meta?.needsCheck).map((s) => s.id));
    for (const id of ids.filter((x) => flagged.has(x))) results.push({ id, ok: false, message: "Perlu dicek: buka dan approve satu per satu." });
    ids = ids.filter((x) => !flagged.has(x));
  }
  if (ids.length) {
    const r = await callBackend<{ detail?: DecideResult[] }>("decide", {
      leader: opts.leaderName,
      ids,
      action: opts.action === "approve" ? "ok" : "no",
      note,
    });
    results.push(...(r.detail ?? []));
  }
  return results;
}
