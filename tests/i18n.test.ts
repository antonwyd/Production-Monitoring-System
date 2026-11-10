import { describe, it, expect } from "vitest";
import { tr, langFromCookieHeader } from "@/lib/i18n";

describe("bilingual laporan", () => {
  it("bahasa Indonesia tidak berubah", () => {
    expect(tr("Total Produksi", "id")).toBe("Total Produksi");
  });
  it("menerjemahkan istilah, tanggal dan format angka", () => {
    expect(tr("Semua proses", "ja")).toBe("全工程");
    expect(tr("Senin, 9 November 2026", "ja")).toBe("2026年11月9日（月）");
    expect(tr("8.420", "ja")).toBe("8,420");
    expect(tr("Bulan 2026-11", "ja")).toBe("2026年11月");
  });
  it("cookie lang", () => {
    expect(langFromCookieHeader("a=1; lang=ja")).toBe("ja");
    expect(langFromCookieHeader("a=1")).toBe("id");
    expect(langFromCookieHeader(null)).toBe("id");
  });
});
