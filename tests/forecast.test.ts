import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addMonths, buildForecastReport, mergeManual, parseForecastBook, TOTAL, type FcStored, type XSheet } from "@/lib/forecast";
import { readBook, templateXlsx } from "@/lib/forecastXlsx";

const FILE = process.env.FC_FILE ?? "";
const d = (ym: string, day = 1) => new Date(`${ym}-${String(day).padStart(2, "0")}T00:00:00Z`);

/** Buku kecil berformat sama dengan file customer. */
function book(): XSheet[] {
  const months = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
  const labels = ["actual", "actual", "plan", "plan", "forecast", "forecast"];
  const head2: (string | null)[] = [null, null, null, "qty", ...labels, "forecast"];
  const head3: (string | Date | null)[] = [null, null, null, "box", ...months.map((m) => d(m)), d("2026-11")];
  const cells = [
    [],
    head2,
    head3,
    [null, 1, "GDD627*D1     J", 21600, 100, 200, 300, 400, 500, 600, 500],
    [null, 2, "GDD629*D2     J", 6000, 10, 20, 30, 0, 50, 60, 40],
    [null, null, null, null, 110, 220, 330, 400, 550, 660, 540],
    [null, null, null, "plan", 100, 250, 330, 540, 550, 660, 540],
  ];
  const formula = cells.map((r) => r.map(() => false));
  formula[6][6] = true; // Okt: =total (bukan forecast)
  const daily = [
    [],
    [],
    [null, null, null, null, "Total", ...Array.from({ length: 30 }, (_, i) => d("2026-11", i + 1))],
    [null, 1, "GDD627*D1 J", 21600, 400, 0, 200, 200, ...Array(27).fill(0)],
    [null, 2, "GDD629 beda", 6000, 0, ...Array(30).fill(0)],
  ];
  return [
    { name: "monthly", cells, formula },
    { name: "daily", cells: daily },
  ];
}

describe("Forecast vs PO", () => {
  it("membaca format file customer", () => {
    const p = parseForecastBook(book());
    expect(p.versi).toBe("2026-11");
    expect(p.parts.map((x) => x.part)).toEqual(["GDD627*D1 J", "GDD629*D2 J"]);
    const tot = (j: string, b: string) => p.rows.find((r) => r.part === TOTAL && r.jenis === j && r.bulan === b)?.qty;
    expect(tot("Plan", "2026-11")).toBe(400);
    expect(tot("Forecast lama", "2026-11")).toBe(540);
    expect(tot("Forecast total", "2026-09")).toBe(250);
    expect(tot("Forecast total", "2026-10")).toBeUndefined(); // rumus
    expect(p.daily.reduce((a, x) => a + x.qty, 0)).toBe(400);
    expect(p.summary.actual).toBe(400);
    expect(p.summary.forecast).toBe(540);
  });

  it("menghitung selisih, tren, dan revisi antar versi", () => {
    const p = parseForecastBook(book());
    const st = (versi: string, rows = p.rows): FcStored[] => rows.map((r) => ({ ...r, versi, customer: "NSK" }));
    // versi Desember: Desember jadi PO firm 450 (forecast di versi Nov = 550), Jan direvisi 700.
    const dec = mergeManual([], "2026-12", [
      { part: "GDD627*D1 J", actual: 400, forecast: null },
      { part: "GDD629*D2 J", actual: 50, forecast: null },
    ]).concat([
      { part: "GDD627*D1 J", jenis: "Forecast", bulan: "2027-01", qty: 700 },
      { part: TOTAL, jenis: "Forecast", bulan: "2027-01", qty: 700 },
    ]);
    const all = [...st("2026-11"), ...st("2026-12", dec)];
    const nov = buildForecastReport(all, [], { customer: "NSK", month: "2026-11" });
    expect(nov.sel?.actual).toBe(400);
    expect(nov.sel?.forecast).toBe(540);
    expect(nov.sel?.pct).toBeCloseTo(-140 / 540);
    expect(nov.sel?.mom).toBeCloseTo(400 / 330 - 1);
    const r = buildForecastReport(all, [], { customer: "NSK" });
    expect(r.selected).toBe("2026-12");
    expect(r.sel?.actual).toBe(450);
    expect(r.sel?.forecast).toBe(550); // forecast Des dari versi Nov
    expect(r.parts.find((x) => x.part === "GDD627*D1 J")?.forecast).toBe(500);
    expect(r.revisions).toEqual([{ bulan: "2027-01", now: 700, prev: 660, diff: 40, pct: 40 / 660 }]);
    expect(r.fy).toBe(2026);
    expect(r.fySum.months).toBe(5); // Agu..Des
    expect(r.fySum.matched).toBe(4); // Agu, Sep, Nov, Des (Okt tanpa forecast)
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("template bisa dibaca lagi", async () => {
    const buf = await templateXlsx("2026-11", [{ part: "GDD627*D1 J", box: 21600 }]);
    const p = parseForecastBook(await readBook(buf));
    expect(p.versi).toBe("2026-11");
    expect(p.parts[0].part).toBe("GDD627*D1 J");
    expect(p.months.find((m) => m.bulan === "2026-10")?.jenis).toBe("Actual");
  });

  it.skipIf(!FILE || !existsSync(FILE))("file asli customer", async () => {
    const p = parseForecastBook(await readBook(readFileSync(FILE)));
    console.log(p.versi, p.summary, p.warnings, p.rows.length, p.daily.length);
    expect(p.versi).toBe("2026-11");
    expect(p.summary.actual).toBe(25897200);
    expect(p.summary.forecast).toBe(32954400);
    const r = buildForecastReport(p.rows.map((x) => ({ ...x, versi: p.versi, customer: "NSK" })), p.daily.map((x) => ({ ...x, versi: p.versi, customer: "NSK" })), { customer: "NSK" });
    console.log(r.fy, r.fySum, r.perCustomer);
    console.log(r.sel, r.stats, r.parts.slice(0, 3), r.daily.slice(0, 4), r.months.length);
  });
});
