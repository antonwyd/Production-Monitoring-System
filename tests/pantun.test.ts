import { describe, expect, it } from "vitest";
import { PANTUN, PESAN_LAKI, jenisKelamin, pesanKirim, pilihPantun } from "../src/lib/pantun";

describe("pesan setelah kirim", () => {
  it("laki-laki dapat pengingat sholat, perempuan pantun, kosong tanpa pesan", () => {
    expect(pesanKirim("L", "201001", "2026-11-04")).toBe(PESAN_LAKI);
    expect(PANTUN).toContain(pesanKirim("P", "201001", "2026-11-04"));
    expect(pesanKirim("", "201001", "2026-11-04")).toBe("");
  });
  it("pantun tetap untuk orang+tanggal yang sama dan bervariasi antar orang/hari", () => {
    expect(pilihPantun("201001", "2026-11-04")).toBe(pilihPantun("201001", "2026-11-04"));
    const beda = new Set(Array.from({ length: 30 }, (_, i) => pilihPantun(String(201000 + i), "2026-11-04")));
    expect(beda.size).toBeGreaterThan(10);
    const hari = new Set(Array.from({ length: 10 }, (_, i) => pilihPantun("201001", `2026-11-${String(i + 1).padStart(2, "0")}`)));
    expect(hari.size).toBeGreaterThan(5);
  });
  it("100 pantun dan satu orang tidak dapat pantun sama selama 100 hari", () => {
    expect(PANTUN.length).toBe(100);
    expect(new Set(PANTUN).size).toBe(100);
    const awal = Date.UTC(2026, 10, 4);
    const seri = Array.from({ length: 100 }, (_, i) => pilihPantun("201001", new Date(awal + i * 86400000).toISOString().slice(0, 10)));
    expect(new Set(seri).size).toBe(100);
  });
  it("membaca isi kolom jenis kelamin", () => {
    expect(jenisKelamin("L")).toBe("L");
    expect(jenisKelamin(" Perempuan ")).toBe("P");
    expect(jenisKelamin("wanita")).toBe("P");
    expect(jenisKelamin("")).toBe("");
  });
});
