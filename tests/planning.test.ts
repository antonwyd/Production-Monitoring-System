import { describe, expect, it } from "vitest";
import { assign, assignRange, buildMaster, extendOt, compute, machineOpts, mcHolders, parsePo, prodBetween, release, suggest, toMin, type PlanState } from "@/lib/planning";

const m = buildMaster({
  categories: [
    { name: "Seiretsu Iron Cage", process: "Seiretsu" },
    { name: "Senbetsu Iron Cage", process: "Senbetsu" },
    { name: "PF Iron Cage", process: "Bowl PF" },
    { name: "Drum PF", process: "Drum PF" },
  ],
  parts: [
    { category: "Seiretsu Iron Cage", name: "629-J", type: "D2", stki: 600, stdMc: 0 },
    { category: "Seiretsu Iron Cage", name: "627-J", type: "D1", stki: 600, stdMc: 0 },
    { category: "Senbetsu Iron Cage", name: "629-J", type: "D2", stki: 6000, stdMc: 0 },
    { category: "PF Iron Cage", name: "629-J", type: "D2", stki: 0, stdMc: 1000 },
    { category: "PF Iron Cage", name: "6901-J", type: "D2", stki: 0, stdMc: 900 },
  ],
  machines: [
    { category: "PF Iron Cage", mc: "MC 12", line: "BOWL PF", main: "629-J D2", alt: "6901-J D2" },
    { category: "PF Iron Cage", mc: "MC 13", line: "BOWL PF", main: "629-J D2", alt: "" },
    { category: "PF Iron Cage", mc: "MC 14", line: "BOWL PF", main: "629-J D2", alt: "" },
    { category: "PF Iron Cage", mc: "MC 15", line: "BOWL PF", main: "629-J D2", alt: "" },
  ],
  members: [],
  normalMin: 480,
  otLimitHrs: 4,
  maxMc: { "PF Iron Cage": 3 },
});
const S = "Seiretsu Iron Cage|629-J|D2";
const PF = "PF Iron Cage|629-J|D2";
const KEY = "iron|629J|D2";
const base = (people: PlanState["people"], targets: PlanState["targets"] = {}): PlanState => ({
  date: "2026-11-11",
  ot: 0,
  machines: { "PF Iron Cage|MC 12": PF, "PF Iron Cage|MC 13": PF, "PF Iron Cage|MC 14": PF, "PF Iron Cage|MC 15": PF },
  targets,
  people,
});
const row = (r: ReturnType<typeof compute>, step: string) => r.rows.find((x) => x.key === KEY && x.step === step)!;

describe("Perencanaan: jam kerja", () => {
  it("460 menit produktif per hari (480 - 20 rutin), istirahat tidak dihitung", () => {
    expect(prodBetween(m, 0, toMin("07:00"), toMin("16:00"))).toBe(460);
    expect(prodBetween(m, 0, toMin("07:00"), toMin("13:00"))).toBe(280);
    expect(prodBetween(m, 60, toMin("16:00"), toMin("18:00"))).toBe(60);
  });
  it("tblMesin 'Part utama, Bisa ganti ke' jadi id part", () => {
    expect(m.machines[0].opts).toEqual([PF, "PF Iron Cage|6901-J|D2"]);
    expect(machineOpts("628 JD2", [{ id: "x", category: "c", name: "628-J", type: "D2", rate: 1, key: "", label: "" }])).toEqual(["x"]);
  });
});

describe("Perencanaan: kapasitas", () => {
  it("manual dihitung per orang (STKI x jam efektif)", () => {
    const r = compute(m, base([{ name: "A", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }]), toMin("16:00"));
    expect(row(r, "seiretsu").est).toBe(4600); // 600 x 460/60
  });
  it("pindah jam 13:00: jam Seiretsu berhenti, MC mulai jalan", () => {
    const p = assign({ name: "Fahrida", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }, { at: toMin("13:00"), cat: "PF Iron Cage", mcs: ["MC 12"] });
    const r = compute(m, base([p]), toMin("16:00"));
    expect(row(r, "seiretsu").est).toBe(2800); // 07:20-12:00
    expect(row(r, "pf").est).toBe(3000); // 13:00-16:00 x 1000
  });
  it("MC tanpa operator = 0, batas MC per operator tidak menggelembungkan kapasitas", () => {
    const r = compute(m, base([{ name: "B", segs: [{ at: 420, cat: "PF Iron Cage", mcs: ["MC 12", "MC 13", "MC 14", "MC 15"] }] }]), toMin("16:00"));
    expect(row(r, "pf").mcs).toHaveLength(3);
    expect(row(r, "pf").est).toBe(3 * 1000 * (460 / 60));
    expect(r.issues.some((i) => i.level === "error" && /batasnya 3/.test(i.text))).toBe(true);
  });
  it("MC dipegang dua orang di jam yang sama: error dan tidak dihitung dobel", () => {
    const r = compute(
      m,
      base([
        { name: "B", segs: [{ at: 420, cat: "PF Iron Cage", mcs: ["MC 12"] }] },
        { name: "C", segs: [{ at: 420, cat: "PF Iron Cage", mcs: ["MC 12"] }] },
      ]),
      toMin("16:00"),
    );
    expect(row(r, "pf").est).toBe(Math.round(1000 * (460 / 60)));
    expect(r.issues.some((i) => i.level === "error" && /dipegang B dan C/.test(i.text))).toBe(true);
    expect(mcHolders(base([{ name: "B", segs: [{ at: 420, cat: "PF Iron Cage", mcs: ["MC 12"] }] }]), m, 600).get("PF Iron Cage|MC 12")).toBe("B");
  });
  it("orang tidak masuk tidak dihitung", () => {
    const r = compute(m, base([{ name: "A", absent: "Sakit", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }]), toMin("16:00"));
    expect(r.rows).toHaveLength(0);
    expect(r.absent).toBe(1);
  });
  it("lepas jam 13:00 = cadangan sesudahnya", () => {
    const p = release({ name: "A", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }, toMin("13:00"));
    expect(row(compute(m, base([p]), toMin("16:00")), "seiretsu").est).toBe(2800);
  });
});

describe("Perencanaan: status & saran", () => {
  it("SAFE / WARNING (butuh lembur) / CRITICAL", () => {
    const a = [{ name: "A", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }];
    expect(row(compute(m, base(a, { [KEY]: { seiretsu: 4000 } }), 960), "seiretsu").status).toBe("SAFE");
    expect(row(compute(m, base(a, { [KEY]: { seiretsu: 4500 } }), 960), "seiretsu").status).toBe("WARNING");
    const w = row(compute(m, base(a, { [KEY]: { seiretsu: 6000 } }), 960), "seiretsu");
    expect(w.status).toBe("WARNING"); // terkejar dengan lembur 4 jam (4600 + 2400)
    expect(w.extraHours).toBeCloseTo(1400 / 600);
    expect(row(compute(m, base(a, { [KEY]: { seiretsu: 9000 } }), 960), "seiretsu").status).toBe("CRITICAL");
  });
  it("target tanpa orang = CRITICAL; saran ambil dari cadangan", () => {
    const st = base([{ name: "Pool", segs: [] }], { [KEY]: { seiretsu: 2000 } });
    const r = compute(m, st, 960);
    expect(row(r, "seiretsu").status).toBe("CRITICAL");
    const s = suggest(m, st, r, toMin("08:00"));
    expect(s[0].who).toBe("Pool");
    expect(s[0].seg).toMatchObject({ at: 480, cat: "Seiretsu Iron Cage", part: S });
  });
  it("kelebihan orang terdeteksi", () => {
    const people = ["A", "B", "C"].map((name) => ({ name, segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }));
    expect(row(compute(m, base(people, { [KEY]: { seiretsu: 4000 } }), 960), "seiretsu").surplus).toBe(2);
  });
});

describe("Perencanaan: jam dari-sampai", () => {
  it("PF 07-11 lalu kembali ke Seiretsu", () => {
    const p = assignRange({ name: "A", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] }, { at: 420, cat: "PF Iron Cage", mcs: ["MC 12"] }, toMin("11:00"), 960);
    expect(p.segs).toEqual([{ at: 420, cat: "PF Iron Cage", mcs: ["MC 12"] }, { at: 660, cat: "Seiretsu Iron Cage", part: S }]);
    const r = compute(m, base([p]), 960);
    expect(row(r, "pf").est).toBe(Math.round(1000 * (220 / 60))); // 07:20-11:00
  });
  it("lembur satu orang tidak membuat semua orang ikut lembur", () => {
    const st = base([
      { name: "A", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] },
      { name: "B", segs: [{ at: 420, cat: "Seiretsu Iron Cage", part: S }] },
    ]);
    const st2 = extendOt(m, st, 120);
    const end = toMin("18:00");
    st2.people[0] = assignRange(st2.people[0], { at: toMin("16:00"), cat: "Seiretsu Iron Cage", part: S }, end, end);
    expect(row(compute(m, st2, end), "seiretsu").est).toBe(4600 * 2 + 1200);
  });
});

describe("Perencanaan: tempel PO", () => {
  it("membaca berbagai format baris PO", () => {
    const r = parsePo("627-J D1\t800.000\nGDD629*D2  J 300,000\n6901J D2 5000 pcs\nBaris aneh\n629-J D3 100", m);
    expect(r.po).toEqual({ "iron|627J|D1": 800000, "iron|629J|D2": 300000, "iron|6901J|D2": 5000 });
    expect(r.miss).toEqual(["Baris aneh", "629-J D3 100"]);
  });
});
