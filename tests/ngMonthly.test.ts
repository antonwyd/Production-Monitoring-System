import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildNgMonthlyFrom, jatuhProcOf, partKey, pressOf, sectionTotals } from "../src/lib/ngMonthly";
import { ngMonthlyToXlsx } from "../src/lib/ngMonthlyExcel";
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
const f = (cat: string, part: string, type: string, lot: string, qty: number, ng: Record<number, number>) =>
  ({ categoryName: cat, partId: partId(cat, part, type), part: `${part} ${type}`, lot, qty, ng: Array.from({ length: 10 }, (_, i) => ng[i + 1] ?? 0) }) as unknown as Fact;

// Contoh dari laporan 2 Nov 2026.
const facts = [
  f("Seiretsu Iron Cage", "6900-J", "D1", "012606033", 25200, { 7: 26 }),
  f("Senbetsu Iron Cage", "6802-H", "D2", "012606032", 4500, { 5: 8, 7: 136 }),
  f("Senbetsu Iron Cage", "6802-H", "D2", "012606032", 2250, { 7: 40 }),
  f("Senbetsu Iron Cage", "627-J", "D2", "312608038", 4752, { 7: 2 }),
  f("PF Iron Cage", "627-J", "D2", "312608038", 46980, { 9: 3 }),
  f("Senbetsu Iron Cage", "627-J", "D1", "332607031", 21600, { 9: 5, 10: 2 }),
  f("Senbetsu Iron Cage", "629-J NC", "D2", "312609042", 1000, { 7: 1 }),
  f("Senbetsu Iron Cage", "626B-H", "D1", "012601001", 500, {}),
  f("Senbetsu Iron Cage", "629-J", "D2", "XX1", 100, { 1: 1 }),
  f("Senbetsu Plastik Cage", "6902T1X", "-", "302602051", 10400, { 2: 1, 4: 17, 5: 2 }),
  f("Seiretsu Plastik Cage", "6902T1X", "-", "302602051", 7800, {}),
];

describe("Laporan NG bulanan (format QC)", () => {
  const d = buildNgMonthlyFrom(master, "2026-11", facts);
  const lotOf = (si: number, part: string, type: string) => d.qc[si].parts.find((p) => p.part === part)!.types.find((t) => t.type === type)!.lots;
  it("press: 01 = Japan, 31/33 = Indonesia, lainnya lot lain", () => {
    expect([pressOf("0126"), pressOf("31x"), pressOf("33x"), pressOf("30x")]).toEqual(["JPN", "PT", "PT", "LAIN"]);
    expect(d.qc.map((s) => s.title)).toEqual(["CAGE BEARING PRESS JAPAN", "CAGE BEARING PRESS INDONESIA", "CAGE BEARING (LOT LAIN)", "PLASTIC"]);
  });
  it("urutan part & type mengikuti template, semua part template tampil", () => {
    expect(d.qc[0].parts.slice(0, 3).map((p) => p.part)).toEqual(["625-H", "626-BH", "688-AH"]);
    expect(d.qc[0].parts).toHaveLength(20);
    expect(d.qc[1].parts.find((p) => p.part === "629-J")!.types.map((t) => t.type)).toEqual(["D1", "D2", "D2 NC"]);
    expect(lotOf(0, "626-BH", "D1")).toHaveLength(1); // 626B-H Master Data = 626-BH template
    expect(lotOf(1, "629-J", "D2 NC")[0].after).toBe(1000); // 629-J NC
    expect(partKey("6900TIX")).toBe(partKey("6900T1X"));
    expect(d.qc[3].parts.find((p) => p.part === "6902 T1X")!.types[0].lots[0].after).toBe(10400);
  });
  it("After = qty Senbetsu, Before = After + NG, NG dari semua proses", () => {
    const h = lotOf(0, "6802-H", "D2")[0];
    expect(h.after).toBe(6750);
    expect(h.ng[6]).toBe(176);
    expect(lotOf(0, "6900-J", "D1")[0]).toEqual({ lot: "012606033", after: null, ng: [0, 0, 0, 0, 0, 0, 26, 0, 0, 0] });
    expect(lotOf(1, "627-J", "D2")[0]).toEqual({ lot: "312608038", after: 4752, ng: [0, 0, 0, 0, 0, 0, 2, 0, 3, 0] });
    const t = sectionTotals(d.qc[3]);
    expect([t.after, t.total, t.before]).toEqual([10400, 20, 10420]);
  });
  it("produk jatuh = NG 9 per proses, urutan template", () => {
    expect(jatuhProcOf("PF Iron Cage", "PF")).toBe(3);
    expect(jatuhProcOf("Senbetsu Iron Cage", "Senbetsu")).toBe(4);
    expect(d.jatuh[0].rows.slice(0, 2).map((r) => r.part + r.type)).toEqual(["625-HD1", "625-HD2"]);
    const r627 = d.jatuh[0].rows.filter((r) => r.part === "627-J");
    expect(r627.map((r) => [r.type, r.before, r.proc[3], r.proc[4]])).toEqual([["D1", 21600, 0, 5], ["D2", 4752, 3, 0]]);
  });
  it("Excel: 10 baris lot per type dan rumus template", async () => {
    const buf = await ngMonthlyToXlsx(d);
    if (process.env.NG_XLSX_OUT) writeFileSync(process.env.NG_XLSX_OUT, buf);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["QC Result", "Produk Jatuh"]);
    const ws = wb.getWorksheet("QC Result")!;
    expect(ws.getCell("AE1").value).toBe("Periode 01/11/2026 ~ 30/11/2026");
    expect(ws.getCell("B8").value).toBe("625-H");
    expect(ws.getCell("C8").value).toBe("D1");
    expect(ws.getCell("C18").value).toBe("D2"); // D1 = baris 8-17
    expect(ws.getCell("B28").value).toBe("626-BH");
    expect(ws.getCell("E8").value).toMatchObject({ formula: "F8+AK8" });
    expect(ws.getCell("AL8").value).toMatchObject({ formula: 'IF(F8,AK8/F8,"")' });
  });
});
