import ExcelJS from "exceljs";
import { formatDateId, nowJakarta } from "./dates";
import { ALL_PARTS, dayLabel, isOff, monthDays, ymLabel, type ForecastReport, type XCell, type XSheet } from "./forecast";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";

// Baca file forecast harian, buat template kosong, dan Excel laporan Forecast vs PO harian.

function plain(v: ExcelJS.CellValue): XCell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("result" in v) return plain((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("error" in v) return null;
  }
  return null;
}

/** Workbook -> isi sel (nilai hasil rumus) + penanda sel rumus, per sheet. */
export async function readBook(buf: ArrayBuffer | Buffer): Promise<XSheet[]> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  const out: XSheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const cells: XCell[][] = [];
    const formula: boolean[][] = [];
    const maxR = Math.min(ws.rowCount, 2000);
    const maxC = Math.min(ws.columnCount, 400);
    for (let r = 1; r <= maxR; r++) {
      const row = ws.getRow(r);
      const cr: XCell[] = [];
      const fr: boolean[] = [];
      for (let c = 1; c <= maxC; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        cr.push(plain(v));
        fr.push(!!v && typeof v === "object" && !(v instanceof Date) && ("formula" in v || "sharedFormula" in v));
      }
      cells.push(cr);
      formula.push(fr);
    }
    out.push({ name: ws.name, cells, formula });
  });
  return out;
}

const MAROON = "FF9B1B1F";
const TINT = "FFF8E8E8";
const LINE = "FFE2E8F0";
const MUTED = "FF64748B";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: LINE } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const utc = (ym: string, d = 1) => new Date(`${ym}-${String(d).padStart(2, "0")}T00:00:00Z`);

/**
 * Template forecast harian (satu sheet): No | Part | Pcs/box | Total | tanggal 1..akhir bulan.
 * Sama dengan sheet harian file customer, jadi file customer juga bisa langsung di-upload.
 */
export async function templateXlsx(versi: string, parts: { part: string; box: number }[], customer = ""): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  const list = parts.length ? parts : Array.from({ length: 15 }, () => ({ part: "", box: 0 }));
  const d = wb.addWorksheet(`daily forecast ${ymLabel(versi)}`, { views: [{ state: "frozen", xSplit: 5, ySplit: 3 }] });
  const days = monthDays(versi);
  d.getCell(1, 2).value = `Forecast harian ${ymLabel(versi, true)}${customer ? ` · ${customer}` : ""}`;
  d.getCell(1, 2).font = { bold: true, size: 13, color: { argb: MAROON } };
  d.getCell(2, 2).value = "Isi qty pcs per tanggal. Jangan ubah baris tanggal (baris 3). Baris part boleh ditambah di bawah.";
  d.getCell(2, 2).font = { italic: true, size: 9, color: { argb: MUTED } };
  ["No", "Part", "Pcs/box", "Total"].forEach((h, i) => {
    const c = d.getCell(3, 2 + i);
    c.value = h;
    c.font = { bold: true };
    c.fill = fill(TINT);
    c.border = box;
  });
  days.forEach((t, i) => {
    const c = d.getCell(3, 6 + i);
    c.value = utc(versi, i + 1);
    c.numFmt = "d-mmm";
    c.fill = fill(isOff(t) ? "FFE2E8F0" : TINT);
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
    c.border = box;
    d.getColumn(6 + i).width = 9;
  });
  const lastL = d.getColumn(5 + days.length).letter;
  list.forEach((p, i) => {
    const r = 4 + i;
    d.getCell(r, 2).value = i + 1;
    d.getCell(r, 3).value = p.part || null;
    d.getCell(r, 4).value = p.box || null;
    d.getCell(r, 5).value = { formula: `SUM(F${r}:${lastL}${r})` };
    d.getCell(r, 5).font = { bold: true };
    for (let c = 2; c <= 5 + days.length; c++) {
      d.getCell(r, c).border = box;
      if (c >= 4) d.getCell(r, c).numFmt = "#,##0";
    }
  });
  d.getColumn(1).width = 2;
  d.getColumn(2).width = 5;
  d.getColumn(3).width = 30;
  d.getColumn(4).width = 9;
  d.getColumn(5).width = 12;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Excel laporan: Ringkasan + Harian + Per part + Matriks PO vs forecast + Per customer + Tren bulanan. */
export async function reportXlsx(r: ForecastReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  const month = r.month!;
  const k = r.kpi;
  const title = `Forecast vs Actual PO · ${r.customer}${r.part !== ALL_PARTS ? ` · ${r.part}` : ""}`;
  const sub = `${ymLabel(month, true)}${r.upto ? ` · s/d ${dayLabel(r.upto)}` : ""}`;
  const N = "#,##0;[Red]-#,##0";
  const P = "0.0%;[Red]-0.0%";
  const achFont = (v: number | null) => ({ bold: true, color: { argb: v == null ? MUTED : v >= 0.95 ? "FF047857" : v >= 0.85 ? "FFB45309" : "FFB91C1C" } });

  const head = (ws: ExcelJS.Worksheet, row: number, cols: string[]) => {
    cols.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = fill(MAROON);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
      c.border = box;
    });
    ws.getRow(row).height = 30;
  };
  const kop = (ws: ExcelJS.Worksheet, width: number, t: string) => {
    const logo = wb.addImage({ base64: LOGO_PNG_BASE64, extension: "png" });
    ws.addImage(logo, { tl: { col: 0.1, row: 0.2 }, ext: { width: Math.round(40 * LOGO_RATIO), height: 40 } });
    ws.mergeCells(1, 3, 1, Math.max(width, 6));
    ws.getCell(1, 3).value = t;
    ws.getCell(1, 3).font = { bold: true, size: 15, color: { argb: MAROON } };
    ws.mergeCells(2, 3, 2, Math.max(width, 6));
    ws.getCell(2, 3).value = `${sub}  ·  Dibuat ${formatDateId(nowJakarta().slice(0, 10))} ${nowJakarta().slice(11, 16)} WIB`;
    ws.getCell(2, 3).font = { size: 9, color: { argb: MUTED } };
    ws.getRow(1).height = 26;
    ws.getRow(2).height = 18;
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return 4;
  };
  const line = (ws: ExcelJS.Worksheet, row: number, vals: (ExcelJS.CellValue | null)[], fmts: (string | null)[]) =>
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = box;
      if (fmts[i]) c.numFmt = fmts[i]!;
    });

  // Ringkasan
  const s = wb.addWorksheet("Ringkasan");
  let row = kop(s, 6, title);
  const upto = r.upto ? dayLabel(r.upto) : "-";
  const kpi: [string, number | null, string][] = [
    [`Forecast ${ymLabel(month)} (sebulan)`, k.fcMonth, N],
    [`Forecast s/d ${upto}`, k.fcUpto, N],
    [`Actual PO s/d ${upto}`, k.poUpto, N],
    ["Achievement (PO ÷ forecast)", k.ach, "0.0%"],
    ["Gap (PO - forecast)", k.gap, N],
    ["Gap % dari forecast", k.gapPct, P],
    ["Achievement 7 hari terakhir", k.ach7, "0.0%"],
    ["Achievement 7 hari sebelumnya", k.ach7prev, "0.0%"],
    [`PO bulan lalu s/d tanggal sama`, k.poPrevMonth, N],
    ["Sisa forecast bulan ini", k.fcRest, N],
    ["Hari ada PO", k.poDays, "0"],
  ];
  head(s, row, ["Indikator", "Nilai"]);
  row++;
  for (const [label, v, f] of kpi) {
    line(s, row, [label, v], [null, f]);
    s.getCell(row, 1).font = { bold: true };
    s.getCell(row, 2).font = { bold: true, size: 12 };
    row++;
  }
  s.getColumn(1).width = 36;
  s.getColumn(2).width = 18;

  // Harian
  const h = wb.addWorksheet(`Harian ${ymLabel(month)}`, { views: [{ state: "frozen", ySplit: 4 }] });
  row = kop(h, 8, `Forecast vs PO per Hari · ${ymLabel(month, true)}`);
  head(h, row, ["Tanggal", "Forecast", "Actual PO", "Gap", "Forecast kumulatif", "PO kumulatif", "Gap kumulatif", "Achievement kumulatif"]);
  row++;
  for (const d of r.days) {
    line(h, row, [utc(d.tanggal.slice(0, 7), Number(d.tanggal.slice(8))), d.fc || null, d.po, d.po !== null && !d.future ? d.po - d.fc : null, d.cumFc, d.cumPo, d.cumPo !== null ? d.cumPo - d.cumFc : null, d.ach], ["ddd d mmm", N, N, N, N, N, N, "0.0%"]);
    if (d.ach != null) h.getCell(row, 8).font = achFont(d.ach);
    if (d.future) for (let i = 1; i <= 8; i++) h.getCell(row, i).font = { color: { argb: MUTED }, italic: true };
    else if (isOff(d.tanggal)) for (let i = 1; i <= 8; i++) h.getCell(row, i).fill = fill("FFF1F5F9");
    row++;
  }
  [16, 13, 13, 13, 15, 15, 15, 14].forEach((w, i) => (h.getColumn(i + 1).width = w));

  // Per part
  const p = wb.addWorksheet("Per part", { views: [{ state: "frozen", ySplit: 4 }] });
  row = kop(p, 9, `Per Part · ${sub}`);
  head(p, row, ["Part", "Pcs/box", "Forecast sebulan", `Forecast s/d ${upto}`, `PO s/d ${upto}`, "Gap pcs", "Gap box", "Gap %", "Achievement"]);
  p.autoFilter = { from: { row, column: 1 }, to: { row, column: 9 } };
  row++;
  for (const x of r.parts) {
    line(p, row, [x.part, x.box || null, x.fcMonth, x.fcUpto, x.poUpto, x.diff, x.box ? x.diff / x.box : null, x.pct, x.ach], [null, N, N, N, N, N, "#,##0.0;[Red]-#,##0.0", P, "0.0%"]);
    p.getCell(row, 9).font = achFont(x.ach);
    row++;
  }
  [30, 9, 15, 15, 15, 14, 11, 10, 12].forEach((w, i) => (p.getColumn(i + 1).width = w));

  // Matriks per part per hari
  if (r.heat.length) {
    const dates = r.days.map((d) => d.tanggal);
    const m = wb.addWorksheet("Per part per hari", { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
    row = kop(m, 12, `Forecast & PO per Part per Hari · ${ymLabel(month, true)}`);
    head(m, row, ["Part", "Jenis", "Total", ...dates.map((t) => String(Number(t.slice(8))))]);
    row++;
    for (const x of r.heat) {
      for (const [label, rec, total] of [
        ["Forecast", x.fc, x.fcTotal],
        ["PO", x.po, x.poTotal],
      ] as const) {
        line(m, row, [label === "Forecast" ? x.part : "", label, total, ...dates.map((t) => rec[t] || null)], [null, null, ...Array(dates.length + 1).fill("#,##0")]);
        if (label === "PO") {
          for (let i = 0; i < dates.length; i++) {
            const f = x.fc[dates[i]] ?? 0;
            const q = x.po[dates[i]] ?? 0;
            if (q && f && q < f) m.getCell(row, 4 + i).font = { color: { argb: "FFB91C1C" }, bold: true };
            if (q && q > f) m.getCell(row, 4 + i).font = { color: { argb: "FF047857" }, bold: true };
          }
          for (let i = 1; i <= 3 + dates.length; i++) m.getCell(row, i).fill = fill(TINT);
        }
        row++;
      }
    }
    m.getColumn(1).width = 28;
    m.getColumn(2).width = 9;
    m.getColumn(3).width = 12;
    dates.forEach((_, i) => (m.getColumn(4 + i).width = 8));
  }

  // Per customer
  if (r.perCustomer.length > 1) {
    const c2 = wb.addWorksheet("Per customer");
    row = kop(c2, 5, `Per Customer · ${sub}`);
    head(c2, row, ["Customer", "Forecast sebulan", `Forecast s/d ${upto}`, `PO s/d ${upto}`, "Achievement"]);
    row++;
    for (const c of r.perCustomer) {
      line(c2, row, [c.customer, c.fcMonth, c.fcUpto, c.poUpto, c.ach], [null, N, N, N, "0.0%"]);
      c2.getCell(row, 5).font = achFont(c.ach);
      row++;
    }
    [30, 16, 16, 16, 13].forEach((w, i) => (c2.getColumn(i + 1).width = w));
  }

  // Tren bulanan
  if (r.monthly.length) {
    const t = wb.addWorksheet("Tren bulanan");
    row = kop(t, 6, `Tren Bulanan Forecast vs PO · ${r.customer}`);
    head(t, row, ["Bulan", "Forecast sebulan", "Forecast s/d batas", "PO s/d batas", "Achievement", "Keterangan"]);
    row++;
    for (const x of r.monthly) {
      line(t, row, [utc(x.bulan), x.fc, x.fcUpto, x.poUpto, x.ach, x.partial && x.upto ? `s/d ${dayLabel(x.upto)}` : "sebulan penuh"], ["mmm yyyy", N, N, N, "0.0%", null]);
      t.getCell(row, 5).font = achFont(x.ach);
      row++;
    }
    [12, 16, 16, 16, 13, 16].forEach((w, i) => (t.getColumn(i + 1).width = w));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
