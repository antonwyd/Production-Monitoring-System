import { writeFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildSection, defaultWorkDays, nextMonthOf, SECTIONS, type MonthlyReport } from "@/lib/monthly";
import { monthlyToPdf } from "@/lib/monthlyPdf";
import { monthlyToXlsx } from "@/lib/monthlyExcel";
import { parseDays, type MonthPlan } from "@/lib/sheets/plan";

// Baris seperti hasil apiRows: date, member, category, part, type, nQty, nMin, otQty, otMin, lot, oiban, mc, ng1..ng10, stki, mcMinN, mcMinOt, stdMc, note
function row(date: string, member: string, cat: string, part: string, type: string, nQty: number, nMin: number, otQty = 0, otMin = 0, mc = "-", mcN: number | "" = "", mcOt: number | "" = "", ng1 = 0) {
  return [date, member, cat, part, type, nQty, nMin, otQty, otMin, "L1", "", mc, ng1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5000, mcN, mcOt, 0, ""];
}

const plan = (section: string, month: string, production: number, units: number, productivity: number): MonthPlan => ({
  month,
  section,
  production,
  workDays: defaultWorkDays(month),
  hoursNormal: 0,
  units,
  productivity,
  note: "",
  by: "Dian Kartika Sari",
  updated: "",
});

describe("Production Report bulanan", () => {
  it("menghitung plan harian, kumulatif, dan Plan & Result per member", () => {
    const def = SECTIONS.find((s) => s.key === "senbetsu-iron")!;
    const rows = [
      row("2026-09-01", "A", "Senbetsu Iron Cage", "627-J", "D1", 1000, 480, 200, 60),
      row("2026-09-01", "B", "Senbetsu Iron Cage", "629-J", "D1", 800, 480),
      row("2026-09-02", "A", "Senbetsu Shield Cage", "627-JZ", "", 500, 240, 0, 0, "-", "", "", 10),
      row("2026-09-02", "C", "Seiretsu Iron Cage", "627-J", "D1", 999, 480),
    ];
    const s = buildSection(def, "2026-09", rows, plan("senbetsu-iron", "2026-09", 22000, 2, 10), null, 480, ["Senbetsu Iron Cage", "Senbetsu Shield Cage"]);
    expect(s.columns).toEqual(["Iron", "OT Iron", "Shield", "OT Shield"]);
    expect(s.daily).toHaveLength(30);
    expect(s.daily[0]).toMatchObject({ work: true, plan: 1000, total: 2000, cols: [1800, 200, 0, 0] });
    expect(s.daily[4].work).toBe(false); // 5 Sep = Sabtu
    expect(s.total.total).toBe(2500);
    const [prod, tn, tr, ot, units, pr] = s.lines;
    expect(prod).toMatchObject({ plan: 22000, result: 2500 });
    expect(units.result).toBe(2);
    expect(tn.result).toBeCloseTo((480 + 480 + 240) / 60 / 2);
    expect(ot.result).toBeCloseTo(60 / 60 / 2);
    expect(tr.plan).toBeCloseTo(22000 / (10 * 2));
    expect(pr.result).toBeCloseTo(2500 / ((480 + 480 + 240 + 60) / 60));
    expect(s.parts[0]).toMatchObject({ part: "627-J D1", qty: 1200 });
    expect(s.quality.ng).toBe(10);
  });

  it("PF dihitung per mesin dengan menit MC, Drum PF dipecah per part", () => {
    const def = SECTIONS.find((s) => s.key === "drum-pf")!;
    const rows = [
      row("2026-09-01", "A", "Drum PF", "688A-H", "D1", 9000, 240, 0, 0, "MC 01", 480, 0),
      row("2026-09-01", "A", "Drum PF", "625-H", "D2", 6000, 240, 1000, 60, "MC 02", 480, 120),
    ];
    const s = buildSection(def, "2026-09", rows, null, null, 480, ["Drum PF"]);
    expect(s.columns).toEqual(["625-H D2", "688A-H D1"]);
    expect(s.lines[4].result).toBe(2);
    expect(s.lines[1].result).toBeCloseTo(8);
    expect(s.lines[5].result).toBeCloseTo(16000 / 18);
    expect(s.hasPlan).toBe(false);
    expect(s.daily[0].plan).toBe(0);
  });

  it("hari kerja dibaca dari teks tanggal", () => {
    expect(parseDays("1,2, 3,3,40,0")).toEqual([1, 2, 3]);
    expect(nextMonthOf("2026-12")).toBe("2027-01");
  });

  it("membuat PDF dan Excel dengan grafik", async () => {
    const month = "2026-09";
    const rows: (string | number)[][] = [];
    const days = defaultWorkDays(month);
    const parts: Record<string, [string, string][]> = {
      "Senbetsu Iron Cage": [["627-J", "D1"], ["629-J", "D2"], ["6802-H", "D1"]],
      "Senbetsu Shield Cage": [["6201ZZ", ""]],
      "Senbetsu Plastik Cage": [["608-X3", "-"]],
      "Seiretsu Iron Cage": [["627-J", "D1"], ["6800-J", "D2"]],
      "Seiretsu Plastik Cage": [["604", "-"]],
      "Drum PF": [["688A-H", "D1"], ["688A-H", "D2"], ["625-H", "D1"], ["625-H", "D2"], ["6802-H", "D1"], ["6802-H", "D2"], ["695-H", "D1"]],
      "PF Iron Cage": [["627-J", "D1"], ["629-J", "D2"]],
      "PF Plastik": [["608-X3", "-"]],
    };
    let k = 1;
    for (const d of days) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      for (const [cat, ps] of Object.entries(parts))
        ps.forEach(([p, t], i) => {
          k = (k * 48271) % 2147483647;
          const q = 20000 + (k % 30000);
          const mc = /PF/.test(cat) ? `MC ${String((i % 9) + 1).padStart(2, "0")}` : "-";
          rows.push(row(date, `M${i}`, cat, p, t, q, 420, k % 3 ? 0 : 5000, k % 3 ? 0 : 120, mc, mc === "-" ? "" : 480, mc === "-" ? "" : k % 3 ? 0 : 120, k % 40));
        });
    }
    const known = Object.keys(parts);
    const r: MonthlyReport = {
      month,
      nextMonth: "2026-10",
      label: "September 2026",
      nextLabel: "Oktober 2026",
      sections: SECTIONS.map((def, i) =>
        buildSection(def, month, rows, i === 1 ? null : plan(def.key, month, 1_500_000, 9, 400), plan(def.key, "2026-10", 1_600_000, 9, 400), 480, known, { "Senbetsu Iron Cage": ["Karat", "Kotor"] }),
      ),
    };
    const pdf = monthlyToPdf(r);
    const xlsx = await monthlyToXlsx(r);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const zip = await JSZip.loadAsync(xlsx);
    expect(Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f))).toHaveLength(14);
    if (process.env.MONTHLY_OUT) {
      writeFileSync(`${process.env.MONTHLY_OUT}/contoh.pdf`, pdf);
      writeFileSync(`${process.env.MONTHLY_OUT}/contoh.xlsx`, xlsx);
    }
  });
});
