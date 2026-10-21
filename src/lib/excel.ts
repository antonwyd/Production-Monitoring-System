import ExcelJS from "exceljs";
import type { ColFormat, Report } from "./reports";

const NUMFMT: Partial<Record<ColFormat, string>> = {
  int: "#,##0",
  dec1: "#,##0.0",
  dec2: "#,##0.00",
  pct: "0.0%",
};

export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aplikasi Laporan Produksi QA";
  if (r.kpis.length) {
    const ws = wb.addWorksheet("Ringkasan");
    ws.addRow([r.title]).font = { bold: true, size: 14 };
    ws.addRow([r.subtitle]);
    ws.addRow([]);
    for (const k of r.kpis) {
      const row = ws.addRow([k.label, k.value ?? ""]);
      if (k.format && NUMFMT[k.format]) row.getCell(2).numFmt = NUMFMT[k.format]!;
    }
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 18;
  }
  const used = new Set<string>();
  for (const t of r.tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (used.has(name)) name = name.slice(0, 28) + "_" + used.size;
    used.add(name);
    const ws = wb.addWorksheet(name);
    ws.addRow([`${r.title} – ${t.title}`]).font = { bold: true, size: 13 };
    ws.addRow([r.subtitle]);
    ws.addRow([]);
    const header = ws.addRow(t.columns.map((c) => c.label));
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
      c.border = { bottom: { style: "thin" } };
    });
    const rows = t.total ? [...t.rows, t.total] : t.rows;
    rows.forEach((row, idx) => {
      const xr = ws.addRow(t.columns.map((c) => row[c.key] ?? ""));
      t.columns.forEach((c, i) => {
        if (c.format && NUMFMT[c.format]) xr.getCell(i + 1).numFmt = NUMFMT[c.format]!;
      });
      if (t.total && idx === rows.length - 1) xr.font = { bold: true };
    });
    t.columns.forEach((c, i) => (ws.getColumn(i + 1).width = Math.max(10, c.label.length + 4)));
    ws.views = [{ state: "frozen", ySplit: 4 }];
  }
  if (!wb.worksheets.length) wb.addWorksheet("Kosong");
  return Buffer.from(await wb.xlsx.writeBuffer());
}
