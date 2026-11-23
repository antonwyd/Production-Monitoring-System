import ExcelJS from "exceljs";
import { IRON_NG_JA, JATUH_PROC, PLASTIC_NG, partKey } from "./ngMonthly";
import { ACC, FONT, HEAD, SEC, TOT, col, ddmmyyyy, frame, jatuhSheet, qcSheet, setupSheet } from "./ngMonthlyExcel";
import type { NgReport, NgSumSection } from "./ngReport";
import { addCharts, type ChartSpec } from "./xlsxCharts";

// Workbook Laporan NG lengkap (satu kali download), urutan sheet mengikuti file QC September 2026
// tanpa sheet mingguan: QC Result, Produk Jatuh, Page 1 Monthly Report QC, NG% 1 Bulan, NG Rate <FY>,
// Graphic Perbandingan Iron, Perbandingan produk jatuh, Graphic Compare Plastic.

export const IRON_NG_EN = ["1.Mixed product", "2.Press not perfect", "3.Pitchzure", "4.Dokking", "5.Kizu / Scratch", "6.Henkei", "7.Rust", "8.Rough material", "9.Fall product", "10.Etc"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (m: string) => MONTH_LONG[Number(m.slice(5, 7)) - 1];
const monShort = (m: string) => MON[Number(m.slice(5, 7)) - 1];
const PCT = "0.00%";
const PREV_C = "A6A6A6";
const CUR_C = "C00000";

type RowMap = Map<string, number>;
const keyOf = (sec: string, part: string, type: string) => `${sec}|${partKey(part)}|${type}`;
const q = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;
const abs = (sheet: string, c1: number, r1: number, c2: number, r2: number) => `${q(sheet)}!$${col(c1)}$${r1}:$${col(c2)}$${r2}`;

function title(ws: ExcelJS.Worksheet, r: number, c1: number, c2: number, text: string, size = 14, bold = true, align: "center" | "left" = "center") {
  ws.mergeCells(r, c1, r, c2);
  const x = ws.getCell(r, c1);
  x.value = text;
  x.font = { name: FONT, size, bold };
  x.alignment = { horizontal: align, vertical: "middle", wrapText: true };
  return x;
}

/** Sheet "NG% 1 Bulan": per part + D1/D2 (semua lot dijumlah). */
function pctSheet(wb: ExcelJS.Workbook, d: NgReport) {
  const NAME = "NG% 1 Bulan";
  const ws = wb.addWorksheet(NAME, { properties: { defaultRowHeight: 16 } });
  const NG0 = 7;
  const AK = NG0 + 30;
  const AL = AK + 1;
  const AM = AK + 2;
  const AN = AK + 3;
  setupSheet(ws, AN, 7, 4);
  [9, 13, 5, 8, 14, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = NG0; c < AK; c++) ws.getColumn(c).width = 3.4;
  ws.getColumn(AK).width = 9;
  ws.getColumn(AL).width = 9;
  ws.getColumn(AM).width = 11;
  ws.getColumn(AN).width = 9;
  title(ws, 1, 1, 5, "PT. TAKAI SEIKI INDONESIA");
  title(ws, 1, 6, 33, `QC RESULT REPORT MONTHLY ${d.month.slice(0, 4)}  —  NG % 1 BULAN`, 18);
  title(ws, 1, 34, AN, `Periode ${ddmmyyyy(d.from)} ~ ${ddmmyyyy(d.to)}`, 11, false);
  ws.getRow(1).height = 34;
  frame(ws, 2, 1, 7, 1, { fill: HEAD, bold: true }).value = "ITEM";
  frame(ws, 2, 2, 7, 3, { fill: HEAD, bold: true }).value = "Part Type";
  frame(ws, 2, 4, 7, 4, { fill: HEAD, bold: true }).value = "Lot No.";
  frame(ws, 2, 5, 7, 5, { fill: HEAD, bold: true }).value = "Total Before Senbetsu";
  frame(ws, 2, 6, 7, 6, { fill: HEAD, bold: true }).value = "Total After Senbetsu";
  frame(ws, 2, NG0, 3, AN, { fill: HEAD, size: 14, bold: true }).value = "NG Spesification";
  IRON_NG_EN.forEach((n, i) => {
    frame(ws, 4, NG0 + i * 3, 5, NG0 + i * 3 + 2, { fill: HEAD, size: 9, bold: true }).value = n;
    frame(ws, 6, NG0 + i * 3, 7, NG0 + i * 3 + 2, { fill: HEAD, size: 9 }).value = IRON_NG_JA[i];
  });
  frame(ws, 4, AK, 7, AK, { fill: HEAD, bold: true, size: 9 }).value = "Total\nNG/\nType";
  frame(ws, 4, AL, 7, AL, { fill: HEAD, bold: true, size: 9 }).value = "Harga/pcs";
  frame(ws, 4, AM, 7, AM, { fill: HEAD, bold: true, size: 9 }).value = "Kerugian (USD)";
  frame(ws, 4, AN, 7, AN, { fill: HEAD, bold: true, size: 9 }).value = "%\nNG/Type";

  const rows: RowMap = new Map();
  const totals = new Map<string, number>();
  let r = 8;
  const LABEL: Record<string, string> = { JPN: "Iron Cage Japan", PT: "Iron Cage Indonesia", LAIN: "Iron Cage (lot lain)", PLASTIC: "Plastic" };
  for (const s of d.summary) {
    if (s.plastic) {
      frame(ws, r, 1, r + 1, 1, { fill: HEAD, bold: true }).value = "Plastic";
      frame(ws, r, 2, r + 1, 4, { fill: HEAD, bold: true }).value = "Part Type";
      frame(ws, r, 5, r + 1, 5, { fill: HEAD, bold: true }).value = "Total Before Senbetsu";
      frame(ws, r, 6, r + 1, 6, { fill: HEAD, bold: true }).value = "Total After Senbetsu";
      PLASTIC_NG.forEach((n, i) => (frame(ws, r, NG0 + i * 3, r + 1, NG0 + i * 3 + 2, { fill: HEAD, size: 9, bold: true }).value = n.replace(" (short)", "")));
      frame(ws, r, AK, r + 1, AK, { fill: HEAD, bold: true, size: 9 }).value = "Total";
      frame(ws, r, AL, r + 1, AL, { fill: HEAD, bold: true, size: 9 }).value = "Harga/pcs";
      frame(ws, r, AM, r + 1, AM, { fill: HEAD, bold: true, size: 9 }).value = "Kerugian (USD)";
      frame(ws, r, AN, r + 1, AN, { fill: HEAD, bold: true, size: 9 }).value = "%\nNG/Type";
      r += 2;
    }
    const start = r;
    for (let i = 0; i < s.rows.length; ) {
      let j = i;
      while (j < s.rows.length && s.rows[j].part === s.rows[i].part) j++;
      const pStart = r;
      for (let k = i; k < j; k++) {
        const x = s.rows[k];
        const lt = { light: true };
        rows.set(keyOf(s.key, x.part, x.type), r);
        if (!s.plastic) {
          frame(ws, r, 3, r, 3, lt).value = x.type || "-";
          frame(ws, r, 4, r, 4, lt).value = "TOTAL";
        }
        frame(ws, r, 5, r, 5, { ...lt, fmt: ACC, align: "right" }).value = { formula: `F${r}+${col(AK)}${r}` };
        frame(ws, r, 6, r, 6, { ...lt, fmt: ACC, align: "right" }).value = x.after || null;
        x.ng.forEach((n, c) => (frame(ws, r, NG0 + c * 3, r, NG0 + c * 3 + 2, { ...lt, fmt: ACC }).value = n || null));
        frame(ws, r, AK, r, AK, { ...lt, fmt: ACC, align: "right" }).value = { formula: `SUM(${col(NG0)}${r}:${col(AK - 1)}${r})` };
        frame(ws, r, AL, r, AL, { ...lt, fmt: "0.0000", align: "right" }).value = x.harga;
        frame(ws, r, AM, r, AM, { ...lt, fmt: "#,##0.00", align: "right" }).value = { formula: `${col(AK)}${r}*${col(AL)}${r}` };
        frame(ws, r, AN, r, AN, { ...lt, fmt: PCT, align: "right" }).value = { formula: `IF(F${r},${col(AK)}${r}/F${r},0)` };
        r++;
      }
      frame(ws, pStart, 2, r - 1, s.plastic ? 4 : 2, { light: true, align: s.plastic ? "left" : "center" }).value = s.rows[i].part;
      i = j;
    }
    if (r === start) r++;
    frame(ws, start, 1, r - 1, 1, { bold: true, rotate: r - start >= 6, size: r - start >= 6 ? 11 : 8, fill: s.plastic ? undefined : SEC }).value = LABEL[s.key];
    const end = r - 1;
    frame(ws, r, 1, r, 4, { fill: TOT, bold: true }).value = "Total";
    for (const c of [5, 6, AK, AM]) frame(ws, r, c, r, c, { fill: TOT, bold: true, fmt: c === AM ? "#,##0.00" : ACC, align: "right" }).value = { formula: `SUM(${col(c)}${start}:${col(c)}${end})` };
    for (let i = 0; i < 10; i++) frame(ws, r, NG0 + i * 3, r, NG0 + i * 3 + 2, { fill: TOT, bold: true, fmt: ACC }).value = { formula: `SUM(${col(NG0 + i * 3)}${start}:${col(NG0 + i * 3 + 2)}${end})` };
    frame(ws, r, AL, r, AL, { fill: TOT });
    frame(ws, r, AN, r, AN, { fill: TOT, bold: true, fmt: PCT, align: "right" }).value = { formula: `IF(F${r},${col(AK)}${r}/F${r},0)` };
    totals.set(s.key, r);
    r += 3;
  }
  ws.getCell(r, 1).value = "Catatan: Total After = hasil Senbetsu, Before = After + Total NG, % NG/Type = Total NG / After (sama dengan NG Rate). Harga/pcs dari file QC September 2026, bisa diubah di sel.";
  ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } };
  return { name: NAME, rows, totals, AK, BEFORE: 5, HENKEI: NG0 + 5 * 3 };
}

/** Sheet "NG Rate <FY>": NG / Senbetsu per bulan April–Maret + grafik vs target. */
function rateSheet(wb: ExcelJS.Workbook, d: NgReport, charts: ChartSpec[]) {
  const NAME = `NG Rate ${d.fy.label}`;
  const ws = wb.addWorksheet(NAME, { properties: { defaultRowHeight: 16 } });
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.getColumn(1).width = 17;
  for (let c = 2; c <= 13; c++) ws.getColumn(c).width = 11;
  ws.getColumn(14).width = 14;
  title(ws, 1, 1, 6, "PT. TAKAI SEIKI INDONESIA", 12, true, "left");
  title(ws, 1, 13, 14, "FR/QC/21/00", 10, false);
  const blocks: [string, "jpn" | "idn" | "pla", number, number][] = [
    ["Cage Retainer (spcc & sus) Japan", "jpn", 2, 0.0121],
    ["Cage Retainer (spcc & sus) Indonesia", "idn", 8, 0.0014],
    ["Retainer Plastic", "pla", 14, 0.005],
  ];
  const rateRow: Record<string, number> = {};
  const headRow: Record<string, number> = {};
  for (const [label, k, r0] of blocks) {
    frame(ws, r0, 1, r0 + 1, r0 === 2 ? 6 : 14, { bold: true, size: 12, align: "left", fill: SEC }).value = label;
    if (r0 === 2) frame(ws, 2, 8, 3, 9, { bold: true }).value = "QC Section";
    const h = r0 + 2;
    headRow[k] = h;
    frame(ws, h, 1, h, 1, { bold: true, fill: HEAD }).value = "Month";
    d.fy.months.forEach((m, i) => (frame(ws, h, 2 + i, h, 2 + i, { bold: true, fill: HEAD }).value = m.label));
    frame(ws, h, 14, h, 14, { bold: true, fill: HEAD }).value = "TOTAL";
    frame(ws, h + 1, 1, h + 1, 1, { align: "left" }).value = "Total NG";
    frame(ws, h + 2, 1, h + 2, 1, { align: "left" }).value = "Total Senbetsu";
    frame(ws, h + 3, 1, h + 3, 1, { align: "left", bold: true }).value = "NG RATE";
    d.fy.months.forEach((m, i) => {
      const c = 2 + i;
      const v = m[k];
      frame(ws, h + 1, c, h + 1, c, { fmt: ACC, light: true }).value = v ? v.ng : null;
      frame(ws, h + 2, c, h + 2, c, { fmt: ACC, light: true }).value = v ? v.sen : null;
      frame(ws, h + 3, c, h + 3, c, { fmt: PCT, bold: true }).value = v && v.sen ? { formula: `${col(c)}${h + 1}/${col(c)}${h + 2}` } : null;
    });
    frame(ws, h + 1, 14, h + 1, 14, { fmt: ACC }).value = { formula: `SUM(B${h + 1}:M${h + 1})` };
    frame(ws, h + 2, 14, h + 2, 14, { fmt: ACC }).value = { formula: `SUM(B${h + 2}:M${h + 2})` };
    frame(ws, h + 3, 14, h + 3, 14, { fmt: PCT, bold: true, fill: TOT }).value = { formula: `IF(N${h + 2},N${h + 1}/N${h + 2},0)` };
    rateRow[k] = h + 3;
  }
  frame(ws, 20, 2, 21, 12, { bold: true, size: 14 }).value = `GRAPHIC NG ${d.fy.label}`;
  // Garis target (dipakai grafik), seperti baris 48-50 template.
  const tRow: Record<string, number> = { jpn: 48, idn: 49, pla: 50 };
  ws.getCell(47, 1).value = "Target (garis grafik)";
  ws.getCell(47, 1).font = { name: FONT, size: 9, italic: true };
  for (const [label, k, , target] of blocks) {
    ws.getCell(tRow[k], 1).value = `Target ${label.replace("Cage Retainer (spcc & sus) ", "")}`;
    ws.getCell(tRow[k], 1).font = { name: FONT, size: 9 };
    for (let c = 2; c <= 13; c++) {
      ws.getCell(tRow[k], c).value = target;
      ws.getCell(tRow[k], c).numFmt = PCT;
    }
  }
  const chart = (k: "jpn" | "idn" | "pla", t: string, c1: number, c2: number, sheet = NAME, from = 21, to = 40): ChartSpec => ({
    sheet,
    type: "line",
    title: t,
    cats: abs(NAME, 2, headRow[k], 13, headRow[k]),
    series: [
      { name: "NG Rate", ref: abs(NAME, 2, rateRow[k], 13, rateRow[k]), color: "00B050", labels: true },
      { name: "Target", ref: abs(NAME, 2, tRow[k], 13, tRow[k]), color: "FF0000", dash: true },
    ],
    from: { col: c1, row: from },
    to: { col: c2, row: to },
    numFmt: PCT,
    yMin: 0,
  });
  const T = { jpn: "NG Rate Cage Bearing TKI Japan", idn: "NG Rate Cage Bearing TKI Indonesia", pla: "NG Rate Plastic" };
  charts.push(chart("jpn", T.jpn, 0, 4), chart("idn", T.idn, 4, 9), chart("pla", T.pla, 9, 14));
  return { name: NAME, rateRow, chart, T };
}

/** Sheet "Page 1 Monthly Report QC". Isian komplain pelanggan/internal diisi manual (belum ada di aplikasi). */
function page1Sheet(ws: ExcelJS.Worksheet, d: NgReport, rate: ReturnType<typeof rateSheet>, charts: ChartSpec[]) {
  const NAME = "Page 1 Monthly Report QC";
  ws.properties.defaultRowHeight = 15;
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: "A1:Y55", margins: { left: 0.4, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  const W: Record<number, number> = { 1: 4.9, 7: 3.3, 8: 4.2, 9: 5.8, 10: 2.8, 14: 4.2, 15: 2.9, 16: 3, 17: 4.2, 19: 3, 20: 4.2 };
  for (let c = 1; c <= 25; c++) ws.getColumn(c).width = W[c] ?? 6.5;
  const y = d.fy.label;
  const per = `${y}.04~${d.month.replace("-", ".")}`;
  const perLong = `Apr ${y}~${monShort(d.month)} ${d.month.slice(0, 4)}`;
  frame(ws, 1, 1, 2, 6, { bold: true, size: 11 }).value = "PT. TAKAI SEIKI INDONESIA";
  frame(ws, 1, 7, 4, 19, { bold: true, size: 14 }).value = `MONTHLY REPORT QC\nKebijakan Tahun ${y}\n（会社方針）`;
  const info: [string, string][] = [["Form No", ": FR/QC/13"], ["Date", ": 29/06/2012"], ["Revision", ": 1"], ["Date of Rev.", ": 15/08/2012"]];
  info.forEach(([a, b], i) => {
    frame(ws, 1 + i, 20, 1 + i, 22, { align: "left", size: 9, light: true }).value = a;
    frame(ws, 1 + i, 23, 1 + i, 25, { align: "left", size: 9, light: true }).value = b;
  });
  frame(ws, 3, 1, 3, 6, { bold: true, align: "left", size: 10 }).value = `PERIOD : ${monthName(d.month).toUpperCase()} ${d.month.slice(0, 4)}`;
  frame(ws, 4, 1, 4, 6, {});
  [1, 2, 3, 4].forEach((r) => (ws.getRow(r).height = 20));
  frame(ws, 5, 1, 5, 25, { bold: true, align: "left", fill: HEAD }).value = "1.   Customer Quality Issue & Internal Quality Issue";
  frame(ws, 6, 1, 9, 6, { bold: true, size: 9 }).value = "(Customer Quality Issue)";
  frame(ws, 6, 7, 9, 12, { size: 8 }).value = "Important Quality Issue (Different goods, different materials and unprocessed)";
  frame(ws, 6, 13, 7, 19, { bold: true, size: 9, fill: HEAD }).value = `Target ${y}目標`;
  frame(ws, 6, 20, 7, 25, { bold: true, size: 9, fill: HEAD }).value = `Actual (${per})`;
  frame(ws, 8, 13, 9, 19, { bold: true }).value = 0;
  // Actual = jumlah dari tabel bulanan di bawah (baris 75-86), diisi manual.
  frame(ws, 8, 20, 9, 25, { bold: true }).value = { formula: "SUM(F75:F86)" };
  frame(ws, 10, 1, 11, 6, { size: 9 }).value = "客先品質問題";
  frame(ws, 10, 7, 11, 12, { size: 8 }).value = "Mismatches are found in the customer";
  frame(ws, 10, 13, 11, 19, { bold: true }).value = "Max 2";
  frame(ws, 10, 20, 11, 25, { bold: true }).value = { formula: "SUM(J75:J86)" };
  frame(ws, 12, 1, 14, 6, { bold: true, size: 9 }).value = "(Internal Quality Issue)";
  frame(ws, 15, 1, 16, 6, { size: 9 }).value = "社内品質問題";
  frame(ws, 12, 7, 16, 12, { size: 8 }).value = "Mismatches are found in the field";
  frame(ws, 12, 13, 16, 19, { bold: true }).value = "Max 2";
  frame(ws, 12, 20, 16, 25, { bold: true }).value = { formula: "SUM(O75:O86)" };
  frame(ws, 17, 1, 17, 6, { size: 8, align: "left" }).value = "Description of Problem ; \n(Customer Quality Issue)";
  frame(ws, 17, 7, 17, 25, { size: 8, align: "left" });
  frame(ws, 18, 1, 19, 6, { size: 9, align: "left" }).value = "Cause ;";
  frame(ws, 18, 7, 19, 25, { size: 8, align: "left" });
  frame(ws, 20, 1, 24, 6, { size: 9, align: "left" }).value = "Handling ;";
  frame(ws, 20, 7, 24, 25, { size: 8, align: "left" });
  ws.getRow(17).height = 30;
  frame(ws, 25, 1, 25, 25, { bold: true, align: "left", fill: HEAD }).value = "2.   Target Limit NG vs Result NG";
  frame(ws, 26, 1, 27, 6, { bold: true, size: 9, fill: HEAD }).value = "Type　品種";
  frame(ws, 26, 7, 27, 16, { bold: true, size: 9, fill: HEAD }).value = `Target Max ${y}  目標数値`;
  frame(ws, 26, 17, 27, 25, { bold: true, size: 9, fill: HEAD }).value = `Actual (${perLong}) 実績`;
  const tgt: [string, string, string | null][] = [
    ["Cage Retainer 爪付 (TKI Japan)", "Max 1.21% 以下", `${q(rate.name)}!N${rate.rateRow.jpn}`],
    ["Cage Retainer 爪付 (TKI Indonesia)", "Max 0.14% 以下", `${q(rate.name)}!N${rate.rateRow.idn}`],
    ["Retainer Plastic プラ (TKI Indonesia)", "Max 0.50% 以下", `${q(rate.name)}!N${rate.rateRow.pla}`],
    ["Shield シールド (TKI Japan)", "Max 1.93% 以下", null],
  ];
  tgt.forEach(([a, b, f], i) => {
    const r = 28 + i;
    frame(ws, r, 1, r, 6, { size: 9, align: "left" }).value = a;
    frame(ws, r, 7, r, 16, { size: 10 }).value = b;
    frame(ws, r, 17, r, 25, { bold: true, fmt: PCT }).value = f ? { formula: f } : "-";
    ws.getRow(r).height = 19.5;
  });
  // Tabel bulanan komplain (isi manual) untuk grafik, seperti E74:Q86 template.
  ws.getCell(73, 5).value = "Isi jumlah komplain per bulan (kolom Actual) — dipakai grafik & kotak Actual di atas.";
  ws.getCell(73, 5).font = { name: FONT, size: 8, italic: true, color: { argb: "FF64748B" } };
  const grp: [number, string, number][] = [
    [5, "Important cust. issue", 0],
    [9, "Mismatch customer", 2],
    [14, "Internal", 2],
  ];
  for (const [c, lbl] of grp) {
    frame(ws, 74, c, 74, c + 2, { bold: true, size: 8, fill: HEAD }).value = lbl;
  }
  d.fy.months.forEach((m, i) => {
    const r = 75 + i;
    for (const [c, , target] of grp) {
      frame(ws, r, c, r, c, { size: 8, light: true }).value = MON[(i + 3) % 12];
      frame(ws, r, c + 1, r, c + 1, { size: 8, light: true }).value = null;
      frame(ws, r, c + 2, r, c + 2, { size: 8, light: true }).value = target;
    }
    void m;
  });
  const issue = (c: number, t: string, c1: number, c2: number): ChartSpec => ({
    sheet: NAME,
    type: "line",
    title: t,
    cats: abs(NAME, c, 75, c, 86),
    series: [
      { name: "Actual", ref: abs(NAME, c + 1, 75, c + 1, 86), color: "0070C0", labels: true },
      { name: "Target", ref: abs(NAME, c + 2, 75, c + 2, 86), color: "FF0000", dash: true },
    ],
    from: { col: c1, row: 32 },
    to: { col: c2, row: 43 },
    yMin: 0,
  });
  charts.push(
    issue(5, "Important Customer Quality Issue", 0, 6),
    issue(9, "Mismatches Found In Customer", 6, 16),
    issue(14, "Mismatches Found In Internal", 16, 25),
    rate.chart("jpn", rate.T.jpn, 0, 6, NAME, 44, 55),
    rate.chart("idn", rate.T.idn, 6, 16, NAME, 44, 55),
    rate.chart("pla", rate.T.pla, 16, 25, NAME, 44, 55),
  );
}

/** Bagi daftar jadi dua kolom (kiri / kanan) seperti template perbandingan. */
const split = <T,>(a: T[]) => [a.slice(0, Math.ceil(a.length / 2)), a.slice(Math.ceil(a.length / 2))];

function signBox(ws: ExcelJS.Worksheet, r: number, c: number) {
  frame(ws, r, c, r, c + 1, { size: 9, bold: true }).value = "Checked By";
  frame(ws, r, c + 2, r, c + 3, { size: 9, bold: true }).value = "Prepared By";
  frame(ws, r + 1, c, r + 5, c + 1, {});
  frame(ws, r + 1, c + 2, r + 5, c + 3, {});
  frame(ws, r + 6, c, r + 6, c + 1, { size: 9 }).value = "Bayu Hary S.";
  frame(ws, r + 6, c + 2, r + 6, c + 3, { size: 9 }).value = "Anton Wahyudi";
}

type CmpItem = { label: string; key: string; prev: [number, number] };

/** Tabel perbandingan bulan lalu vs bulan ini (dua kolom) + grafik batang persen. */
function compareSheet(
  wb: ExcelJS.Workbook,
  d: NgReport,
  charts: ChartSpec[],
  o: { name: string; chartTitle: string; ngLabel: string; items: CmpItem[]; cur: (key: string) => [string, string] | null; labelCols: number },
) {
  const ws = wb.addWorksheet(o.name, { properties: { defaultRowHeight: 16 } });
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  const L = o.labelCols; // 1 (Iron) atau 2 (Plastic)
  const groupW = L + 6;
  const [left, right] = split(o.items);
  const R0 = 25;
  const prevName = `${monthName(d.prev.month)}`;
  const curName = `${monthName(d.month)}`;
  const tot: { ng: string[]; qty: string[]; cng: string[]; cqty: string[] } = { ng: [], qty: [], cng: [], cqty: [] };
  const catRefs: string[] = [];
  const prevRefs: string[] = [];
  const curRefs: string[] = [];
  [left, right].forEach((list, g) => {
    const c0 = 1 + g * (groupW + 1);
    for (let c = c0; c < c0 + L; c++) ws.getColumn(c).width = L === 1 ? 17 : 9;
    for (let k = 0; k < 6; k++) ws.getColumn(c0 + L + k).width = k % 3 === 1 ? 13 : 10;
    ws.getColumn(c0 + groupW).width = 2;
    frame(ws, 23, c0, 24, c0 + L - 1, { bold: true, fill: HEAD }).value = "Type";
    frame(ws, 23, c0 + L, 23, c0 + L + 2, { bold: true, fill: HEAD }).value = prevName;
    frame(ws, 23, c0 + L + 3, 23, c0 + L + 5, { bold: true, fill: HEAD }).value = curName;
    for (const k of [0, 3]) {
      frame(ws, 24, c0 + L + k, 24, c0 + L + k, { bold: true, size: 8, fill: HEAD }).value = o.ngLabel;
      frame(ws, 24, c0 + L + k + 1, 24, c0 + L + k + 1, { bold: true, size: 8, fill: HEAD }).value = "Total Qty Before Senbetsu";
      frame(ws, 24, c0 + L + k + 2, 24, c0 + L + k + 2, { bold: true, size: 8, fill: HEAD }).value = "(%)";
    }
    ws.getRow(24).height = 30;
    list.forEach((it, i) => {
      const r = R0 + i;
      const c = c0 + L;
      frame(ws, r, c0, r, c0 + L - 1, { light: true, align: "left", size: 9 }).value = it.label;
      frame(ws, r, c, r, c, { light: true, fmt: ACC }).value = it.prev[0];
      frame(ws, r, c + 1, r, c + 1, { light: true, fmt: ACC }).value = it.prev[1];
      frame(ws, r, c + 2, r, c + 2, { light: true, fmt: "0.000%" }).value = { formula: `IF(${col(c + 1)}${r},${col(c)}${r}/${col(c + 1)}${r},0)` };
      const cur = o.cur(it.key);
      frame(ws, r, c + 3, r, c + 3, { light: true, fmt: ACC }).value = cur ? { formula: cur[0] } : 0;
      frame(ws, r, c + 4, r, c + 4, { light: true, fmt: ACC }).value = cur ? { formula: cur[1] } : 0;
      frame(ws, r, c + 5, r, c + 5, { light: true, fmt: "0.000%" }).value = { formula: `IF(${col(c + 4)}${r},${col(c + 3)}${r}/${col(c + 4)}${r},0)` };
    });
    if (list.length) {
      const r1 = R0;
      const r2 = R0 + list.length - 1;
      const c = c0 + L;
      tot.ng.push(`${col(c)}${r1}:${col(c)}${r2}`);
      tot.qty.push(`${col(c + 1)}${r1}:${col(c + 1)}${r2}`);
      tot.cng.push(`${col(c + 3)}${r1}:${col(c + 3)}${r2}`);
      tot.cqty.push(`${col(c + 4)}${r1}:${col(c + 4)}${r2}`);
      catRefs.push(abs(o.name, c0, r1, c0, r2));
      prevRefs.push(abs(o.name, c + 2, r1, c + 2, r2));
      curRefs.push(abs(o.name, c + 5, r1, c + 5, r2));
    }
  });
  // Baris TOTAL di bawah kolom kanan (atau kiri bila hanya satu kolom).
  const g = right.length ? 1 : 0;
  const c0 = 1 + g * (groupW + 1);
  const r = R0 + (g ? right.length : left.length);
  const c = c0 + L;
  frame(ws, r, c0, r, c0 + L - 1, { bold: true, fill: TOT }).value = "TOTAL";
  frame(ws, r, c, r, c, { bold: true, fill: TOT, fmt: ACC }).value = { formula: `SUM(${tot.ng.join(",")})` };
  frame(ws, r, c + 1, r, c + 1, { bold: true, fill: TOT, fmt: ACC }).value = { formula: `SUM(${tot.qty.join(",")})` };
  frame(ws, r, c + 2, r, c + 2, { bold: true, fill: TOT, fmt: "0.000%" }).value = { formula: `IF(${col(c + 1)}${r},${col(c)}${r}/${col(c + 1)}${r},0)` };
  frame(ws, r, c + 3, r, c + 3, { bold: true, fill: TOT, fmt: ACC }).value = { formula: `SUM(${tot.cng.join(",")})` };
  frame(ws, r, c + 4, r, c + 4, { bold: true, fill: TOT, fmt: ACC }).value = { formula: `SUM(${tot.cqty.join(",")})` };
  frame(ws, r, c + 5, r, c + 5, { bold: true, fill: TOT, fmt: "0.000%" }).value = { formula: `IF(${col(c + 4)}${r},${col(c + 3)}${r}/${col(c + 4)}${r},0)` };
  const last = R0 + Math.max(left.length, right.length + 1);
  signBox(ws, last + 3, 2 * groupW - 2);
  if (!d.prev.ada) {
    ws.getCell(last + 1, 1).value = `Catatan: data ${prevName} belum ada di aplikasi (aplikasi mulai November 2026) — kolom ${prevName} bisa diisi manual.`;
    ws.getCell(last + 1, 1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF64748B" } };
  }
  const union = (a: string[]) => (a.length > 1 ? `(${a.join(",")})` : a[0]);
  if (catRefs.length)
    charts.push({
      sheet: o.name,
      type: "bar",
      title: o.chartTitle,
      cats: union(catRefs),
      series: [
        { name: prevName, ref: union(prevRefs), color: PREV_C },
        { name: curName, ref: union(curRefs), color: CUR_C },
      ],
      from: { col: 0, row: 0 },
      to: { col: 2 * groupW + 1, row: 21 },
      numFmt: "0.00%",
      yMin: 0,
    });
}

function compareJatuhSheet(wb: ExcelJS.Workbook, d: NgReport, jpos: ReturnType<typeof jatuhSheet>, charts: ChartSpec[]) {
  const NAME = "Perbandingan produk jatuh";
  const ws = wb.addWorksheet(NAME, { properties: { defaultRowHeight: 16 } });
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  ws.getColumn(1).width = 22;
  for (let c = 2; c <= 7; c++) ws.getColumn(c).width = c % 3 === 0 ? 15 : 12;
  const prevName = monthName(d.prev.month);
  const curName = monthName(d.month);
  frame(ws, 25, 1, 26, 1, { bold: true, fill: HEAD }).value = "Section";
  frame(ws, 25, 2, 25, 4, { bold: true, fill: HEAD }).value = prevName;
  frame(ws, 25, 5, 25, 7, { bold: true, fill: HEAD }).value = curName;
  for (const k of [2, 5]) {
    frame(ws, 26, k, 26, k, { bold: true, size: 8, fill: HEAD }).value = "Fall product (pcs)";
    frame(ws, 26, k + 1, 26, k + 1, { bold: true, size: 8, fill: HEAD }).value = "Total qty production (pcs)";
    frame(ws, 26, k + 2, 26, k + 2, { bold: true, size: 8, fill: HEAD }).value = "%";
  }
  ws.getRow(26).height = 30;
  const KOSONG = new Set([0, 1, 2, 7]);
  const LBL = ["Press", "Molding", "Barrel", "Seiretsu / PF Iron", "Senbetsu Iron", "Seiretsu / PF Plastic", "Senbetsu plastic", "Washing"];
  const JS = q("Produk Jatuh");
  JATUH_PROC.forEach((_, p) => {
    const r = 27 + p;
    frame(ws, r, 1, r, 1, { light: true, align: "left" }).value = LBL[p];
    frame(ws, r, 2, r, 2, { light: true, fmt: ACC }).value = KOSONG.has(p) ? null : d.prev.jatuhNg[p] || 0;
    frame(ws, r, 3, r, 3, { light: true, fmt: ACC }).value = KOSONG.has(p) ? null : d.prev.jatuhProd[p] || 0;
    frame(ws, r, 4, r, 4, { light: true, fmt: "0.0000" }).value = { formula: `IF(C${r},B${r}/C${r}*100,0)` };
    const a = col(jpos.cols[p]);
    frame(ws, r, 5, r, 5, { light: true, fmt: ACC }).value = { formula: `${JS}!${a}${jpos.ngRow}` };
    frame(ws, r, 6, r, 6, { light: true, fmt: ACC }).value = { formula: `N(${JS}!${a}${jpos.prodRow})` };
    frame(ws, r, 7, r, 7, { light: true, fmt: "0.0000" }).value = { formula: `IF(F${r},E${r}/F${r}*100,0)` };
  });
  frame(ws, 35, 1, 35, 1, { bold: true, fill: TOT }).value = "Total";
  for (const [c, f] of [
    [2, "SUM(B27:B34)"],
    [3, "SUM(C27:C34)"],
    [4, "IF(C35,B35/C35*100,0)"],
    [5, "SUM(E27:E34)"],
    [6, "SUM(F27:F34)"],
    [7, "IF(F35,E35/F35*100,0)"],
  ] as [number, string][])
    frame(ws, 35, c, 35, c, { bold: true, fill: TOT, fmt: c % 3 === 1 ? "0.0000" : ACC }).value = { formula: f };
  ws.getCell(36, 1).value = "% = Fall product / Total qty production × 100 (seperti template). Press, Molding, Barrel, Washing tidak ada laporan QA.";
  ws.getCell(36, 1).font = { name: FONT, size: 8, italic: true, color: { argb: "FF64748B" } };
  const cats = abs(NAME, 1, 27, 1, 34);
  const mk = (t: string, pc: number, cc: number, r1: number, r2: number, fmt: string): ChartSpec => ({
    sheet: NAME,
    type: "bar",
    title: t,
    cats,
    series: [
      { name: prevName, ref: abs(NAME, pc, 27, pc, 34), color: PREV_C, labels: true },
      { name: curName, ref: abs(NAME, cc, 27, cc, 34), color: CUR_C, labels: true },
    ],
    from: { col: 0, row: r1 },
    to: { col: 7, row: r2 },
    numFmt: fmt,
    yMin: 0,
  });
  charts.push(mk("Fall product (%)", 4, 7, 0, 11, "0.000"), mk("Fall product (pcs)", 2, 5, 11, 22, "#,##0"));
}

const sumOf = (s: NgSumSection[] | undefined, key: string) => {
  const m = new Map<string, { after: number; ng: number[] }>();
  for (const sec of s ?? []) for (const r of sec.rows) m.set(keyOf(sec.key, r.part, r.type), r);
  return m.get(key);
};

export async function ngReportToXlsx(d: NgReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const charts: ChartSpec[] = [];
  qcSheet(wb, d);
  const jpos = jatuhSheet(wb, d);
  // Sheet Page 1 dibuat dulu (urutan seperti file QC) tapi diisi setelah NG Rate karena merujuk barisnya.
  const p1 = wb.addWorksheet("Page 1 Monthly Report QC");
  const pct = pctSheet(wb, d);
  const rate = rateSheet(wb, d, charts);
  page1Sheet(p1, d, rate, charts);

  // --- Graphic Perbandingan Iron (NG Henkei vs Before Senbetsu).
  const iron: CmpItem[] = [];
  const jpn = d.summary.find((s) => s.key === "JPN")?.rows ?? [];
  const pt = d.summary.find((s) => s.key === "PT")?.rows ?? [];
  const used = new Set<string>();
  const prevPair = (key: string, idx: number): [number, number] => {
    const p = sumOf(d.prev.summary, key);
    if (!p) return [0, 0];
    const tot = p.ng.reduce((a, b) => a + b, 0);
    return [idx < 0 ? tot : p.ng[idx], p.after + tot];
  };
  for (const x of jpn) {
    const both = pt.some((y) => partKey(y.part) === partKey(x.part));
    const k = keyOf("JPN", x.part, x.type);
    iron.push({ label: `${x.part}-${x.type}${both ? " JPN" : ""}`, key: k, prev: prevPair(k, 5) });
    const twin = pt.find((y) => partKey(y.part) === partKey(x.part) && y.type === x.type);
    if (twin) {
      const k2 = keyOf("PT", twin.part, twin.type);
      used.add(k2);
      iron.push({ label: `${twin.part}-${twin.type} IDN`, key: k2, prev: prevPair(k2, 5) });
    }
  }
  for (const y of pt) {
    const k2 = keyOf("PT", y.part, y.type);
    if (!used.has(k2)) iron.push({ label: `${y.part}-${y.type} IDN`, key: k2, prev: prevPair(k2, 5) });
  }
  const P = q(pct.name);
  const ref = (key: string, c: number) => {
    const r = pct.rows.get(key);
    return r ? `${P}!${col(c)}${r}` : null;
  };
  compareSheet(wb, d, charts, {
    name: "Graphic Perbandingan Iron",
    chartTitle: `Chart Henkei Comparation ${monthName(d.prev.month)} : ${monthName(d.month)} ${d.month.slice(0, 4)}`,
    ngLabel: "NG Henkei",
    items: iron,
    cur: (k) => {
      const h = ref(k, pct.HENKEI);
      const b = ref(k, pct.BEFORE);
      return h && b ? [h, b] : null;
    },
    labelCols: 1,
  });
  compareJatuhSheet(wb, d, jpos, charts);
  const pla = d.summary.find((s) => s.key === "PLASTIC")?.rows ?? [];
  compareSheet(wb, d, charts, {
    name: "Graphic Compare Plastic",
    chartTitle: `Chart NG Plastic ${monthName(d.prev.month)} : ${monthName(d.month)} ${d.month.slice(0, 4)}`,
    ngLabel: "Total NG",
    items: pla.map((x) => {
      const k = keyOf("PLASTIC", x.part, x.type);
      return { label: x.part, key: k, prev: prevPair(k, -1) };
    }),
    cur: (k) => {
      const n = ref(k, pct.AK);
      const b = ref(k, pct.BEFORE);
      return n && b ? [n, b] : null;
    },
    labelCols: 2,
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return addCharts(buf, charts);
}
