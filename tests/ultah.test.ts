import { describe, expect, it } from "vitest";
import { tanggalLahir, ulangTahun, ucapanUltah } from "../src/lib/ultah";

describe("ulang tahun", () => {
  it("membaca berbagai format tanggal lahir", () => {
    expect(tanggalLahir("1975-02-22")).toBe("1975-02-22");
    expect(tanggalLahir("1975/2/22")).toBe("1975-02-22");
    expect(tanggalLahir("22/02/1975")).toBe("1975-02-22");
    expect(tanggalLahir(27447)).toBe("1975-02-22");
    expect(tanggalLahir("")).toBe("");
  });
  it("cocok bulan & tanggal, 29 Feb dirayakan 28 Feb di tahun biasa", () => {
    expect(ulangTahun("2003-11-04", "2026-11-04")).toBe(true);
    expect(ulangTahun("2003-11-05", "2026-11-04")).toBe(false);
    expect(ulangTahun("2000-02-29", "2027-02-28")).toBe(true);
    expect(ulangTahun("2000-02-29", "2028-02-28")).toBe(false);
  });
  it("ucapan memakai nama depan", () => {
    expect(ucapanUltah("Risfan Wiguna")).toContain("Risfan!");
  });
});
