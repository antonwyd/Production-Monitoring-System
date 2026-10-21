import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/db";
import { seed } from "@/db/seed";
import * as s from "@/db/schema";
import { createSubmission, decide, invalidateMaster, listSubmissions, loadMaster, ValidationError } from "@/lib/service";
import { buildReport } from "@/lib/reports";
import { saveMaster } from "@/lib/admin";

let db: DB;
let leaderId: number;
const DATE = "2026-10-20";

beforeAll(async () => {
  db = await createDb({ url: "", dataDir: "memory://" });
  await seed(db, { demo: false });
  const [leader] = await db.insert(s.users).values({ nik: "L1", name: "Leader", role: "leader", area: "PF", pinHash: "x" }).returning();
  leaderId = leader.id;
  await db.insert(s.members).values({ nik: "201003", name: "Harjuki", area: "PF" });
  invalidateMaster();
});

async function validInput() {
  const m = await loadMaster(db, { fresh: true });
  const cat = m.categories.find((c) => c.name === "PF Iron Cage")!;
  const part = m.parts.find((p) => p.categoryId === cat.id && p.name === "6902-J")!;
  const mc = m.machines.find((x) => x.categoryId === cat.id)!;
  return {
    m,
    part,
    input: {
      workDate: DATE,
      memberId: m.members[0].id,
      parts: [{ categoryId: cat.id, partId: part.id, machineId: mc.id, qtyNormal: 7920, minNormal: 450, lot: "L1", ng: [0, 5, 3] }],
      lostTimes: [{ lostTimeTypeId: m.lostTimeTypes[0].id, minutes: 30, note: "" }],
    },
  };
}

describe("alur kirim → approve → report", () => {
  it("server menolak kiriman yang melanggar aturan form", async () => {
    const { input } = await validInput();
    await expect(createSubmission(db, { ...input, lostTimes: [] }, { submittedBy: null })).rejects.toBeInstanceOf(ValidationError);
  });

  it("operator tidak bisa mengirim atas nama member lain", async () => {
    const { input } = await validInput();
    await expect(createSubmission(db, input, { submittedBy: null, forceMemberId: 999 })).rejects.toThrow(/atas nama sendiri/);
  });

  it("kirim, approve, dan data masuk report", async () => {
    const { input, part } = await validInput();
    const res = await createSubmission(db, input, { submittedBy: null });
    expect(res.id).toMatch(/^QA\d{14}$/);

    // Report belum memuat data sebelum approve.
    let r = await buildReport(db, "dashboard", { from: DATE, to: DATE }, DATE);
    expect(r.kpis[0].value).toBe(0);

    // Reject tanpa alasan ditolak (R12).
    await expect(decide(db, { ids: [res.id], action: "reject", leaderId, area: "PF" })).rejects.toBeInstanceOf(ValidationError);

    // Leader area lain tidak bisa memutuskan.
    const other = await decide(db, { ids: [res.id], action: "approve", leaderId, area: "Senbetsu" });
    expect(other[0].ok).toBe(false);

    const ok = await decide(db, { ids: [res.id], action: "approve", leaderId, area: "PF" });
    expect(ok[0]).toEqual({ id: res.id, ok: true });

    // Keputusan ganda diabaikan (R14).
    const again = await decide(db, { ids: [res.id], action: "reject", note: "x", leaderId, area: "PF" });
    expect(again[0].ok).toBe(false);

    const [row] = await db.select().from(s.productionRows).where(eq(s.productionRows.submissionId, res.id));
    expect(row.stkiSnapshot).toBe(part.stki);

    r = await buildReport(db, "dashboard", { from: DATE, to: DATE }, DATE);
    expect(r.kpis[0].value).toBe(7920);
    expect(r.kpis[1].value).toBe(8);
    // achievement = (7920 / 1100) / (450 / 60) = 0.96
    expect(r.kpis[3].value as number).toBeCloseTo(7920 / part.stki / 7.5, 5);

    const daily = await buildReport(db, "daily", { date: DATE }, DATE);
    expect(daily.tables[0].rows[0].status).toBe("Disetujui");

    for (const kind of ["member", "category", "machine", "ng-type", "ng-lot", "monthly"] as const) {
      const rep = await buildReport(db, kind, { from: DATE, to: DATE, month: "2026-10" }, DATE);
      expect(rep.tables.length).toBeGreaterThan(0);
    }
    const ngType = await buildReport(db, "ng-type", { from: DATE, to: DATE }, DATE);
    expect(ngType.tables[0].rows[0]).toMatchObject({ ng: "Kizu", qty: 5 });
  });

  it("kiriman perlu dicek tidak ikut bulk approve (R11)", async () => {
    const { input } = await validInput();
    const res = await createSubmission(db, input, { submittedBy: null }); // dobel → perlu dicek (R16)
    expect(res.needsCheck).toBe(true);
    const bulk = await decide(db, { ids: [res.id], action: "approve", leaderId, area: "PF", bulk: true });
    expect(bulk[0].ok).toBe(false);
    const [view] = await listSubmissions(db, { ids: [res.id] });
    expect(view.status).toBe("pending");
  });

  it("approve gagal bila part dinonaktifkan di master (R13)", async () => {
    const { input, part } = await validInput();
    const res = await createSubmission(db, input, { submittedBy: null });
    await saveMaster(db, "parts", { id: part.id, active: false }, leaderId);
    const r = await decide(db, { ids: [res.id], action: "approve", leaderId, area: "PF" });
    expect(r[0].ok).toBe(false);
    expect(r[0].message).toMatch(/tidak aktif/);
  });
});
