import { describe, expect, it } from "vitest";
import { JENAKA, PANTUN, PANTUN_HIDUP, PANTUN_SEMANGAT, PERIBAHASA, PESAN_LAKI, TEBAK, jenisKelamin, pesanKirim, pilihIsi } from "../src/lib/pantun";

const tgl = (awal: string, i: number) => new Date(Date.parse(awal + "T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);

describe("pesan setelah kirim (v6.5: tema per hari)", () => {
  it("Senin kehidupan, Selasa semangat, Rabu jenaka, Kamis peribahasa, Jumat tebakan, Sabtu/Minggu kosong", () => {
    // 2 Nov 2026 = Senin
    const tema = Array.from({ length: 7 }, (_, i) => pilihIsi("201001", tgl("2026-11-02", i)).tema ?? null);
    expect(tema).toEqual(["kehidupan", "semangat", "jenaka", "peribahasa", "tebak", null, null]);
    expect(pesanKirim("P", "201001", "2026-11-07").pesan).toBe("");
    expect(pesanKirim("L", "201001", "2026-11-08")).toEqual({ pesan: "" });
  });
  it("laki-laki dapat isi + pengingat sholat, tanpa pantun khusus perempuan", () => {
    for (let i = 0; i < 400; i++) {
      const r = pesanKirim("L", "201003", tgl("2026-11-02", i));
      if (!r.pesan) continue;
      expect(r.sholat).toBe(PESAN_LAKI);
      expect(r.pesan).not.toMatch(/wanita|cantik|menawan/i);
    }
    expect(pesanKirim("", "201001", "2026-11-04")).toEqual({ pesan: "" });
  });
  it("tebakan & peribahasa punya jawaban; isi tidak berulang sebelum daftar tema habis", () => {
    const r = pilihIsi("201001", "2026-11-06");
    expect(TEBAK.map((t) => t.q)).toContain(r.pesan);
    expect(r.jawab).toBeTruthy();
    expect(PERIBAHASA.length).toBe(50);
    expect(PANTUN.length).toBe(100);
    expect(PANTUN_HIDUP.length + PANTUN_SEMANGAT.length).toBe(100);
    const rabu = Array.from({ length: JENAKA.length }, (_, w) => pilihIsi("201001", tgl("2026-11-04", w * 7)).pesan);
    expect(new Set(rabu).size).toBe(JENAKA.length);
    const senin = Array.from({ length: PANTUN_HIDUP.length }, (_, w) => pilihIsi("201001", tgl("2026-11-02", w * 7)).pesan);
    expect(new Set(senin).size).toBe(PANTUN_HIDUP.length);
  });
  it("tetap untuk orang+tanggal yang sama dan beda antar orang", () => {
    expect(pilihIsi("201001", "2026-11-04")).toEqual(pilihIsi("201001", "2026-11-04"));
    const beda = new Set(Array.from({ length: 30 }, (_, i) => pilihIsi(String(201000 + i), "2026-11-04").pesan));
    expect(beda.size).toBeGreaterThan(10);
  });
  it("membaca isi kolom jenis kelamin", () => {
    expect(jenisKelamin("L")).toBe("L");
    expect(jenisKelamin(" Perempuan ")).toBe("P");
    expect(jenisKelamin("wanita")).toBe("P");
    expect(jenisKelamin("")).toBe("");
  });
});
