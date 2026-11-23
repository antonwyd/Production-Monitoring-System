import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { addMonth, buildNgReportFrom, fyStart } from "../src/lib/ngReport";
import { ngReportToXlsx } from "../src/lib/ngReportExcel";
import { hargaOf } from "../src/lib/ngHarga";
import type { Fact } from "../src/lib/reports";
import type { MasterData } from "../src/lib/types";

const cats = ["Seiretsu Iron Cage|Seiretsu", "Senbetsu Iron Cage|Senbetsu", "PF Iron Cage|PF", "Senbetsu Plastik Cage|Senbetsu", "Seiretsu Plastik Cage|Seiretsu"].map((x, i) => {
  const [name, process] = x.split("|");
  return { id: i + 1, name, process, area: process, ngGroupId: /Plastik/.test(name) ? 2 : 1 };
});
const parts: MasterData["parts"] = [];
const partId = (cat: string, name: string, type: string) => {
  const c = cats.find((x) => x.name === cat)!;
  let p = parts.find((x) => x.categoryId === c.id && x.name === name && x.type === type);
  if (!p) parts.push((p = { id: parts.length + 1, categoryId: c.id, name, type, stki: 1000 }));
  return p.id;
};
const master = { categories: cats, parts, machines: [], lostTimeTypes: [], members: [], ngGroups: [], settings: {} } as unknown as MasterData;
const f = (date: string, cat: string, part: string, type: string, lot: string, qty: number, ng: Record<number, number>) =>
  ({ workDate: date, categoryName: cat, partId: partId(cat, part, type), part: `${part} ${type}`, lot, qty, ng: Array.from({ length: 10 }, (_, i) => ng[i + 1] ?? 0) }) as unknown as Fact;

const facts = [
  // Desember 2026 (bulan laporan)
  f("2026-12-02", "Senbetsu Iron Cage", "6802-H", "D2", "012606032", 4500, { 6: 8, 7: 136 }),
  f("2026-12-03", "Seiretsu Iron Cage", "6802-H", "D2", "012606032", 9000, { 9: 4 }),
  f("2026-12-03", "Senbetsu Iron Cage", "627-J", "D2", "312608038", 4752, { 6: 2 }),
  f("2026-12-04", "PF Iron Cage", "627-J", "D2", "312608038", 46980, { 9: 3 }),
  f("2026-12-05", "Senbetsu Plastik Cage", "6902T1X", "-", "302602051", 10400, { 2: 1, 4: 17 }),
  // November 2026 (bulan lalu)
  f("2026-11-10", "Senbetsu Iron Cage", "6802-H", "D2", "012606001", 3000, { 6: 30 }),
  f("2026-11-11", "Senbetsu Plastik Cage", "6902T1X", "-", "302602001", 5000, { 1: 50 }),
];

describe("Laporan NG lengkap (satu kali download)", () => {
  const d = buildNgReportFrom(master, "2026-12", facts);
  it("tahun fiskal April–Maret, data manual sebelum November 2026", () => {
    expect(fyStart("2026-12")).toBe("2026-04");
    expect(fyStart("2027-02")).toBe("2026-04");
    expect(addMonth("2026-12", 1)).toBe("2027-01");
    expect(d.fy.months.map((m) => m.source)).toEqual(["manual", "manual", "manual", "manual", "manual", "manual", null, "app", "app", null, null, null]);
    expect(d.fy.months[0].jpn).toEqual({ ng: 80115, sen: 8115885 });
    expect(d.fy.months[8].jpn).toEqual({ ng: 148, sen: 4500 });
    expect(d.fy.months[7].pla).toEqual({ ng: 50, sen: 5000 });
  });
  it("ringkasan per part + harga, bulan lalu, produksi per proses", () => {
    const row = d.summary[0].rows.find((r) => r.part === "6802-H" && r.type === "D2")!;
    expect(row).toMatchObject({ after: 4500, harga: 0.039 });
    expect(row.ng[5]).toBe(8);
    expect(row.ng[8]).toBe(4);
    expect(d.prev.month).toBe("2026-11");
    expect(d.prev.summary[0].rows.find((r) => r.part === "6802-H" && r.type === "D2")!.ng[5]).toBe(30);
    expect(d.jatuhProd[3]).toBe(9000 + 46980); // Seiretsu / PF Iron
    expect(d.jatuhNg[3]).toBe(7);
    expect(hargaOf("629-J", "D2 NC", false)).toBe(0.0134);
    expect(hargaOf("ML 5009", "", true)).toBe(0.012766);
  });
  it("Excel berisi semua sheet bulanan + grafik", async () => {
    const buf = await ngReportToXlsx(d);
    if (process.env.NG_SAMPLE) writeFileSync(process.env.NG_SAMPLE, buf);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "QC Result",
      "Produk Jatuh",
      "Page 1 Monthly Report QC",
      "NG% 1 Bulan",
      "NG Rate 2026",
      "Graphic Perbandingan Iron",
      "Perbandingan produk jatuh",
      "Graphic Compare Plastic",
    ]);
    const rate = wb.getWorksheet("NG Rate 2026")!;
    expect(rate.getCell("B5").value).toBe(80115);
    expect(rate.getCell("J5").value).toBe(148);
    expect(rate.getCell("H5").value).toBe(null); // Oktober belum ada data
    const p1 = wb.getWorksheet("Page 1 Monthly Report QC")!;
    expect((p1.getCell("Q28").value as { formula: string }).formula).toBe("'NG Rate 2026'!N7");
    const zip = await JSZip.loadAsync(buf);
    const charts = Object.keys(zip.files).filter((x) => /^xl\/charts\/chart\d+\.xml$/.test(x));
    expect(charts).toHaveLength(3 + 6 + 1 + 2 + 1);
  });
});
