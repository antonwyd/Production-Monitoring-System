import { beforeEach, describe, expect, it } from "vitest";
import { setTransport, type RawMaster, type RawSubmission } from "@/lib/backend";
import { createSubmission, decide, invalidateMaster, listSubmissions, loadMaster, queueOverview, ValidationError } from "@/lib/service";
import { buildReport, clearReportCache } from "@/lib/reports";

// Apps Script palsu di memori yang meniru kontrak API di Code.gs (doPost).
const DATE = "2026-10-20";
const RAW: RawMaster = {
  today: DATE,
  members: [
    { nik: "201003", name: "Harjuki" },
    { nik: "201004", name: "Suharyanto" },
  ],
  categories: [
    { name: "PF Iron Cage", process: "Bowl PF", ngGroup: "Iron Cage", ng: ["Part Tercampur", "Kizu", "Henkei"] },
    { name: "Seiretsu Iron Cage", process: "Seiretsu", ngGroup: "Iron Cage", ng: ["Part Tercampur", "Kizu", "Henkei"] },
  ],
  parts: [
    { category: "PF Iron Cage", name: "6902-J", type: "D1", stki: 1100 },
    { category: "Seiretsu Iron Cage", name: "608JCL-1-J", type: "D1", stki: 6656 },
  ],
  machines: [{ category: "PF Iron Cage", mc: "MC 01", line: "EXPO", main: "6902-J D1", alt: "" }],
  lostTypes: [
    { name: "5S", group: "Another Job" },
    { name: "Ganti Pole", group: "Lost Time" },
  ],
  settings: { normalMin: 480, otLimitHrs: 4, target: 100, gradeA: 100, gradeB: 90, gradeC: 80 },
};

let queue: RawSubmission[];
let prod: (string | number)[][];
let lost: (string | number)[][];
let seq = 0;
let partActive = true;

beforeEach(() => {
  queue = [];
  prod = [];
  lost = [];
  partActive = true;
  invalidateMaster();
  clearReportCache();
  setTransport(async (action, a: Record<string, any>) => {
    switch (action) {
      case "master":
        return RAW;
      case "queue":
        return structuredClone(queue.filter((s) => (!a.status || s.status === a.status) && (!a.date || s.date === a.date) && (!a.member || s.member === a.member)));
      case "submit": {
        const p = a.payload;
        const id = `QA${String(++seq).padStart(14, "0")}`;
        queue.push({ id, sent: `${DATE} 08:00`, date: p.date, member: p.member, parts: p.items.length, qty: 0, ltMin: 0, status: "Menunggu", leader: "", decided: "", note: "", items: p.items, lostTimes: p.lostTimes, edited: "", meta: p.meta });
        return { id, pending: true };
      }
      case "decide": {
        const detail = [];
        for (const id of a.ids) {
          const s = queue.find((x) => x.id === id);
          if (!s || s.status !== "Menunggu") {
            detail.push({ id, ok: false, message: "Sudah diputuskan sebelumnya." });
            continue;
          }
          if (a.action === "ok") {
            if (!partActive) {
              detail.push({ id, ok: false, message: "Part #1: part tidak ada di kategori PF Iron Cage." });
              continue;
            }
            for (const it of s.items) prod.push([s.date, s.member, it.category, it.part, it.type, it.normalQty, it.normalMin, it.otQty, it.otMin, it.lot, it.oiban, it.mc, ...it.ng.map(Number), 0]);
            for (const l of s.lostTimes) lost.push([s.date, s.member, l.type, l.minutes, l.remarks]);
          }
          Object.assign(s, { status: a.action === "ok" ? "Disetujui" : "Ditolak", leader: a.leader, decided: `${DATE} 09:00`, note: a.note });
          detail.push({ id, ok: true });
        }
        return { detail };
      }
      case "rows":
        return { cols: [], prod: prod.filter((r) => r[0] >= a.from && r[0] <= a.to), lost: lost.filter((r) => r[0] >= a.from && r[0] <= a.to) };
    }
    throw new Error(`aksi ${action}`);
  });
});

async function validInput() {
  const m = await loadMaster({ fresh: true });
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

describe("master dari Google Sheet", () => {
  it("id tetap sama walau urutan baris berubah", async () => {
    const a = await loadMaster({ fresh: true });
    RAW.parts.reverse();
    const b = await loadMaster({ fresh: true });
    RAW.parts.reverse();
    expect(new Set(b.parts.map((p) => p.id))).toEqual(new Set(a.parts.map((p) => p.id)));
    expect(a.ngGroups[0].codes).toHaveLength(10);
    expect(a.ngGroups[0].codes[3]).toBe("NG4");
    expect(a.lostTimeTypes.find((t) => t.name === "5S")!.group).toBe("ANOTHER_JOB");
  });
});

describe("alur kirim → approve → report", () => {
  it("server menolak kiriman yang melanggar aturan form", async () => {
    const { input } = await validInput();
    await expect(createSubmission({ ...input, lostTimes: [] }, { submittedBy: null })).rejects.toBeInstanceOf(ValidationError);
    expect(queue).toHaveLength(0);
  });

  it("operator tidak bisa mengirim atas nama member lain", async () => {
    const { input } = await validInput();
    await expect(createSubmission(input, { submittedBy: null, forceMemberId: 999 })).rejects.toThrow(/atas nama sendiri/);
  });

  it("kiriman disimpan dengan nama (format v1) dan masuk report setelah approve", async () => {
    const { input, part } = await validInput();
    const res = await createSubmission(input, { submittedBy: "Harjuki" });
    expect(queue[0]).toMatchObject({ member: "Harjuki", items: [{ category: "PF Iron Cage", part: "6902-J", type: "D1", mc: "MC 01", normalQty: 7920 }], lostTimes: [{ type: "5S", minutes: 30 }] });

    let r = await buildReport("dashboard", { from: DATE, to: DATE }, DATE);
    expect(r.kpis[0].value).toBe(0);

    await expect(decide({ ids: [res.id], action: "reject", leaderName: "Dian" })).rejects.toBeInstanceOf(ValidationError);
    const ok = await decide({ ids: [res.id], action: "approve", leaderName: "Dian" });
    expect(ok[0]).toEqual({ id: res.id, ok: true });
    const again = await decide({ ids: [res.id], action: "reject", note: "x", leaderName: "Dian" });
    expect(again[0].ok).toBe(false);

    const q = await queueOverview("approved");
    expect(q.counts).toEqual({ pending: 0, approved: 1, rejected: 0 });
    expect(q.items[0]).toMatchObject({ memberNik: "201003", leaderName: "Dian", totals: { qty: 7920, ng: 8, lostMin: 30 } });
    expect(q.items[0].parts[0].ng).toEqual([{ label: "Kizu", qty: 5 }, { label: "Henkei", qty: 3 }]);

    clearReportCache();
    r = await buildReport("dashboard", { from: DATE, to: DATE }, DATE);
    expect(r.kpis[0].value).toBe(7920);
    expect(r.kpis[1].value).toBe(8);
    expect(r.kpis[3].value as number).toBeCloseTo(7920 / part.stki / 7.5, 5);
    expect(r.kpis[6].value).toBeCloseTo(0.5, 5); // 5S = another job 30 menit

    const daily = await buildReport("daily", { date: DATE }, DATE);
    expect(daily.tables[0].rows.find((x) => x.member === "Harjuki")!.status).toBe("Disetujui");
    expect(daily.tables[0].rows.find((x) => x.member === "Suharyanto")!.status).toBe("Belum lapor");

    for (const kind of ["member", "category", "machine", "ng-type", "ng-lot", "monthly"] as const) {
      const rep = await buildReport(kind, { from: DATE, to: DATE, month: "2026-10" }, DATE);
      expect(rep.tables.length).toBeGreaterThan(0);
    }
    const machine = await buildReport("machine", { from: DATE, to: DATE }, DATE);
    expect(machine.tables[0].rows[0]).toMatchObject({ mcNo: "MC 01", line: "EXPO" });
    const ngType = await buildReport("ng-type", { from: DATE, to: DATE }, DATE);
    expect(ngType.tables[0].rows[0]).toMatchObject({ ng: "Kizu", qty: 5 });
    const cat = await buildReport("category", { from: DATE, to: DATE, categoryId: input.parts[0].categoryId }, DATE);
    expect(cat.tables[0].rows).toHaveLength(1);
  });

  it("kiriman perlu dicek tidak ikut bulk approve (R11)", async () => {
    const { input } = await validInput();
    const first = await createSubmission(input, { submittedBy: null });
    await decide({ ids: [first.id], action: "approve", leaderName: "Dian" });
    const res = await createSubmission(input, { submittedBy: null }); // dobel → perlu dicek (R16)
    expect(res.needsCheck).toBe(true);
    const bulk = await decide({ ids: [res.id], action: "approve", leaderName: "Dian", bulk: true });
    expect(bulk[0].ok).toBe(false);
    const [view] = await listSubmissions({ status: "pending" });
    expect(view).toMatchObject({ id: res.id, status: "pending", needsCheck: true });
  });

  it("pesan gagal approve dari Apps Script diteruskan (R13)", async () => {
    const { input } = await validInput();
    const res = await createSubmission(input, { submittedBy: null });
    partActive = false;
    const r = await decide({ ids: [res.id], action: "approve", leaderName: "Dian" });
    expect(r[0].ok).toBe(false);
    expect(r[0].message).toMatch(/tidak ada/);
  });
});
