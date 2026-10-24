import { describe, expect, it } from "vitest";
import { achievement, grade, groupMachines, normalizeMc, normalizePart, validateSubmission } from "@/lib/rules";
import type { MasterData, PartRowInput, SubmissionInput } from "@/lib/types";

const master: MasterData = {
  categories: [{ id: 1, name: "PF Iron Cage", process: "PF", area: "PF", ngGroupId: 1 }],
  parts: [
    { id: 10, categoryId: 1, name: "6902-J", type: "D1", stki: 1200 },
    { id: 11, categoryId: 1, name: "6803-J", type: "D1", stki: 1200 },
  ],
  machines: [
    { id: 100, categoryId: 1, mcNo: "MC 01", line: "EXPO", mainPart: "6902-J D1", canSwitchTo: "6803-J D1" },
    { id: 101, categoryId: 1, mcNo: "MC 05", line: "EXPO", mainPart: "6803-J d1*KD", canSwitchTo: "" },
    { id: 102, categoryId: 1, mcNo: "MC 06", line: "EXPO", mainPart: "6904-J D2", canSwitchTo: "" },
  ],
  lostTimeTypes: [{ id: 1, name: "Pumping", group: "LOST_TIME" }],
  members: [{ id: 1, nik: "201003", name: "Harjuki", area: "PF" }],
  ngGroups: [{ id: 1, name: "Iron Cage", codes: Array.from({ length: 10 }, (_, i) => `NG${i + 1}`) }],
  settings: { normalMin: 480, otLimitHrs: 4, target: 100, gradeA: 100, gradeB: 90, gradeC: 80, stkiHighPct: 150, stkiLowPct: 30, ngPpmMax: 1000, utilTarget: 85, mcHrsDay: 8 },
};

const part = (p: Partial<PartRowInput> = {}): PartRowInput => ({
  categoryId: 1,
  partId: 10,
  machineId: 100,
  qtyNormal: 8000,
  minNormal: 450,
  qtyOt: null,
  minOt: null,
  lot: "",
  oiban: "",
  ng: Array(10).fill(null),
  ...p,
});
const sub = (s: Partial<SubmissionInput> = {}): SubmissionInput => ({
  workDate: "2026-10-20",
  memberId: 1,
  parts: [part()],
  lostTimes: [{ lostTimeTypeId: 1, minutes: 30, note: "" }],
  ...s,
});

describe("validateSubmission", () => {
  it("menerima laporan lengkap 480 menit", () => {
    const r = validateSubmission(sub(), master);
    expect(r.errors).toEqual([]);
    expect(r.needsCheck).toBe(false);
  });
  it("R1/R2: tanggal, member, dan isi wajib", () => {
    const r = validateSubmission(sub({ workDate: "", memberId: null, parts: [], lostTimes: [] }), master);
    expect(r.errors.join(" ")).toMatch(/Tanggal/);
    expect(r.errors.join(" ")).toMatch(/member/);
    expect(r.errors.join(" ")).toMatch(/minimal satu/);
  });
  it("R4: MC wajib, '-' diterima", () => {
    expect(validateSubmission(sub({ parts: [part({ machineId: null })] }), master).errors.join()).toMatch(/MC No wajib/);
    expect(validateSubmission(sub({ parts: [part({ machineId: "-" })] }), master).errors).toEqual([]);
  });
  it("R5/R6: qty dan menit", () => {
    expect(validateSubmission(sub({ parts: [part({ qtyNormal: null })] }), master).errors.join()).toMatch(/qty normal atau qty OT/);
    expect(validateSubmission(sub({ parts: [part({ minNormal: null })], lostTimes: [{ lostTimeTypeId: 1, minutes: 480, note: "" }] }), master).errors.join()).toMatch(
      /menit normal wajib/,
    );
    expect(validateSubmission(sub({ parts: [part({ qtyOt: 100 })] }), master).errors.join()).toMatch(/menit OT wajib/);
  });
  it("R8: kurang dari 480 memblokir", () => {
    const r = validateSubmission(sub({ lostTimes: [] }), master);
    expect(r.errors.join()).toMatch(/Sisa 30 menit/);
    expect(r.totals.remaining).toBe(30);
  });
  it("R9/R10: lebih dari 480 dan OT > 4 jam hanya peringatan + perlu dicek", () => {
    const r = validateSubmission(sub({ parts: [part({ minNormal: 480, qtyOt: 5000, minOt: 300 })] }), master);
    expect(r.errors).toEqual([]);
    expect(r.needsCheck).toBe(true);
    expect(r.warnings.length).toBe(2);
  });
  it("R15: qty tidak wajar dibanding STKI", () => {
    const r = validateSubmission(sub({ parts: [part({ qtyNormal: 100 })] }), master);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/tidak wajar/);
  });
  it("R16: laporan dobel ditandai perlu dicek", () => {
    const r = validateSubmission(sub(), master, { hasApprovedSameDay: true });
    expect(r.needsCheck).toBe(true);
  });
});

describe("pencocokan mesin", () => {
  it("normalisasi nama part dan MC", () => {
    expect(normalizePart("6803-J d1*KD")).toBe(normalizePart("6803-J D1"));
    expect(normalizeMc("MC 05")).toBe(normalizeMc("mc5"));
  });
  it("mengelompokkan mesin utama, bisa ganti, dan lain", () => {
    const g = groupMachines(master.machines, master.parts[1]);
    expect(g.main.map((m) => m.mcNo)).toEqual(["MC 05"]);
    expect(g.switchable.map((m) => m.mcNo)).toEqual(["MC 01"]);
    expect(g.other.map((m) => m.mcNo)).toEqual(["MC 06"]);
  });
});

describe("metrik", () => {
  it("achievement = std hours / rated hours dan grade", () => {
    const ach = achievement(9, 10);
    expect(ach).toBeCloseTo(0.9);
    expect(grade(ach, master.settings)).toBe("B");
    expect(grade(1, master.settings)).toBe("A");
    expect(grade(0.79, master.settings)).toBe("D");
  });
});
