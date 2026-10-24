import ExcelJS from "exceljs";
import { formatDateId, nowJakarta } from "./dates";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";
import type { ColFormat, Column, Kpi, Report, Table } from "./reports";

// File Excel untuk rapat produksi. Sheet "Laporan" = kop + logo, angka utama vs target, semua tabel
// ringkas bertumpuk, lalu kotak Dibuat / Diperiksa / Disetujui. Daftar rincian panjang di sheet sendiri.
// Siap cetak: A4 landscape, muat satu lebar halaman, nomor halaman di bawah.

const MAROON = "FF9B1B1F";
const TINT = "FFF8E8E8";
const ZEBRA = "FFF8FAFC";
const LINE = "FFE2E8F0";
const MUTED = "FF64748B";
const INK = "FF1E293B";
const GOOD = { bg: "FFD1FAE5", fg: "FF065F46" };
const BAD = { bg: "FFFEE2E2", fg: "FF991B1B" };

/** Tabel dengan baris lebih dari ini dipindah ke sheet sendiri. */
const MAX_INLINE_ROWS = 40;

const NUMFMT: Partial<Record<ColFormat, string>> = {
  int: "#,##0",
  ppm: "#,##0",
  dec1: "#,##0.0",
  dec2: "#,##0.00",
  pct: "0.0%",
  date: "dd mmm yyyy",
};

const GRADE_FILL: Record<string, { bg: string; fg: string }> = {
  A: GOOD,
  B: { bg: "FFE2E8F0", fg: INK },
  C: { bg: "FFFFEDD5", fg: "FF9A3412" },
  D: BAD,
};

const thin = { style: "thin" as const, color: { argb: LINE } };
const isNum = (f?: ColFormat) => !!f && f !== "text" && f !== "grade";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

function cellValue(v: unknown, c: Column): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (c.format === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`);
  if (isNum(c.format) && typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v as ExcelJS.CellValue;
}

/** NG rate kecil (mis. 0,12%) butuh 2 desimal, achievement cukup 1. */
function numFmtOf(c: Column, v: ExcelJS.CellValue) {
  if (c.format === "pct" && typeof v === "number" && v !== 0 && Math.abs(v) < 0.1) return "0.00%";
  return c.format ? NUMFMT[c.format] : undefined;
}

function textLen(v: ExcelJS.CellValue, c: Column): number {
  if (v === null || v === undefined) return 0;
  if (v instanceof Date) return 11;
  if (typeof v === "number") return c.format === "pct" ? 7 : Math.round(Math.abs(v)).toLocaleString("en-US").length + (c.format === "dec1" ? 2 : c.format === "dec2" ? 3 : 0);
  return String(v).length;
}

function setupPrint(ws: ExcelJS.Worksheet, title: string, repeatRow?: number) {
  ws.pageSetup = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
    ...(repeatRow ? { printTitlesRow: `${repeatRow}:${repeatRow}` } : {}),
  };
  ws.headerFooter = { oddFooter: `&L&8PT. Takai Seiki Indonesia · ${title.replace(/&/g, "&&")}&R&8Halaman &P dari &N` };
}

/** Kop: logo di kiri, nama perusahaan, judul report, periode dan waktu dibuat. Mengembalikan baris berikutnya. */
function kop(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, width: number, title: string, subtitle: string) {
  const w = Math.max(width, 6);
  const logo = wb.addImage({ base64: LOGO_PNG_BASE64, extension: "png" });
  ws.addImage(logo, { tl: { col: 0.15, row: 0.25 }, ext: { width: Math.round(46 * LOGO_RATIO), height: 46 } });
  const lines: [string, Partial<ExcelJS.Font>, number][] = [
    ["PT. TAKAI SEIKI INDONESIA", { bold: true, size: 9, color: { argb: MUTED } }, 16],
    [title, { bold: true, size: 16, color: { argb: MAROON } }, 24],
    [`${subtitle}  ·  Dibuat ${formatDateId(nowJakarta().slice(0, 10))} ${nowJakarta().slice(11, 16)} WIB`, { size: 9, color: { argb: MUTED } }, 16],
  ];
  lines.forEach(([text, font, h], i) => {
    ws.mergeCells(i + 1, 3, i + 1, w);
    const c = ws.getCell(i + 1, 3);
    c.value = text;
    c.font = font;
    c.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(i + 1).height = h;
  });
  for (let c = 1; c <= w; c++) ws.getCell(4, c).border = { top: { style: "medium", color: { argb: MAROON } } };
  ws.getRow(4).height = 8;
  return 5;
}

function sectionTitle(ws: ExcelJS.Worksheet, row: number, width: number, text: string, note?: string) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 12, color: { argb: MAROON } };
  ws.getRow(row).height = 22;
  if (note) {
    ws.mergeCells(row + 1, 1, row + 1, Math.max(width, 6));
    const n = ws.getCell(row + 1, 1);
    n.value = note;
    n.font = { italic: true, size: 9, color: { argb: MUTED } };
    return row + 2;
  }
  return row + 1;
}

/** Angka utama: Indikator | Nilai | Target | Status | Keterangan. */
function writeKpis(ws: ExcelJS.Worksheet, kpis: Kpi[], startRow: number, width: number) {
  let row = sectionTitle(ws, startRow, width, "Angka utama");
  const head = ["Indikator", "Nilai", "Target", "Status", "Keterangan"];
  head.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(MAROON);
    c.alignment = { horizontal: i === 1 || i === 2 ? "right" : i === 3 ? "center" : "left", vertical: "middle" };
  });
  ws.mergeCells(row, 5, row, Math.max(width, 6));
  ws.getRow(row).height = 20;
  row++;
  for (const k of kpis) {
    const label = ws.getCell(row, 1);
    label.value = k.label;
    label.font = { bold: true };
    const v = ws.getCell(row, 2);
    const num = typeof k.value === "number" || (typeof k.value === "string" && k.format && isNum(k.format) && !Number.isNaN(Number(k.value)));
    v.value = num ? Number(k.value) : (k.value ?? "-");
    v.font = { bold: true, size: 12 };
    v.alignment = { horizontal: "right" };
    if (num) {
      const f = numFmtOf({ key: "", label: "", format: k.format }, Number(k.value));
      if (f) v.numFmt = f;
    }
    ws.getCell(row, 3).value = k.target ?? "";
    ws.getCell(row, 3).alignment = { horizontal: "right" };
    const st = ws.getCell(row, 4);
    if (k.status) {
      const ok = k.status === "good";
      st.value = ok ? "Sesuai target" : "Di luar target";
      st.font = { bold: true, color: { argb: ok ? GOOD.fg : BAD.fg } };
      st.fill = fill(ok ? GOOD.bg : BAD.bg);
    }
    st.alignment = { horizontal: "center" };
    ws.mergeCells(row, 5, row, Math.max(width, 6));
    const hint = ws.getCell(row, 5);
    hint.value = k.hint ?? "";
    hint.font = { size: 9, color: { argb: MUTED } };
    for (let c = 1; c <= Math.max(width, 6); c++) ws.getCell(row, c).border = { ...(ws.getCell(row, c).border ?? {}), bottom: thin };
    ws.getRow(row).height = 20;
    row++;
  }
  return row + 1;
}

/** Tulis satu tabel mulai startRow. Mengembalikan lebar kolom yang dibutuhkan dan baris sesudahnya. */
function writeTable(ws: ExcelJS.Worksheet, t: Table, startRow: number) {
  const header = ws.getRow(startRow);
  t.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(MAROON);
    cell.alignment = { vertical: "middle", horizontal: isNum(c.format) ? "right" : c.format === "grade" ? "center" : "left", wrapText: true };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  header.height = 30;

  // Lebar kolom: kata terpanjang di judul kolom tidak boleh terpotong, judul panjang dibungkus 2 baris.
  const widths = t.columns.map((c) => Math.min(Math.max(...c.label.split(" ").map((w) => w.length + 3), Math.ceil(c.label.length / 2) + 3, 8), 30));
  const rows = t.total && t.rows.length ? [...t.rows, t.total] : t.rows;
  if (!rows.length) {
    ws.mergeCells(startRow + 1, 1, startRow + 1, Math.max(1, t.columns.length));
    const c = ws.getCell(startRow + 1, 1);
    c.value = "Belum ada data di periode ini.";
    c.font = { italic: true, color: { argb: MUTED } };
  }
  rows.forEach((row, idx) => {
    const isTotal = !!t.total && idx === rows.length - 1;
    const missing = row.status === "Belum lapor" || row.status === "Tidak jalan";
    const xr = ws.getRow(startRow + 1 + idx);
    t.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const v = cellValue(row[c.key], c);
      cell.value = v;
      widths[i] = Math.min(Math.max(widths[i], textLen(v, c) + 2), 50);
      const nf = numFmtOf(c, v);
      if (nf) cell.numFmt = nf;
      cell.alignment = { vertical: "middle", horizontal: isNum(c.format) ? "right" : c.format === "grade" ? "center" : "left", wrapText: !isNum(c.format) && typeof v === "string" && v.length > 50 };
      cell.border = { bottom: thin, left: thin, right: thin };
      if (isTotal) {
        cell.font = { bold: true };
        cell.fill = fill(TINT);
        cell.border = { top: { style: "double", color: { argb: MAROON } }, bottom: thin, left: thin, right: thin };
      } else if (c.format === "grade" && typeof v === "string" && GRADE_FILL[v]) {
        cell.font = { bold: true, color: { argb: GRADE_FILL[v].fg } };
        cell.fill = fill(GRADE_FILL[v].bg);
      } else if (c.key === "status" && (v === "OK" || v === "Di bawah target")) {
        const s = v === "OK" ? GOOD : BAD;
        cell.font = { bold: true, color: { argb: s.fg } };
        cell.fill = fill(s.bg);
      } else if (idx % 2 === 1) {
        cell.fill = fill(ZEBRA);
      }
      if (missing && !isTotal && c.key !== "status") cell.font = { color: { argb: "FF94A3B8" } };
      if (i === 0 && !isTotal && !missing) cell.font = { bold: true };
    });
    xr.height = 18;
  });
  // Batang data kecil di kolom porsi / utilisasi supaya pola terlihat tanpa grafik.
  const last = startRow + rows.length - (t.total && t.rows.length ? 1 : 0);
  t.columns.forEach((c, i) => {
    if (!t.rows.length || !["share", "util", "cum"].includes(c.key)) return;
    const col = ws.getColumn(i + 1).letter;
    ws.addConditionalFormatting({
      ref: `${col}${startRow + 1}:${col}${last}`,
      rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FFE8A5A7" } } as unknown as ExcelJS.ConditionalFormattingRule],
    });
  });
  return { widths, next: startRow + 1 + Math.max(rows.length, 1) };
}

/** Kotak tanda tangan Dibuat / Diperiksa / Disetujui selebar tabel. */
function signBoxes(ws: ExcelJS.Worksheet, startRow: number, width: number) {
  const w = Math.max(width, 6);
  const parts = ["Dibuat", "Diperiksa", "Disetujui"];
  const span = Math.floor(w / 3);
  const row = startRow + 1;
  parts.forEach((p, i) => {
    const c1 = 1 + i * span;
    const c2 = i === 2 ? w : c1 + span - 1;
    ws.mergeCells(row, c1, row, c2);
    ws.mergeCells(row + 1, c1, row + 4, c2);
    ws.mergeCells(row + 5, c1, row + 5, c2);
    const h = ws.getCell(row, c1);
    h.value = p;
    h.font = { bold: true, color: { argb: INK } };
    h.alignment = { horizontal: "center", vertical: "middle" };
    h.fill = fill(TINT);
    const n = ws.getCell(row + 5, c1);
    n.value = "Nama:                         Tgl:";
    n.font = { size: 9, color: { argb: MUTED } };
    for (let r = row; r <= row + 5; r++)
      for (let c = c1; c <= c2; c++)
        ws.getCell(r, c).border = {
          top: r === row || r === row + 1 || r === row + 5 ? { style: "thin", color: { argb: "FF94A3B8" } } : undefined,
          bottom: r === row + 5 ? { style: "thin", color: { argb: "FF94A3B8" } } : undefined,
          left: c === c1 ? { style: "thin", color: { argb: "FF94A3B8" } } : undefined,
          right: c === c2 ? { style: "thin", color: { argb: "FF94A3B8" } } : undefined,
        };
  });
  for (let r = row + 1; r <= row + 4; r++) ws.getRow(r).height = 16;
  return row + 6;
}

function sheetName(title: string, used: Set<string>) {
  let name = title.replace(/[\\/?*[\]:'"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Tabel";
  while (used.has(name)) name = `${name.slice(0, 27)} (${used.size})`;
  used.add(name);
  return name;
}

export async function reportToXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production · PT. Takai Seiki Indonesia";
  wb.created = new Date();

  const inline = r.tables.filter((t) => !t.detail && t.rows.length <= MAX_INLINE_ROWS);
  const separate = r.tables.filter((t) => !inline.includes(t));
  const width = Math.max(6, ...inline.map((t) => t.columns.length));

  const ws = wb.addWorksheet("Laporan", { properties: { tabColor: { argb: MAROON } }, views: [{ showGridLines: false }] });
  let row = kop(wb, ws, width, r.title, r.subtitle);
  row++;
  const widths: number[] = Array(width).fill(10);
  if (r.kpis.length) {
    row = writeKpis(ws, r.kpis, row, width);
    widths[0] = Math.max(widths[0], ...r.kpis.map((k) => k.label.length + 3));
    widths[1] = Math.max(widths[1], 14);
    widths[2] = Math.max(widths[2], 12);
    widths[3] = Math.max(widths[3], 15);
  }
  for (const t of inline) {
    row = sectionTitle(ws, row, width, t.title, t.note);
    const out = writeTable(ws, t, row);
    out.widths.forEach((w, i) => (widths[i] = Math.max(widths[i], w)));
    row = out.next + 1;
  }
  const used = new Set<string>(["Laporan"]);
  const names = separate.map((t) => sheetName(t.title, used));
  if (separate.length) {
    row = sectionTitle(ws, row, width, "Rincian di sheet lain");
    separate.forEach((t, i) => {
      const c = ws.getCell(row, 1);
      c.value = { text: `→ ${t.title} (${t.rows.length} baris)`, hyperlink: `#'${names[i]}'!A1` };
      c.font = { color: { argb: MAROON }, underline: true };
      row++;
    });
    row++;
  }
  const foot = ws.getCell(row, 1);
  foot.value = "Angka dihitung dari laporan yang sudah disetujui leader.";
  foot.font = { italic: true, size: 9, color: { argb: MUTED } };
  row = signBoxes(ws, row + 1, width);
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = Math.min(Math.max(w, 9), 40)));
  setupPrint(ws, r.title);

  separate.forEach((t, i) => {
    const s = wb.addWorksheet(names[i], { views: [{ state: "frozen", ySplit: 6, showGridLines: false }] });
    const start = kop(wb, s, t.columns.length, `${r.title} · ${t.title}`, r.subtitle) + 1;
    const out = writeTable(s, t, start);
    out.widths.forEach((w, j) => (s.getColumn(j + 1).width = Math.max(w, 9)));
    if (t.rows.length) s.autoFilter = { from: { row: start, column: 1 }, to: { row: start + t.rows.length, column: t.columns.length } };
    setupPrint(s, `${r.title} · ${t.title}`, start);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
