import ExcelJS from "exceljs";
import { IRON_NG, IRON_NG_JA, JATUH_PROC, PLASTIC_NG, type NgMonthly } from "./ngMonthly";

// Excel Laporan NG bulanan dengan susunan sama seperti template QC ("Laporan NG.xlsx"):
// angka diisi dari web, kolom After / Total / Percentage tetap rumus Excel supaya bisa dikoreksi manual.

const FONT = "Meiryo UI";
const HEAD = "FFF2F2F2";
const SEC = "FFFCE4D6";
const TOT = "FFFFF2CC";
const ACC = "_(* #,##0_);_(* (#,##0);_(* \"-\"_);_(@_)";
const med = { style: "medium" as const };
const thin = { style: "thin" as const };
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

const col = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function ddmmyyyy(d: string) {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Gaya dasar + border kotak untuk rentang. */
function frame(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, opts: { fill?: string; bold?: boolean; size?: number; rotate?: boolean; fmt?: string; align?: "center" | "left" | "right" } = {}) {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  const cell = ws.getCell(r1, c1);
  cell.font = { name: FONT, size: opts.size ?? 10, bold: opts.bold };
  cell.alignment = { horizontal: opts.align ?? "center", vertical: "middle", wrapText: !opts.rotate, textRotation: opts.rotate ? 90 : undefined };
  if (opts.fill) cell.fill = fill(opts.fill);
  if (opts.fmt) cell.numFmt = opts.fmt;
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const x = ws.getCell(r, c);
      x.border = { top: r === r1 ? med : undefined, bottom: r === r2 ? med : undefined, left: c === c1 ? med : undefined, right: c === c2 ? med : undefined };
      if (opts.fill) x.fill = fill(opts.fill);
    }
  return cell;
}

/** Judul section di kolom A: diputar 90° bila barisnya cukup, kalau pendek ditulis mendatar kecil. */
function sectionTitle(ws: ExcelJS.Worksheet, r1: number, r2: number, title: string, fillArgb?: string) {
  const n = r2 - r1 + 1;
  const rotate = n * 16 >= title.length * 7;
  frame(ws, r1, 1, r2, 1, { rotate, size: rotate ? (n >= 12 ? 14 : 10) : 7, bold: true, fill: fillArgb }).value = title;
}

function setupSheet(ws: ExcelJS.Worksheet, lastCol: number, freezeRow: number, freezeCol: number) {
  ws.views = [{ state: "frozen", xSplit: freezeCol, ySplit: freezeRow, zoomScale: 80 }];
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  ws.pageSetup.printTitlesRow = `1:${freezeRow}`;
  ws.headerFooter.oddFooter = "&R&P / &N";
  for (let c = 1; c <= lastCol; c++) ws.getColumn(c).font = { name: FONT, size: 10 };
}

/** Sheet 1: QC Result. Kolom: A section, B part, C D1/D2, D lot, E before, F after, G..AJ 10 NG (3 kolom), AK total, AL persen. */
function qcSheet(wb: ExcelJS.Workbook, d: NgMonthly) {
  const ws = wb.addWorksheet("QC Result", { properties: { defaultRowHeight: 16 } });
  const NG0 = 7; // G
  const AK = NG0 + 30; // 37
  const AL = AK + 1;
  setupSheet(ws, AL, 7, 4);
  ws.getColumn(1).width = 9;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 5;
  ws.getColumn(4).width = 13;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;
  for (let c = NG0; c < AK; c++) ws.getColumn(c).width = 3.6;
  ws.getColumn(AK).width = 10;
  ws.getColumn(AL).width = 11;

  ws.mergeCells(1, 1, 1, 5);
  ws.getCell(1, 1).value = "PT. TAKAI SEIKI INDONESIA";
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  ws.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 6, 1, 30);
  ws.getCell(1, 6).value = `QC RESULT REPORT MONTHLY ${d.month.slice(0, 4)}`;
  ws.getCell(1, 6).font = { name: FONT, size: 20, bold: true };
  ws.getCell(1, 6).alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 31, 1, AL);
  ws.getCell(1, 31).value = `Periode ${ddmmyyyy(d.from)} ~ ${ddmmyyyy(d.to)}`;
  ws.getCell(1, 31).font = { name: FONT, size: 12 };
  ws.getCell(1, 31).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  frame(ws, 2, 1, 7, 1, { fill: HEAD });
  frame(ws, 2, 2, 7, 3, { fill: HEAD, bold: true }).value = "Part Type";
  frame(ws, 2, 4, 7, 4, { fill: HEAD, bold: true }).value = "Lot No.";
  frame(ws, 2, 5, 7, 5, { fill: HEAD, bold: true }).value = "Total Before Senbetsu";
  frame(ws, 2, 6, 7, 6, { fill: HEAD, bold: true }).value = "Total After Senbetsu";
  frame(ws, 2, NG0, 3, AL, { fill: HEAD, size: 14, bold: true }).value = "NG SPECIFICATION";
  IRON_NG.forEach((name, i) => {
    const c = NG0 + i * 3;
    frame(ws, 4, c, 5, c + 2, { fill: HEAD, size: 9, bold: true }).value = name;
    frame(ws, 6, c, 7, c + 2, { fill: HEAD, size: 9 }).value = IRON_NG_JA[i];
  });
  frame(ws, 4, AK, 7, AK, { fill: HEAD, bold: true }).value = "Total";
  frame(ws, 4, AL, 7, AL, { fill: HEAD, bold: true }).value = "Percentage";
  for (let r = 2; r <= 7; r++) ws.getRow(r).height = 18;

  let r = 8;
  const grand: { before: string[]; ng: string[] } = { before: [], ng: [] };
  for (const s of d.qc) {
    if (s.plastic) {
      // Judul kolom NG plastik (kode 11-20), seperti template.
      frame(ws, r, 1, r + 1, 1, { fill: HEAD });
      frame(ws, r, 2, r + 1, 3, { fill: HEAD, bold: true }).value = "Plastic Part Type";
      frame(ws, r, 4, r + 1, 4, { fill: HEAD, bold: true }).value = "Lot. No";
      frame(ws, r, 5, r + 1, 5, { fill: HEAD, bold: true }).value = "Total Before Senbetsu";
      frame(ws, r, 6, r + 1, 6, { fill: HEAD, bold: true }).value = "Total After Senbetsu";
      PLASTIC_NG.forEach((name, i) => (frame(ws, r, NG0 + i * 3, r + 1, NG0 + i * 3 + 2, { fill: HEAD, size: 9, bold: true }).value = name));
      frame(ws, r, AK, r + 1, AK, { fill: HEAD, bold: true }).value = "Total";
      frame(ws, r, AL, r + 1, AL, { fill: HEAD, bold: true }).value = "Percentage";
      ws.getRow(r).height = 18;
      ws.getRow(r + 1).height = 18;
      r += 2;
    }
    const start = r;
    for (const p of s.parts) {
      const pStart = r;
      for (const t of p.types) {
        const tStart = r;
        for (const l of t.lots) {
          frame(ws, r, 4, r, 4, {}).value = l.lot || "-";
          ws.getCell(r, 4).numFmt = "@";
          const e = frame(ws, r, 5, r, 5, { fmt: ACC, align: "right" });
          e.value = l.before || null;
          frame(ws, r, 6, r, 6, { fmt: ACC, align: "right" }).value = { formula: `IF(E${r},E${r}-${col(AK)}${r},"")` };
          l.ng.forEach((n, i) => (frame(ws, r, NG0 + i * 3, r, NG0 + i * 3 + 2, { fmt: ACC }).value = n || null));
          frame(ws, r, AK, r, AK, { fmt: ACC, align: "right" }).value = { formula: `SUM(${col(NG0)}${r}:${col(AK - 1)}${r})` };
          frame(ws, r, AL, r, AL, { fmt: "0.00%", align: "right" }).value = { formula: `IF(E${r},${col(AK)}${r}/E${r},"")` };
          r++;
        }
        // Plastik tidak punya D1/D2: kolom part B:C digabung.
        if (!s.plastic) frame(ws, tStart, 3, r - 1, 3, {}).value = t.type || "-";
      }
      if (s.plastic) frame(ws, pStart, 2, r - 1, 3, {}).value = p.part;
      else frame(ws, pStart, 2, r - 1, 2, {}).value = p.part;
    }
    if (r === start) {
      // Section tanpa data: satu baris kosong supaya bentuk tetap sama.
      frame(ws, r, 2, r, s.plastic ? 3 : 2, {}).value = "(tidak ada data)";
      if (!s.plastic) frame(ws, r, 3, r, 3, {});
      for (let c = 4; c <= AL; c++) if (c < NG0 || c >= AK || (c - NG0) % 3 === 0) frame(ws, r, c, r, c < NG0 || c >= AK ? c : c + 2, {});
      r++;
    }
    for (let x = start; x < r; x++) ws.getRow(x).height = 16;
    sectionTitle(ws, start, r - 1, s.title, s.plastic ? undefined : SEC);
    // Baris TOTAL section.
    const end = r - 1;
    frame(ws, r, 1, r, 4, { fill: TOT, bold: true }).value = "TOTAL";
    frame(ws, r, 5, r, 5, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(E${start}:E${end})` };
    frame(ws, r, 6, r, 6, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(F${start}:F${end})` };
    for (let i = 0; i < 10; i++) {
      const c = NG0 + i * 3;
      frame(ws, r, c, r, c + 2, { fill: TOT, bold: true, fmt: ACC }).value = { formula: `SUM(${col(c)}${start}:${col(c + 2)}${end})` };
    }
    frame(ws, r, AK, r, AK, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(${col(AK)}${start}:${col(AK)}${end})` };
    frame(ws, r, AL, r, AL, { fill: TOT, bold: true, fmt: "0.00%", align: "right" }).value = { formula: `IF(E${r},${col(AK)}${r}/E${r},"")` };
    ws.getRow(r).height = 20;
    grand.before.push(`E${r}`);
    grand.ng.push(`${col(AK)}${r}`);
    r += 2;
  }
  // Total keseluruhan.
  frame(ws, r, 1, r, 4, { fill: SEC, bold: true }).value = "GRAND TOTAL";
  frame(ws, r, 5, r, 5, { fill: SEC, bold: true, fmt: ACC, align: "right" }).value = { formula: grand.before.join("+") || "0" };
  frame(ws, r, 6, r, 6, { fill: SEC, bold: true, fmt: ACC, align: "right" }).value = { formula: `E${r}-${col(AK)}${r}` };
  frame(ws, r, NG0, r, AK - 1, { fill: SEC });
  frame(ws, r, AK, r, AK, { fill: SEC, bold: true, fmt: ACC, align: "right" }).value = { formula: grand.ng.join("+") || "0" };
  frame(ws, r, AL, r, AL, { fill: SEC, bold: true, fmt: "0.00%", align: "right" }).value = { formula: `IF(E${r},${col(AK)}${r}/E${r},"")` };
  ws.getRow(r).height = 20;
  r += 2;
  ws.getCell(r, 1).value =
    "Catatan: Total Before Senbetsu = hasil laporan kategori Senbetsu; NG dari semua proses (Seiretsu, PF, Senbetsu) untuk part, D1/D2 dan lot yang sama; Total After = Before − Total NG. Press JAPAN = lot 01…, Press INDONESIA = lot 31… / 33….";
  ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } };
}

/** Sheet 2: Produk Jatuh. Kolom: A section, B part, C D1/D2, D total, E produksi, F..AC 8 proses (3 kolom), AD total, AE persen. */
function jatuhSheet(wb: ExcelJS.Workbook, d: NgMonthly) {
  const ws = wb.addWorksheet("Produk Jatuh", { properties: { defaultRowHeight: 16 } });
  const P0 = 6; // F
  const AD = P0 + JATUH_PROC.length * 3; // 30
  const AE = AD + 1;
  setupSheet(ws, AE, 5, 3);
  ws.getColumn(1).width = 9;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 5;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  for (let c = P0; c < AD; c++) ws.getColumn(c).width = 4.2;
  ws.getColumn(AD).width = 10;
  ws.getColumn(AE).width = 11;

  ws.mergeCells(1, 1, 1, 4);
  ws.getCell(1, 1).value = "PT. TAKAI SEIKI INDONESIA";
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  ws.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 5, 1, AE);
  ws.getCell(1, 5).value = `PRODUK JATUH   ·   Periode ${ddmmyyyy(d.from)} ~ ${ddmmyyyy(d.to)}`;
  ws.getCell(1, 5).font = { name: FONT, size: 20, bold: true };
  ws.getCell(1, 5).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  frame(ws, 2, 1, 5, 1, { fill: HEAD });
  frame(ws, 2, 2, 5, 3, { fill: HEAD, bold: true }).value = "Part Type";
  frame(ws, 2, 4, 5, 4, { fill: HEAD, bold: true }).value = "Total";
  frame(ws, 2, 5, 5, 5, { fill: HEAD, bold: true }).value = "Produksi dalam 1 bulan";
  frame(ws, 2, P0, 3, AE, { fill: HEAD, size: 14, bold: true }).value = "NG SPECIFICATION";
  const procHead = (row: number) => {
    JATUH_PROC.forEach((name, i) => (frame(ws, row, P0 + i * 3, row + 1, P0 + i * 3 + 2, { fill: HEAD, size: 9, bold: true }).value = name));
    frame(ws, row, AD, row + 1, AD, { fill: HEAD, bold: true }).value = "Total";
    frame(ws, row, AE, row + 1, AE, { fill: HEAD, bold: true }).value = "Percentage";
  };
  procHead(4);
  for (let r = 2; r <= 5; r++) ws.getRow(r).height = 18;

  let r = 6;
  for (const s of d.jatuh) {
    if (s.plastic) {
      frame(ws, r, 1, r + 1, 1, { fill: HEAD });
      frame(ws, r, 2, r + 1, 3, { fill: HEAD, bold: true }).value = "Plastic Part Type";
      frame(ws, r, 4, r + 1, 4, { fill: HEAD, bold: true }).value = "Total";
      frame(ws, r, 5, r + 1, 5, { fill: HEAD, bold: true }).value = "Produksi dalam 1 bulan";
      procHead(r);
      r += 2;
    }
    const start = r;
    // Baris part yang sama (D1, D2) berurutan: kolom part digabung.
    for (let i = 0; i < s.rows.length; ) {
      let j = i;
      while (j < s.rows.length && s.rows[j].part === s.rows[i].part) j++;
      const pStart = r;
      for (let k = i; k < j; k++) {
        const row = s.rows[k];
        if (!s.plastic) frame(ws, r, 3, r, 3, {}).value = row.type || "-";
        frame(ws, r, 4, r, 4, { fmt: ACC, align: "right" }).value = { formula: `E${r}+${col(AD)}${r}` };
        frame(ws, r, 5, r, 5, { fmt: ACC, align: "right" }).value = row.before || null;
        row.proc.forEach((n, p) => (frame(ws, r, P0 + p * 3, r, P0 + p * 3 + 2, { fmt: ACC }).value = n || null));
        frame(ws, r, AD, r, AD, { fmt: ACC, align: "right" }).value = { formula: `SUM(${col(P0)}${r}:${col(AD - 1)}${r})` };
        frame(ws, r, AE, r, AE, { fmt: "0.00%", align: "right" }).value = { formula: `IF(D${r},${col(AD)}${r}/D${r},"")` };
        r++;
      }
      frame(ws, pStart, 2, r - 1, s.plastic ? 3 : 2, {}).value = s.rows[i].part;
      i = j;
    }
    if (r === start) {
      frame(ws, r, 2, r, 3, {}).value = "(tidak ada data)";
      for (let c = 4; c <= AE; c++) if (c < P0 || c >= AD || (c - P0) % 3 === 0) frame(ws, r, c, r, c < P0 || c >= AD ? c : c + 2, {});
      r++;
    }
    for (let x = start; x < r; x++) ws.getRow(x).height = 16;
    sectionTitle(ws, start, r - 1, s.title, s.plastic ? undefined : SEC);
    const end = r - 1;
    frame(ws, r, 1, r, 3, { fill: TOT, bold: true }).value = "TOTAL";
    frame(ws, r, 4, r, 4, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(D${start}:D${end})` };
    frame(ws, r, 5, r, 5, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(E${start}:E${end})` };
    for (let p = 0; p < JATUH_PROC.length; p++) {
      const c = P0 + p * 3;
      frame(ws, r, c, r, c + 2, { fill: TOT, bold: true, fmt: ACC }).value = { formula: `SUM(${col(c)}${start}:${col(c + 2)}${end})` };
    }
    frame(ws, r, AD, r, AD, { fill: TOT, bold: true, fmt: ACC, align: "right" }).value = { formula: `SUM(${col(AD)}${start}:${col(AD)}${end})` };
    frame(ws, r, AE, r, AE, { fill: TOT, bold: true, fmt: "0.00%", align: "right" }).value = { formula: `IF(D${r},${col(AD)}${r}/D${r},"")` };
    ws.getRow(r).height = 20;
    r += 2;
  }
  ws.getCell(r, 1).value =
    "Catatan: Part jatuh = NG kode 9 dari laporan tiap proses (juga ada di sheet QC Result). Produksi dalam 1 bulan = hasil laporan Senbetsu. Press, Molding, Barrel dan Washing belum ada laporannya di web. NG plastik tidak punya kode Part jatuh.";
  ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } };
}

export async function ngMonthlyToXlsx(d: NgMonthly): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  wb.created = new Date();
  qcSheet(wb, d);
  jatuhSheet(wb, d);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
