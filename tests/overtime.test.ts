import { describe, expect, it } from "vitest";
import { buildProducts, computePlan, findProduct, parsePoText, partKey, prodBefore, runSchedule, toClock, type PlanInput, type PlanMaster } from "@/lib/overtime";

const master: PlanMaster = {
  parts: [
    { category: "PF Iron Cage", name: "627-J", type: "D1", stki: 5000, stdMc: 1200 },
    { category: "Seiretsu Iron Cage", name: "627-J", type: "D1", stki: 600, stdMc: 0 },
    { category: "Senbetsu Iron Cage", name: "627-J", type: "D1", stki: 6000, stdMc: 0 },
    { category: "Seiretsu Iron Cage", name: "629-J", type: "D2", stki: 600, stdMc: 0 },
    { category: "PF Plastik", name: "608 T1X PF", type: "-", stki: 9000, stdMc: 0 },
    { category: "Seiretsu Plastik Cage", name: "608T1X", type: "-", stki: 5000, stdMc: 0 },
  ],
  machines: { "PF Iron Cage": 29 },
  normalMin: 480,
  otLimitHrs: 4,
  recent: {},
};
const products = buildProducts(master);
const sched = { start: 7 * 60, breakAt: 12 * 60, breakMin: 60, routineMin: 20, normalMin: 480, otMaxMin: 240, firstFrom: 13 * 60 };
const plan = (p: Partial<PlanInput>): PlanInput => ({ dates: ["2026-10-29", "2026-10-30"], target: 14 * 60, schedule: sched, pool: 28, senbetsu: false, lines: [], stations: {}, ...p });
const key = (name: string, type: string) => findProduct(products, name, type)!.key;

describe("Rencana Lembur", () => {
  it("menyamakan nama part antar kategori", () => {
    expect(partKey("608 T1X PF")).toBe(partKey("608T1X"));
    expect(partKey("625 -H*KD")).toBe(partKey("625-H"));
    expect(partKey("8030")).toBe(partKey("S-8030"));
    const p = products.find((x) => x.family === "plastik")!;
    expect(p.name).toBe("608T1X");
    expect(p.rate).toEqual({ pf: 9000, seiretsu: 5000 });
    expect(products.find((x) => x.key === key("627-J", "D1"))!.rate).toEqual({ pf: 1200, seiretsu: 600, senbetsu: 6000 });
  });

  it("membaca tempelan Excel", () => {
    expect(parsePoText("627-J\tD1\t50.000\t40000\n629-J D2 30000\n1\t604\t-\t5000\nabc")).toEqual([
      { name: "627-J", type: "D1", qtys: [50000, 40000], raw: "627-J\tD1\t50.000\t40000" },
      { name: "629-J", type: "D2", qtys: [30000], raw: "629-J D2 30000" },
      { name: "604", type: "-", qtys: [5000], raw: "1\t604\t-\t5000" },
    ]);
  });

  it("menghitung jam kerja dengan mulai siang hari ini", () => {
    expect(prodBefore(sched, 14 * 60, 0)).toBe(60);
    expect(prodBefore(sched, 14 * 60, 1)).toBe(280 + 60);
    const f = runSchedule(sched, 600, 2, [90, 0]);
    expect(f.done && f.day === 1 && toClock(f.clock)).toBe("13:50");
  });

  it("Seiretsu: PO besok jam 14, mulai hari ini jam 13 → lembur hari ini 1,5 jam", () => {
    const r = computePlan(plan({ lines: [{ key: key("629-J", "D2"), qty: { "2026-10-30": 6000 } }], stations: { "iron:seiretsu": { units: 1 } } }), products, master);
    const s = r.stations.find((x) => x.step === "seiretsu")!;
    expect(s.loadHrs).toBe(10);
    expect(s.status).toBe("lembur");
    expect(s.otPerDay).toBe(90);
    expect(s.otDays).toBe(1);
    expect(s.needNoOt).toBe(2);
    expect(s.perDate[0]).toMatchObject({ date: "2026-10-30", qty: 6000, ok: true });
    expect(s.perDate[0].finish.done && toClock((s.perDate[0].finish as { clock: number }).clock)).toBe("13:50");
    expect(r.status).toBe("lembur");
  });

  it("PF penuh: sisa pindah ke Seiretsu, member terhitung", () => {
    const r = computePlan(
      plan({ lines: [{ key: key("627-J", "D1"), qty: { "2026-10-30": 12000 } }], stations: { "iron:pf": { units: 1, members: 3 }, "iron:seiretsu": { units: 1 } } }),
      products,
      master,
    );
    const pf = r.stations.find((x) => x.step === "pf")!;
    expect(pf.status).toBe("penuh");
    expect(r.pfQty).toBe(10400);
    expect(r.restQty).toBe(1600);
    const se = r.stations.find((x) => x.step === "seiretsu")!;
    expect(se.qty).toBe(1600);
    expect(se.status).toBe("aman");
    expect(r.usedMembers).toBe(4);
    expect(r.freeMembers).toBe(24);
  });

  it("PF dengan lembur mesin bisa menampung semua", () => {
    const r = computePlan(plan({ lines: [{ key: key("627-J", "D1"), qty: { "2026-10-30": 12000 } }], stations: { "iron:pf": { units: 1, otMin: 120 } } }), products, master);
    const pf = r.stations.find((x) => x.step === "pf")!;
    expect(pf.status).toBe("lembur");
    expect(r.restQty).toBe(0);
    expect(pf.otHrs).toBe(2);
  });

  it("PO hari ini yang tidak terkejar = kurang", () => {
    const r = computePlan(plan({ lines: [{ key: key("629-J", "D2"), qty: { "2026-10-29": 6000 } }], stations: { "iron:seiretsu": { units: 2 } } }), products, master);
    const se = r.stations.find((x) => x.step === "seiretsu")!;
    expect(se.status).toBe("kurang");
    expect(se.needNoOt).toBe(10);
    expect(r.status).toBe("kurang");
  });
});
