import { describe, expect, it } from "vitest";
import { hitungLevel, hitungStreak, poinHari, poinKirim, tipHari, karakterDari, type HariMember } from "../src/lib/level";

const hari = (date: string, o: Partial<HariMember> = {}): HariMember => ({
  date, disetujui: true, kirim: `${date} 15:30:00`, otMin: 0, libur: false, ditolak: false, diedit: false, std: 7.6, rated: 8, qty: 1000, ng: 0, ...o,
});

describe("level member", () => {
  it("poin harian maksimal 10, kiriman belum disetujui 0", () => {
    expect(poinHari(hari("2026-11-03")).total).toBe(8);
    expect(poinHari(hari("2026-11-03", { disetujui: false })).total).toBe(0);
    expect(poinHari(hari("2026-11-03", { kirim: "2026-11-03 18:30:00", ditolak: true, std: 6, ng: 50 })).total).toBe(0); // 2 - 1 - 1
  });

  it("poin jam kirim: maks 30 menit setelah jam kerja (lembur menyambung dari 16:00)", () => {
    const d = "2026-11-03";
    const p = (jam: string, otMin = 0, hari = d, libur = false) => poinKirim({ date: d, kirim: `${hari} ${jam}:00`, otMin, libur }).poin;
    expect(p("16:30")).toBe(2);
    expect(p("16:31")).toBe(-1);
    expect(p("17:30", 60)).toBe(2); // lembur 1 jam selesai 17:00
    expect(p("17:31", 60)).toBe(-1);
    expect(p("19:00", 150)).toBe(2); // lembur 2,5 jam selesai 18:30
    expect(p("19:01", 150)).toBe(-1);
    expect(p("08:00", 0, "2026-11-04")).toBe(-1);
    expect(p("16:30", 480, d, true)).toBe(2); // hari libur 8 jam
    expect(p("18:30", 600, d, true)).toBe(2); // hari libur 10 jam
  });

  it("streak +5 tiap 5 laporan sempurna berturut-turut; hari tanpa kiriman tidak memutus", () => {
    const d = (n: number, o: Partial<HariMember> = {}) => hari(`2026-10-${String(n).padStart(2, "0")}`, o);
    // 1,2,3 sempurna, 4-5 tidak lapor (sakit), 6,7 sempurna -> bonus 1
    expect(hitungStreak([d(1), d(2), d(3), d(6), d(7)])).toEqual({ streak: 0, bonusStreak: 1 });
    // hari ke-3 telat -> mulai lagi
    expect(hitungStreak([d(1), d(2), d(3, { kirim: "2026-10-03 17:00:00" }), d(6), d(7)])).toEqual({ streak: 2, bonusStreak: 0 });
    expect(hitungLevel([d(1), d(2), d(3), d(6), d(7)], "2026-10-07").poin).toBe(5 * 8 + 5);
  });

  it("naik level butuh poin DAN kualitas 30 hari", () => {
    const days = Array.from({ length: 20 }, (_, i) => hari(`2026-10-${String(10 + i).padStart(2, "0")}`));
    const r = hitungLevel(days, "2026-11-04"); // 20 x 8 = 160 poin, ach 95%
    expect(r.poin).toBe(160);
    expect(r.level.lv).toBe(3);
    const days20 = Array.from({ length: 26 }, (_, i) => hari(`2026-10-${String(5 + i).padStart(2, "0")}`, { std: 6.6 }));
    const lemah = hitungLevel(days20, "2026-11-04"); // 26 x 6 = 156 poin tapi ach 82.5%
    expect(lemah.lvPoin).toBe(3);
    expect(lemah.level.lv).toBe(2);
    expect(lemah.kurang.join(" ")).toContain("Achievement");
  });

  it("Lv 5 hilang bila ada laporan ditolak 30 hari terakhir", () => {
    const days = Array.from({ length: 70 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10);
      return hari(d, { std: 7.8 });
    });
    expect(hitungLevel(days, "2026-11-04").level.lv).toBe(5);
    days[days.length - 1] = { ...days[days.length - 1], ditolak: true };
    expect(hitungLevel(days, "2026-11-04").level.lv).toBe(4);
  });

  it("tips dimatikan dulu", () => {
    expect(tipHari("2026-11-04")).toBeNull();
  });

  it("karakter default dari jenis kelamin bila belum memilih", () => {
    expect(karakterDari("", "P").dipilih).toBe(false);
    expect(karakterDari("hijab", "").emoji).toBe("🧕");
  });
});
