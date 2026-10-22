import ExcelJS from "exceljs";
import { formatDateId, nowJakarta } from "./dates";
import type { ColFormat, Column, Report, Table } from "./reports";

// File Excel untuk meeting produksi: judul berwarna marun TAKAI, header tebal, angka rata kanan,
// baris total ditebalkan, grade berwarna, siap cetak (landscape, muat satu lebar halaman).

const MAROON = "FF9B1B1F";
const TINT = "FFF8E8E8";
const ZEBRA = "FFF8FAFC";
const LINE = "FFE2E8F0";
const MUTED = "FF64748B";

const NUMFMT: Partial<Record<ColFormat, string>> = {
  int: "#,##0",
  dec1: "#,##0.0",
  dec2: "#,##0.00",
  pct: "0.0%",
  date: "dd mmm yyyy",
};

const GRADE_FILL: Record<string, { bg: string; fg: string }> = {
  A: { bg: "FFD1FAE5", fg: "FF065F46" },
  B: { bg: "FFE2E8F0", fg: "FF1E293B" },
  C: { bg: "FFFFEDD5", fg: "FF9A3412" },
  D: { bg: "FFFEE2E2", fg: "FF991B1B" },
};

const thin = { style: "thin" as const, color: { argb: LINE } };
const isNum = (f?: ColFormat) => !!f && f !== "text" && f !== "grade";

function cellValue(v: unknown, c: Column): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (c.format === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`);
  if (isNum(c.format) && typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v as ExcelJS.CellValue;
}

function textLen(v: ExcelJS.CellValue, c: Column): number {
  if (v === null || v === undefined) return 0;
  if (v instanceof Date) return 11;
  if (typeof v === "number") return c.format === "pct" ? 7 : Math.round(Math.abs(v)).toLocaleString("en-US").length + (c.format === "dec1" ? 2 : c.format === "dec2" ? 3 : 0);
  return String(v).length;
}

function setupPrint(ws: ExcelJS.Worksheet, headerRow: number) {
  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRow}:${headerRow}`,
  };
  ws.headerFooter = { oddFooter: "&L&8PT. Takai Seiki Indonesia · Laporan Produksi QA&R&8Halaman &P dari &N" };
}

/** Baris judul marun selebar tabel, lalu subjudul abu-abu. */
function titleBlock(ws: ExcelJS.Worksheet, width: number, title: string, subtitle: string) {
  const w = Math.max(width, 4);
  ws.mergeCells(1, 1, 1, w);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAROON } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 30;
  ws.mergeCells(2, 1, 2, w);
  const s = ws.getCell(2, 1);
  s.value = `${subtitle}  ·  Dibuat ${formatDateId(nowJakarta().slice(0, 10))} ${nowJakarta().slice(11, 16)} WIB`;
  s.font = { italic: true, size: 10, color: { argb: MUTED } };
  s.alignment = { indent: 1 };
  ws.getRow(2).height = 18;
}

function writeTable(ws: ExcelJS.Worksheet, t: Table, startRow: number) {
  const header = ws.getRow(startRow);
  t.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAROON } };
    cell.alignment = { vertical: "middle", horizontal: isNum(c.format) ? "right" : c.format === "grade" ? "center" : "left", wrapText: true };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  header.height = 30;

  // Lebar kolom: kata terpanjang di judul kolom tidak boleh terpotong, judul panjang dibungkus 2 baris.
  const widths = t.columns.map((c) => Math.min(Math.max(...c.label.split(" ").map((w) => w.length + 3), Math.ceil(c.label.length / 2) + 2, 8), 30));
  const rows = t.total && t.rows.length ? [...t.rows, t.total] : t.rows;
  if (!rows.length) {
    ws.mergeCells(startRow + 1, 1, startRow + 1, Math.max(1, t.columns.length));
    const c = ws.getCell(startRow + 1, 1);
    c.value = "Belum ada data di periode ini.";
    c.font = { italic: true, color: { argb: MUTED } };
  }
  rows.forEach((row, idx) => {
    const isTotal = !!t.total && idx === rows.length - 1;
    const missing = row.status === "Belum lapor";
    const xr = ws.getRow(startRow + 1 + idx);
    t.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const v = cellValue(row[c.key], c);
      cell.value = v;
      widths[i] = Math.min(Math.max(widths[i], textLen(v, c) + 2), 50);
      if (c.format && NUMFMT[c.format]) cell.numFmt = NUMFMT[c.format]!;
      cell.alignment = { vertical: "middle", horizontal: isNum(c.format) ? "right" : c.format === "grade" ? "center" : "left", wrapText: !isNum(c.format) && typeof v === "string" && v.length > 50 };
      cell.border = { bottom: thin, left: thin, right: thin };
      if (isTotal) {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };
        cell.border = { top: { style: "double", color: { argb: MAROON } }, bottom: thin, left: thin, right: thin };
      } else if (c.format === "grade" && typeof v === "string" && GRADE_FILL[v]) {
        cell.font = { bold: true, color: { argb: GRADE_FILL[v].fg } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRADE_FILL[v].bg } };
      } else if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      if (missing && !isTotal) cell.font = { color: { argb: "FF9A3412" } };
      if (i === 0 && !isTotal && !missing) cell.font = { bold: true };
    });
    xr.height = 18;
  });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = Math.max(w, 8)));
  if (t.rows.length && t.columns.length)
    ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow + t.rows.length, column: t.columns.length } };
}

export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Laporan Produksi QA · PT. Takai Seiki Indonesia";
  wb.created = new Date();

  // Halaman pertama: ringkasan angka utama + daftar isi.
  const sum = wb.addWorksheet("Ringkasan", { properties: { tabColor: { argb: MAROON } }, views: [{ showGridLines: false }] });
  titleBlock(sum, 4, r.title, r.subtitle);
  sum.getColumn(1).width = 34;
  sum.getColumn(2).width = 18;
  sum.getColumn(3).width = 34;
  sum.getColumn(4).width = 4;
  let row = 4;
  if (r.kpis.length) {
    sum.getCell(row, 1).value = "Angka utama";
    sum.getCell(row, 1).font = { bold: true, size: 12, color: { argb: MAROON } };
    row++;
    for (const k of r.kpis) {
      const l = sum.getCell(row, 1);
      l.value = k.label;
      l.font = { color: { argb: "FF334155" } };
      const v = sum.getCell(row, 2);
      v.value = typeof k.value === "string" && k.format && isNum(k.format) && !Number.isNaN(Number(k.value)) ? Number(k.value) : k.value ?? "-";
      v.font = { bold: true, size: 13 };
      v.alignment = { horizontal: "right" };
      if (k.format && NUMFMT[k.format]) v.numFmt = NUMFMT[k.format]!;
      if (k.hint) {
        sum.getCell(row, 3).value = k.hint;
        sum.getCell(row, 3).font = { italic: true, size: 9, color: { argb: MUTED } };
      }
      [1, 2, 3].forEach((c) => (sum.getCell(row, c).border = { bottom: thin }));
      sum.getRow(row).height = 22;
      row++;
    }
    row++;
  }
  sum.getCell(row, 1).value = "Isi file ini";
  sum.getCell(row, 1).font = { bold: true, size: 12, color: { argb: MAROON } };
  row++;

  const used = new Set<string>(["Ringkasan"]);
  const sheets: { name: string; table: Table }[] = [];
  for (const t of r.tables) {
    let name = t.title.replace(/[\\/?*[\]:'"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Tabel";
    while (used.has(name)) name = `${name.slice(0, 27)} (${used.size})`;
    used.add(name);
    sheets.push({ name, table: t });
  }
  for (const { name, table } of sheets) {
    const c = sum.getCell(row, 1);
    c.value = { text: `→ ${table.title}`, hyperlink: `#'${name}'!A1` };
    c.font = { color: { argb: MAROON }, underline: true };
    sum.getCell(row, 2).value = `${table.rows.length} baris`;
    sum.getCell(row, 2).font = { color: { argb: MUTED }, size: 9 };
    sum.getCell(row, 2).alignment = { horizontal: "right" };
    row++;
  }
  sum.getCell(row + 1, 1).value = "Angka dihitung dari laporan yang sudah disetujui leader.";
  sum.getCell(row + 1, 1).font = { italic: true, size: 9, color: { argb: MUTED } };
  setupPrint(sum, 1);
  sum.pageSetup.orientation = "portrait";

  for (const { name, table } of sheets) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    titleBlock(ws, table.columns.length, `${r.title} · ${table.title}`, r.subtitle);
    writeTable(ws, table, 4);
    setupPrint(ws, 4);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
