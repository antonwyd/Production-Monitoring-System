import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildForecastReport, forecastFromGrid, ForecastParseError, parseForecastBook, toQty, type FcDailyStored, type PoDaily, type XSheet } from "@/lib/forecast";
import { readBook, reportXlsx, templateXlsx } from "@/lib/forecastXlsx";

const FILE = process.env.FC_FILE ?? "";
const d = (ym: string, day = 1) => new Date(`${ym}-${String(day).padStart(2, "0")}T00:00:00Z`);

/** Buku kecil: sheet bulanan (diabaikan) + sheet harian, format sama dengan file customer. */
function book(): XSheet[] {
  const monthly = [[], [null, null, null, "qty", "plan", "plan", "forecast"], [null, null, null, "box", d("2026-10"), d("2026-11"), d("2026-12")], [null, 1, "GDD627*D1 J", 21600, 1, 2, 3]];
  const daily = [
    [],
    [],
    [null, null, null, null, "Total", ...Array.from({ length: 30 }, (_, i) => d("2026-11", i + 1))],
    [null, 1, "GDD627*D1     J", 21600, 600, 100, 200, 300, ...Array(27).fill(0)],
    [null, 2, "GDD629*D2 J", 6000, 60, 0, 30, 30, ...Array(27).fill(0)],
    [null, 3, "GDD698*D1 J", 13500, 0, ...Array(30).fill(0)],
  ];
  return [
    { name: "monthly forecast (Oct26)", cells: monthly },
    { name: "daily forecast Nov", cells: daily },
  ];
}

const fc = (part: string, tanggal: string, qty: number, versi = tanggal.slice(0, 7), customer = "NSK"): FcDailyStored => ({ part, tanggal, qty, versi, customer });
const po = (part: string, tanggal: string, qty: number, customer = "NSK"): PoDaily => ({ part, tanggal, qty, customer });

describe("Forecast harian vs PO harian", () => {
  it("membaca sheet harian dan mengabaikan sheet bulanan", () => {
    const p = parseForecastBook(book());
    expect(p.versi).toBe("2026-11");
    expect(p.sheet).toBe("daily forecast Nov");
    expect(p.parts.map((x) => x.part)).toEqual(["GDD627*D1 J", "GDD629*D2 J", "GDD698*D1 J"]);
    expect(p.parts[0].box).toBe(21600);
    expect(p.summary.total).toBe(660);
    expect(p.daily.find((x) => x.part === "GDD627*D1 J" && x.tanggal === "2026-11-02")?.qty).toBe(200);
    expect(p.warnings.some((w) => w.includes("bulanan diabaikan"))).toBe(true);
  });

  it("menolak file yang hanya punya sheet bulanan", () => {
    expect(() => parseForecastBook([book()[0]])).toThrow(ForecastParseError);
  });

  it("template harian bisa dibaca lagi", async () => {
    const buf = await templateXlsx("2026-11", [{ part: "627-J D1", box: 21600 }], "PT NSK INDONESIA");
    const p = parseForecastBook(await readBook(buf));
    expect(p.versi).toBe("2026-11");
    expect(p.parts[0]).toMatchObject({ part: "627-J D1", box: 21600 });
  });

  it("input grid dan angka tempelan", () => {
    expect(toQty("12.000")).toBe(12000);
    expect(toQty("1,234,567")).toBe(1234567);
    expect(toQty("")).toBeNull();
    expect(Number.isNaN(toQty("abc"))).toBe(true);
    const g = forecastFromGrid("2026-11", [{ part: " A  1 ", days: [10, null, 5] }, { part: "", days: [] }]);
    expect(g.parts).toHaveLength(1);
    expect(g.parts[0].part).toBe("A 1");
    expect(g.daily.map((x) => x.tanggal)).toEqual(["2026-11-01", "2026-11-03"]);
  });

  it("membandingkan s/d batas (PO besok sudah masuk)", () => {
    const F = [fc("A", "2026-11-05", 100), fc("A", "2026-11-06", 100), fc("A", "2026-11-07", 100), fc("A", "2026-11-20", 100), fc("B", "2026-11-06", 50)];
    const P = [po("A", "2026-11-05", 80), po("A", "2026-11-06", 120), po("A", "2026-11-07", 90), po("B", "2026-11-06", 50), po("A", "2026-10-07", 200)];
    const r = buildForecastReport(F, P, { today: "2026-11-06" });
    expect(r.month).toBe("2026-11");
    expect(r.upto).toBe("2026-11-07"); // PO kirim besok sudah diinput
    expect(r.kpi.fcUpto).toBe(350);
    expect(r.kpi.poUpto).toBe(340);
    expect(r.kpi.ach).toBeCloseTo(340 / 350);
    expect(r.kpi.fcMonth).toBe(450);
    expect(r.kpi.fcRest).toBe(100);
    expect(r.kpi.poPrevMonth).toBe(200);
    const a = r.parts.find((p) => p.part === "A")!;
    expect(a).toMatchObject({ fcUpto: 300, poUpto: 290, diff: -10, lastPo: 90, lastFc: 100 });
    expect(r.days.find((x) => x.tanggal === "2026-11-08")).toMatchObject({ future: true, po: null });
    expect(r.days.find((x) => x.tanggal === "2026-11-07")?.cumPo).toBe(340);
    expect(r.months).toEqual(["2026-11", "2026-10"]);
    expect(r.monthly.map((m) => m.bulan)).toEqual(["2026-10", "2026-11"]);
    // Filter part
    const rb = buildForecastReport(F, P, { today: "2026-11-06", part: "B" });
    expect(rb.kpi.fcUpto).toBe(50);
    expect(rb.kpi.ach).toBe(1);
  });

  it("forecast versi terbaru menimpa, customer bisa digabung", () => {
    const F = [fc("A", "2026-11-02", 100, "2026-11"), fc("A", "2026-11-02", 70, "2026-12"), fc("X", "2026-11-02", 10, "2026-11", "KOR")];
    const P = [po("A", "2026-11-02", 70), po("X", "2026-11-02", 20, "KOR")];
    const r = buildForecastReport(F, P, { today: "2026-11-10" });
    expect(r.customer).toBe("Semua customer");
    expect(r.kpi.fcUpto).toBe(80);
    expect(r.kpi.poUpto).toBe(90);
    expect(r.perCustomer.map((c) => c.customer)).toEqual(["NSK", "KOR"]);
    const one = buildForecastReport(F, P, { today: "2026-11-10", customer: "KOR" });
    expect(one.kpi.ach).toBe(2);
  });

  it("bulan lampau dibandingkan sebulan penuh; tanpa data = kosong", async () => {
    const r = buildForecastReport([fc("A", "2026-10-31", 10)], [], { today: "2026-11-06" });
    expect(r.upto).toBe("2026-10-31");
    expect(r.kpi.ach).toBe(0);
    expect((await reportXlsx(r)).length).toBeGreaterThan(1000);
    const e = buildForecastReport([], [], { today: "2026-11-06" });
    expect(e.month).toBeNull();
  });

  it.skipIf(!FILE || !existsSync(FILE))("file asli customer", async () => {
    const p = parseForecastBook(await readBook(readFileSync(FILE)));
    expect(p.versi).toBe("2026-11");
    expect(p.summary.total).toBe(25897200);
    console.log(p.summary, p.warnings, p.parts.slice(0, 3));
  });
});
