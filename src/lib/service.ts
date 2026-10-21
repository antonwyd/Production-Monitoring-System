// Lapisan data: semua akses database untuk form, antrian leader, dan master.
// Tidak bergantung pada request/cookie sehingga bisa dites langsung.
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { NG_KEYS } from "@/db/schema";
import { newSubmissionId } from "./dates";
import { isBlankPartRow, settingsFromRows, validateSubmission } from "./rules";
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

export async function loadMaster(db: DB, opts: { fresh?: boolean } = {}): Promise<MasterData> {
  if (!opts.fresh && masterCache && Date.now() - masterCache.at < MASTER_TTL) return masterCache.data;
  const [categories, parts, machines, lostTimeTypes, members, groups, codes, settingRows] = await Promise.all([
    db.select().from(s.categories).where(eq(s.categories.active, true)).orderBy(asc(s.categories.id)),
    db.select().from(s.parts).where(eq(s.parts.active, true)).orderBy(asc(s.parts.name), asc(s.parts.type)),
    db.select().from(s.machines).where(eq(s.machines.active, true)).orderBy(asc(s.machines.id)),
    db.select().from(s.lostTimeTypes).where(eq(s.lostTimeTypes.active, true)).orderBy(asc(s.lostTimeTypes.id)),
    db.select().from(s.members).where(eq(s.members.active, true)).orderBy(asc(s.members.name)),
    db.select().from(s.ngGroups).orderBy(asc(s.ngGroups.id)),
    db.select().from(s.ngCodes).orderBy(asc(s.ngCodes.code)),
    db.select().from(s.settings),
  ]);
  const data: MasterData = {
    categories: categories.map(({ id, name, process, area, ngGroupId }) => ({ id, name, process, area, ngGroupId })),
    parts: parts.map(({ id, categoryId, name, type, stki }) => ({ id, categoryId, name, type, stki })),
    machines: machines.map(({ id, categoryId, mcNo, line, mainPart, canSwitchTo }) => ({
      id,
      categoryId,
      mcNo,
      line,
      mainPart,
      canSwitchTo,
    })),
    lostTimeTypes: lostTimeTypes.map(({ id, name, group }) => ({ id, name, group })),
    members: members.map(({ id, nik, name, area }) => ({ id, nik, name, area })),
    ngGroups: groups.map((g) => {
      const names = Array.from({ length: 10 }, (_, i) => `NG${i + 1}`);
      for (const c of codes) if (c.ngGroupId === g.id && c.code >= 1 && c.code <= 10) names[c.code - 1] = c.name;
      return { id: g.id, name: g.name, codes: names };
    }),
    settings: settingsFromRows(settingRows),
  };
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

async function hasApprovedSameDay(db: DB, memberId: number | null, workDate: string) {
  if (memberId == null || !workDate) return false;
  const rows = await db
    .select({ id: s.submissions.id })
    .from(s.submissions)
    .where(and(eq(s.submissions.memberId, memberId), eq(s.submissions.workDate, workDate), eq(s.submissions.status, "approved")))
    .limit(1);
  return rows.length > 0;
}

export async function createSubmission(db: DB, raw: unknown, opts: { submittedBy: number | null; forceMemberId?: number | null }) {
  const input = sanitizeInput(raw);
  if (opts.forceMemberId != null) {
    if (input.memberId != null && input.memberId !== opts.forceMemberId)
      throw new ValidationError(["Operator hanya bisa mengirim laporan atas nama sendiri."]);
    input.memberId = opts.forceMemberId;
  }
  const master = await loadMaster(db, { fresh: true });
  const dup = await hasApprovedSameDay(db, input.memberId, input.workDate);
  const v = validateSubmission(input, master, { hasApprovedSameDay: dup });
  if (v.errors.length) throw new ValidationError(v.errors);

  const id = newSubmissionId();
  await db.transaction(async (tx) => {
    await tx.insert(s.submissions).values({
      id,
      workDate: input.workDate,
      memberId: input.memberId!,
      submittedBy: opts.submittedBy,
      needsCheck: v.needsCheck,
      warnings: v.warnings,
    });
    if (input.parts.length)
      await tx.insert(s.productionRows).values(
        input.parts.map((p) => ({
          submissionId: id,
          partId: p.partId!,
          machineId: typeof p.machineId === "number" ? p.machineId : null,
          qtyNormal: p.qtyNormal ?? 0,
          minNormal: p.minNormal ?? 0,
          qtyOt: p.qtyOt ?? 0,
          minOt: p.minOt ?? 0,
          lot: p.lot,
          oiban: p.oiban,
          ...Object.fromEntries(NG_KEYS.map((k, i) => [k, p.ng[i] ?? 0])),
        })),
      );
    if (input.lostTimes.length)
      await tx.insert(s.lostTimeRows).values(
        input.lostTimes.map((l) => ({ submissionId: id, lostTimeTypeId: l.lostTimeTypeId!, minutes: l.minutes!, note: l.note })),
      );
  });
  return { id, warnings: v.warnings, needsCheck: v.needsCheck };
}

export type SubmissionFilter = {
  status?: SubmissionStatus;
  workDate?: string;
  memberId?: number;
  area?: string; // area leader; kosong = semua
  ids?: string[];
  limit?: number;
};

export async function listSubmissions(db: DB, f: SubmissionFilter): Promise<SubmissionView[]> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(s.submissions.status, f.status));
  if (f.workDate) conds.push(eq(s.submissions.workDate, f.workDate));
  if (f.memberId) conds.push(eq(s.submissions.memberId, f.memberId));
  if (f.area) conds.push(eq(s.members.area, f.area));
  if (f.ids) conds.push(inArray(s.submissions.id, f.ids.length ? f.ids : ["__none__"]));
  const order =
    f.status === "pending" ? [asc(s.submissions.submittedAt)] : [desc(sql`coalesce(${s.submissions.decidedAt}, ${s.submissions.submittedAt})`)];
  const leader = sql<string | null>`(select name from users where users.id = ${s.submissions.leaderId})`;
  const subs = await db
    .select({
      id: s.submissions.id,
      workDate: s.submissions.workDate,
      memberId: s.submissions.memberId,
      memberName: s.members.name,
      memberNik: s.members.nik,
      submittedAt: s.submissions.submittedAt,
      status: s.submissions.status,
      leaderName: leader,
      decidedAt: s.submissions.decidedAt,
      leaderNote: s.submissions.leaderNote,
      needsCheck: s.submissions.needsCheck,
      warnings: s.submissions.warnings,
    })
    .from(s.submissions)
    .innerJoin(s.members, eq(s.members.id, s.submissions.memberId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...order)
    .limit(f.limit ?? 100);
  if (!subs.length) return [];
  const ids = subs.map((x) => x.id);

  const prod = await db
    .select({
      submissionId: s.productionRows.submissionId,
      row: s.productionRows,
      partName: s.parts.name,
      type: s.parts.type,
      categoryName: s.categories.name,
      ngGroupId: s.categories.ngGroupId,
      mcNo: s.machines.mcNo,
    })
    .from(s.productionRows)
    .innerJoin(s.parts, eq(s.parts.id, s.productionRows.partId))
    .innerJoin(s.categories, eq(s.categories.id, s.parts.categoryId))
    .leftJoin(s.machines, eq(s.machines.id, s.productionRows.machineId))
    .where(inArray(s.productionRows.submissionId, ids))
    .orderBy(asc(s.productionRows.id));
  const lost = await db
    .select({ submissionId: s.lostTimeRows.submissionId, row: s.lostTimeRows, name: s.lostTimeTypes.name, group: s.lostTimeTypes.group })
    .from(s.lostTimeRows)
    .innerJoin(s.lostTimeTypes, eq(s.lostTimeTypes.id, s.lostTimeRows.lostTimeTypeId))
    .where(inArray(s.lostTimeRows.submissionId, ids))
    .orderBy(asc(s.lostTimeRows.id));
  const codes = await db.select().from(s.ngCodes);
  const ngName = (g: number | null, code: number) => codes.find((c) => c.ngGroupId === g && c.code === code)?.name ?? `NG${code}`;

  return subs.map((x) => {
    const parts = prod
      .filter((p) => p.submissionId === x.id)
      .map((p) => ({
        categoryName: p.categoryName,
        partName: p.partName,
        type: p.type,
        mcNo: p.mcNo ?? "-",
        qtyNormal: p.row.qtyNormal,
        minNormal: p.row.minNormal,
        qtyOt: p.row.qtyOt,
        minOt: p.row.minOt,
        lot: p.row.lot,
        oiban: p.row.oiban,
        ng: NG_KEYS.map((k, i) => ({ label: ngName(p.ngGroupId, i + 1), qty: p.row[k] })).filter((n) => n.qty > 0),
      }));
    const lostTimes = lost
      .filter((l) => l.submissionId === x.id)
      .map((l) => ({ name: l.name, group: l.group, minutes: l.row.minutes, note: l.row.note }));
    return {
      ...x,
      submittedAt: new Date(x.submittedAt).toISOString(),
      decidedAt: x.decidedAt ? new Date(x.decidedAt).toISOString() : null,
      parts,
      lostTimes,
      totals: {
        qty: parts.reduce((a, p) => a + p.qtyNormal + p.qtyOt, 0),
        minNormal: parts.reduce((a, p) => a + p.minNormal, 0),
        minOt: parts.reduce((a, p) => a + p.minOt, 0),
        lostMin: lostTimes.reduce((a, l) => a + l.minutes, 0),
        ng: parts.reduce((a, p) => a + p.ng.reduce((b, n) => b + n.qty, 0), 0),
      },
    };
  });
}

export async function countByStatus(db: DB, area: string) {
  const rows = await db
    .select({ status: s.submissions.status, n: sql<number>`count(*)::int` })
    .from(s.submissions)
    .innerJoin(s.members, eq(s.members.id, s.submissions.memberId))
    .where(area ? eq(s.members.area, area) : undefined)
    .groupBy(s.submissions.status);
  const out = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

export type DecideResult = { id: string; ok: boolean; message?: string };

/**
 * Approve atau reject. Tiap kiriman diproses dalam transaksi sendiri dengan
 * SELECT ... FOR UPDATE, dan hanya status pending yang bisa diputuskan (R14).
 */
export async function decide(
  db: DB,
  opts: { ids: string[]; action: "approve" | "reject"; note?: string; leaderId: number; area: string; bulk?: boolean },
): Promise<DecideResult[]> {
  const note = (opts.note ?? "").trim();
  if (opts.action === "reject" && !note) throw new ValidationError(["Alasan reject wajib diisi."]); // R12
  const results: DecideResult[] = [];
  for (const id of [...new Set(opts.ids)].slice(0, 200)) {
    try {
      const r = await db.transaction(async (tx) => {
        const locked = await tx.execute(sql`select s.id, s.status, s.needs_check, m.area from submissions s join members m on m.id = s.member_id where s.id = ${id} for update of s`);
        const row = locked.rows[0] as { id: string; status: string; needs_check: boolean; area: string } | undefined;
        if (!row) return { id, ok: false, message: "Kiriman tidak ditemukan." };
        if (opts.area && row.area !== opts.area) return { id, ok: false, message: "Kiriman di luar area Anda." };
        if (row.status !== "pending") return { id, ok: false, message: "Sudah diputuskan sebelumnya." };
        if (opts.action === "approve" && opts.bulk && row.needs_check)
          return { id, ok: false, message: "Perlu dicek: buka dan approve satu per satu." }; // R11

        if (opts.action === "approve") {
          // R13: validasi ulang terhadap master saat approve, lalu snapshot STKI.
          const prods = await tx
            .select({ id: s.productionRows.id, partActive: s.parts.active, stki: s.parts.stki, catActive: s.categories.active, partName: s.parts.name })
            .from(s.productionRows)
            .innerJoin(s.parts, eq(s.parts.id, s.productionRows.partId))
            .innerJoin(s.categories, eq(s.categories.id, s.parts.categoryId))
            .where(eq(s.productionRows.submissionId, id));
          const bad = prods.find((p) => !p.partActive || !p.catActive);
          if (bad) return { id, ok: false, message: `Part ${bad.partName} sudah tidak aktif di master.` };
          const lts = await tx
            .select({ active: s.lostTimeTypes.active, name: s.lostTimeTypes.name })
            .from(s.lostTimeRows)
            .innerJoin(s.lostTimeTypes, eq(s.lostTimeTypes.id, s.lostTimeRows.lostTimeTypeId))
            .where(eq(s.lostTimeRows.submissionId, id));
          const badLt = lts.find((l) => !l.active);
          if (badLt) return { id, ok: false, message: `Jenis lost time ${badLt.name} sudah tidak aktif di master.` };
          for (const p of prods) await tx.update(s.productionRows).set({ stkiSnapshot: p.stki }).where(eq(s.productionRows.id, p.id));
        }
        await tx
          .update(s.submissions)
          .set({
            status: opts.action === "approve" ? "approved" : "rejected",
            leaderId: opts.leaderId,
            decidedAt: new Date(),
            leaderNote: note || null,
          })
          .where(eq(s.submissions.id, id));
        await tx.insert(s.auditLog).values({
          userId: opts.leaderId,
          action: opts.action,
          tableName: "submissions",
          recordId: id,
          before: { status: "pending" },
          after: { status: opts.action === "approve" ? "approved" : "rejected", note: note || null },
        });
        return { id, ok: true };
      });
      results.push(r);
    } catch (e) {
      results.push({ id, ok: false, message: e instanceof Error ? e.message : "Gagal memproses." });
    }
  }
  return results;
}
