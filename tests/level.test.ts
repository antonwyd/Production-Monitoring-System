import { describe, expect, it } from "vitest";
import { hitungLevel, poinHari, poinKirim, tipHari, karakterDari, type HariMember } from "../src/lib/level";

const hari = (date: string, o: Partial<HariMember> = {}): HariMember => ({
  date, disetujui: true, kirim: `${date} 15:30:00`, lembur: false, ditolak: false, diedit: false, std: 7.6, rated: 8, qty: 1000, ng: 0, ...o,
});
const NG = 0.001;

describe("level member", () => {
  it("poin harian maksimal 10, kiriman belum disetujui 0", () => {
    expect(poinHari(hari("2026-11-03"), NG).total).toBe(10);
    expect(poinHari(hari("2026-11-03", { disetujui: false }), NG).total).toBe(0);
    expect(poinHari(hari("2026-11-03", { kirim: "2026-11-03 18:30:00", ditolak: true, std: 6, ng: 50 }), NG).total).toBe(1);
  });

  it("poin jam kirim: 16:30 tanpa lembur, 19:00 bila lembur", () => {
    const d = "2026-11-03";
    const p = (jam: string, lembur = false, hari = d) => poinKirim({ date: d, kirim: `${hari} ${jam}:00`, lembur }).poin;
    expect(p("16:30")).toBe(2);
    expect(p("16:31")).toBe(-1);
    expect(p("18:30", true)).toBe(2);
    expect(p("19:00", true)).toBe(2);
    expect(p("19:01", true)).toBe(-1);
    expect(p("08:00", false, "2026-11-04")).toBe(-1);
  });

  it("naik level butuh poin DAN kualitas 30 hari", () => {
    const days = Array.from({ length: 16 }, (_, i) => hari(`2026-10-${String(10 + i).padStart(2, "0")}`));
    const r = hitungLevel(days, "2026-11-04", NG); // 160 poin, ach 95%
    expect(r.poin).toBe(160);
    expect(r.level.lv).toBe(3);
    const days20 = Array.from({ length: 20 }, (_, i) => hari(`2026-10-${String(10 + i).padStart(2, "0")}`, { std: 6.6 }));
    const lemah = hitungLevel(days20, "2026-11-04", NG); // 160 poin tapi ach 82.5%
    expect(lemah.lvPoin).toBe(3);
    expect(lemah.level.lv).toBe(2);
    expect(lemah.kurang.join(" ")).toContain("Achievement");
  });

  it("Lv 5 hilang bila ada laporan ditolak 30 hari terakhir", () => {
    const days = Array.from({ length: 55 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10);
      return hari(d, { std: 7.8 });
    });
    expect(hitungLevel(days, "2026-11-04", NG).level.lv).toBe(5);
    days[days.length - 1] = { ...days[days.length - 1], ditolak: true };
    expect(hitungLevel(days, "2026-11-04", NG).level.lv).toBe(4);
  });

  it("tips dimatikan dulu", () => {
    expect(tipHari("2026-11-04")).toBeNull();
  });

  it("karakter default dari jenis kelamin bila belum memilih", () => {
    expect(karakterDari("", "P").dipilih).toBe(false);
    expect(karakterDari("hijab", "").emoji).toBe("🧕");
  });
});
