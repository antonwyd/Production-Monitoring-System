import { it, expect } from "vitest";
import { jamKerja } from "../src/lib/views";
import type { Fact, LostFact } from "../src/lib/reports";
it("jam kerja normal/OT + jumlah orang", () => {
  const f = (memberName: string, minNormal: number, minOt: number) => ({ workDate: "2026-11-05", memberName, minNormal, minOt }) as Fact;
  const l = (memberName: string, minutes: number, ot = false) => ({ workDate: "2026-11-05", memberName, minutes, ot }) as LostFact;
  const j = jamKerja([f("A", 460, 120), f("B", 300, 0), f("B", 160, 0)], [l("A", 20), l("B", 20), l("C", 60, true)]);
  expect(j).toEqual({ nJam: 16, otJam: 3, nOrang: 2, otOrang: 2 });
});
