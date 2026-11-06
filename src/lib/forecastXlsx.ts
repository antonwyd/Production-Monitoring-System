import ExcelJS from "exceljs";
import { formatDateId, nowJakarta } from "./dates";
import { addMonths, ALL_PARTS, diffStatus, fyLabel, ymLabel, type ForecastReport, type XCell, type XSheet } from "./forecast";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";

// Baca file forecast customer, buat template kosong, dan Excel laporan Forecast vs PO.

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
 * Template kosong dengan format sama seperti file customer:
 * sheet "monthly forecast" (No | Part | qty/box | bulan-bulan dengan label actual/plan/forecast | forecast lama)
 * dan sheet "daily forecast" (No | Part | qty/box | Total | tanggal 1..akhir bulan).
 */
export async function templateXlsx(versi: string, parts: { part: string; box: number }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  const list = parts.length ? parts : Array.from({ length: 10 }, () => ({ part: "", box: 0 }));

  const m = wb.addWorksheet(`monthly forecast`, { views: [{ state: "frozen", xSplit: 4, ySplit: 3 }] });
  const months: { ym: string; label: string }[] = [];
  for (let i = -12; i <= 4; i++) months.push({ ym: addMonths(versi, i), label: i < 0 ? "actual" : i === 0 ? "plan" : "forecast" });
  months.push({ ym: versi, label: "forecast" }); // forecast lama untuk bulan versi
  m.getCell(1, 2).value = "Isi qty pcs. Label baris 2: actual = PO sudah terjadi, plan = PO firm bulan ini, forecast = perkiraan. Kolom terakhir = forecast lama bulan ini.";
  m.getCell(1, 2).font = { italic: true, size: 9, color: { argb: MUTED } };
  m.getCell(2, 4).value = "qty";
  m.getCell(3, 4).value = "box";
  m.getCell(3, 2).value = "No";
  m.getCell(3, 3).value = "Part";
  months.forEach((x, i) => {
    const c = 5 + i + (i === months.length - 1 ? 1 : 0); // satu kolom kosong sebelum forecast lama
    m.getCell(2, c).value = x.label;
    const d = m.getCell(3, c);
    d.value = utc(x.ym);
    d.numFmt = "mmm-yy";
    for (const r of [2, 3]) {
      const cell = m.getCell(r, c);
      cell.font = { bold: true, color: { argb: x.label === "actual" ? "FF334155" : "FFFFFFFF" } };
      cell.fill = fill(x.label === "actual" ? "FFE2E8F0" : x.label === "plan" ? MAROON : "FF64748B");
      cell.alignment = { horizontal: "center" };
    }
  });
  for (const r of [2, 3]) for (const c of [2, 3, 4]) (m.getCell(r, c).font = { bold: true }), (m.getCell(r, c).fill = fill(TINT));
  const lastCol = 5 + months.length;
  list.forEach((p, i) => {
    const r = 4 + i;
    m.getCell(r, 2).value = i + 1;
    m.getCell(r, 3).value = p.part;
    m.getCell(r, 4).value = p.box || null;
    for (let c = 2; c <= lastCol; c++) {
      m.getCell(r, c).border = box;
      if (c >= 4) m.getCell(r, c).numFmt = "#,##0";
    }
  });
  const totR = 4 + list.length;
  const colL = (c: number) => m.getColumn(c).letter;
  for (let c = 5; c <= lastCol; c++) {
    if (c === lastCol - 1) continue;
    const t = m.getCell(totR, c);
    t.value = { formula: `SUM(${colL(c)}4:${colL(c)}${totR - 1})` };
    t.numFmt = "#,##0";
    t.font = { bold: true };
  }
  m.getCell(totR + 1, 4).value = "plan";
  m.getCell(totR + 2, 4).value = "diff";
  m.getCell(totR + 3, 4).value = "%";
  for (let c = 5; c <= lastCol; c++) {
    if (c === lastCol - 1) continue;
    const L = colL(c);
    m.getCell(totR + 1, c).numFmt = "#,##0";
    m.getCell(totR + 2, c).value = { formula: `IF(${L}${totR + 1}="","",${L}${totR}-${L}${totR + 1})` };
    m.getCell(totR + 2, c).numFmt = "#,##0";
    m.getCell(totR + 3, c).value = { formula: `IF(N(${L}${totR + 1})=0,"",${L}${totR + 2}/${L}${totR + 1})` };
    m.getCell(totR + 3, c).numFmt = "0.0%";
  }
  m.getCell(totR + 1, 3).value = "← forecast total yang dulu diberikan (boleh kosong)";
  m.getCell(totR + 1, 3).font = { italic: true, size: 9, color: { argb: MUTED } };
  m.getColumn(2).width = 5;
  m.getColumn(3).width = 30;
  m.getColumn(4).width = 9;
  for (let c = 5; c <= lastCol; c++) m.getColumn(c).width = 12;
  m.getColumn(lastCol - 1).width = 3;

  const d = wb.addWorksheet(`daily forecast`, { views: [{ state: "frozen", xSplit: 5, ySplit: 3 }] });
  const [y, mo] = versi.split("-").map(Number);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  d.getCell(3, 2).value = "No";
  d.getCell(3, 3).value = "Part";
  d.getCell(3, 4).value = "qty/box";
  d.getCell(3, 5).value = "Total";
  for (let i = 1; i <= days; i++) {
    const c = d.getCell(3, 5 + i);
    c.value = utc(versi, i);
    c.numFmt = "d-mmm";
    const wd = utc(versi, i).getUTCDay();
    c.fill = fill(wd === 0 || wd === 6 ? "FFE2E8F0" : TINT);
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
    d.getColumn(5 + i).width = 9;
  }
  for (const c of [2, 3, 4, 5]) (d.getCell(3, c).font = { bold: true }), (d.getCell(3, c).fill = fill(TINT));
  list.forEach((p, i) => {
    const r = 4 + i;
    d.getCell(r, 2).value = i + 1;
    d.getCell(r, 3).value = p.part;
    d.getCell(r, 4).value = p.box || null;
    d.getCell(r, 5).value = { formula: `SUM(F${r}:${d.getColumn(5 + days).letter}${r})` };
    for (let c = 2; c <= 5 + days; c++) {
      d.getCell(r, c).border = box;
      if (c >= 4) d.getCell(r, c).numFmt = "#,##0";
    }
  });
  d.getColumn(2).width = 5;
  d.getColumn(3).width = 30;
  d.getColumn(4).width = 9;
  d.getColumn(5).width = 12;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Excel laporan: Ringkasan + Tren bulanan + Per part + Harian. */
export async function reportXlsx(r: ForecastReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  const sel = r.sel;
  const title = `Forecast vs Actual PO · ${r.customer}${r.part !== ALL_PARTS ? ` · ${r.part}` : ""}`;
  const sub = `${fyLabel(r.fy)}${sel ? ` · detail bulan ${ymLabel(sel.bulan, true)}` : ""}`;

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
  const colorPct = (c: ExcelJS.Cell, v: number | null) => {
    const st = diffStatus(v);
    if (st === "naik") c.font = { color: { argb: "FF047857" }, bold: true };
    if (st === "turun") c.font = { color: { argb: "FFB91C1C" }, bold: true };
  };

  // Ringkasan
  const s = wb.addWorksheet("Ringkasan");
  let row = kop(s, 6, title);
  const f = r.fySum;
  const P = "0.0%;[Red]-0.0%";
  const N = "#,##0;[Red]-#,##0";
  const kpi: [string, number | null, string][] = [
    [`Total Forecast FY${r.fy}`, f.forecast, N],
    [`Total Actual PO FY${r.fy}`, f.actual, N],
    ["Achievement (PO ÷ forecast)", f.achievement, "0.0%"],
    ["Gap (PO - forecast)", f.gap, N],
    ["Gap % dari forecast", f.gapPct, P],
    [`Forecast vs FY${r.fy - 1}`, f.forecastGrowth, P],
    [`Actual PO vs FY${r.fy - 1}`, f.actualGrowth, P],
    [f.last ? `Tren PO ${ymLabel(f.last.bulan)} vs bulan lalu` : "Tren vs bulan lalu", f.last?.mom ?? null, P],
    [`Sisa forecast FY (${f.remainingMonths} bln)`, f.remaining, N],
    [`Akurasi forecast (${r.stats.n} bln)`, r.stats.accuracy, "0.0%"],
    ["Rata-rata selisih (bias)", r.stats.bias, P],
  ];
  head(s, row, ["Indikator", "Nilai"]);
  row++;
  for (const [k, v, f] of kpi) {
    s.getCell(row, 1).value = k;
    s.getCell(row, 1).font = { bold: true };
    const c = s.getCell(row, 2);
    c.value = v;
    c.numFmt = f;
    c.font = { bold: true, size: 12 };
    s.getCell(row, 1).border = box;
    c.border = box;
    row++;
  }
  s.getColumn(1).width = 34;
  s.getColumn(2).width = 18;

  if (f.matched < f.months) {
    s.getCell(row + 1, 1).value = `Forecast/Achievement hanya bulan yang punya forecast (${f.matched} dari ${f.months} bulan). PO semua bulan FY: ${Math.round(f.actualAll).toLocaleString("id-ID")} pcs.`;
    s.getCell(row + 1, 1).font = { italic: true, size: 9, color: { argb: MUTED } };
  }

  // Rekap bulanan FY
  const k = wb.addWorksheet(`Rekap FY${r.fy}`, { views: [{ state: "frozen", ySplit: 4 }] });
  row = kop(k, 6, `Rekap Bulanan Forecast vs Actual · FY${r.fy}`);
  head(k, row, ["Bulan", "Forecast (pcs)", "Actual PO (pcs)", "Gap (pcs)", "Achievement", "Tren vs bulan lalu"]);
  row++;
  for (const m of r.fyPoints.filter((x) => x.actual !== null || x.forecast !== null)) {
    const vals = [utc(m.bulan), m.forecast, m.actual, m.diff, m.ach, m.actual !== null ? m.mom : null];
    vals.forEach((v, i) => {
      const c = k.getCell(row, i + 1);
      c.value = v;
      c.border = box;
      c.numFmt = i === 0 ? "mmm yyyy" : i === 4 ? "0.0%" : i === 5 ? P : N;
      if (m.actual === null) c.font = { color: { argb: MUTED }, italic: true };
    });
    if (m.ach != null) k.getCell(row, 5).font = { bold: true, color: { argb: m.ach >= 0.95 ? "FF047857" : m.ach >= 0.85 ? "FFB45309" : "FFB91C1C" } };
    if (m.bulan === sel?.bulan) for (let i = 1; i <= 6; i++) k.getCell(row, i).fill = fill(TINT);
    row++;
  }
  ["Total (YTD)", f.forecast, f.actual, f.gap, f.achievement, null].forEach((v, i) => {
    const c = k.getCell(row, i + 1);
    c.value = v as ExcelJS.CellValue;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill("FF1E293B");
    c.numFmt = i === 4 ? "0.0%" : N;
  });
  [14, 16, 16, 15, 13, 16].forEach((w, i) => (k.getColumn(i + 1).width = w));

  // Per customer
  if (r.perCustomer.length) {
    const c2 = wb.addWorksheet("Per customer");
    row = kop(c2, 4, `Actual PO per Customer · FY${r.fy}`);
    head(c2, row, ["Customer", "Actual PO (pcs)", "Forecast (pcs)", "Achievement"]);
    row++;
    for (const c of r.perCustomer) {
      [c.customer, c.actual, c.forecast, c.ach].forEach((v, i) => {
        const cell = c2.getCell(row, i + 1);
        cell.value = v;
        cell.border = box;
        if (i) cell.numFmt = i === 3 ? "0.0%" : N;
      });
      row++;
    }
    [30, 16, 16, 13].forEach((w, i) => (c2.getColumn(i + 1).width = w));
  }

  // Tren bulanan
  const t = wb.addWorksheet("Tren semua bulan", { views: [{ state: "frozen", ySplit: 4 }] });
  row = kop(t, 8, `Tren Forecast vs PO · ${r.customer}`);
  head(t, row, ["Bulan", "Status", "Forecast", "PO aktual", "Selisih", "Selisih %", "Naik vs bln lalu", "Naik vs thn lalu"]);
  t.autoFilter = { from: { row, column: 1 }, to: { row, column: 8 } };
  row++;
  for (const m of r.months) {
    const vals: (string | number | Date | null)[] = [utc(m.bulan), m.kind === "actual" ? "Aktual" : m.kind === "plan" ? "PO firm" : "Forecast", m.forecast, m.actual, m.diff, m.pct, m.mom, m.yoy];
    vals.forEach((v, i) => {
      const c = t.getCell(row, i + 1);
      c.value = v;
      c.border = box;
      c.numFmt = i === 0 ? "mmm yyyy" : i >= 5 ? "0.0%;[Red]-0.0%" : i >= 2 ? "#,##0;[Red]-#,##0" : "@";
    });
    colorPct(t.getCell(row, 6), m.pct);
    if (m.bulan === sel?.bulan) for (let i = 1; i <= 8; i++) t.getCell(row, i).fill = fill(TINT);
    row++;
  }
  [12, 10, 14, 14, 14, 11, 13, 13].forEach((w, i) => (t.getColumn(i + 1).width = w));

  // Per part
  if (sel) {
    const p = wb.addWorksheet(`Per part ${ymLabel(sel.bulan)}`, { views: [{ state: "frozen", ySplit: 4 }] });
    row = kop(p, 10, `Per Part · ${ymLabel(sel.bulan, true)}`);
    head(p, row, ["Part", "Pcs/box", "Forecast", "PO aktual", "Selisih", "Selisih %", "Selisih box", "PO bln lalu", "Naik vs bln lalu", `Bulan depan`]);
    p.autoFilter = { from: { row, column: 1 }, to: { row, column: 10 } };
    row++;
    for (const x of r.parts) {
      const vals = [x.part, x.box || null, x.forecast, x.actual, x.diff, x.pct, x.box && x.diff !== null ? x.diff / x.box : null, x.prevActual, x.mom, x.next];
      vals.forEach((v, i) => {
        const c = p.getCell(row, i + 1);
        c.value = v as ExcelJS.CellValue;
        c.border = box;
        if (i > 0) c.numFmt = i === 5 || i === 8 ? "0.0%;[Red]-0.0%" : i === 6 ? "#,##0.0;[Red]-#,##0.0" : "#,##0;[Red]-#,##0";
      });
      colorPct(p.getCell(row, 6), x.pct);
      row++;
    }
    [30, 9, 14, 14, 14, 11, 11, 14, 13, 14].forEach((w, i) => (p.getColumn(i + 1).width = w));
  }

  // Harian
  if (sel && r.dailyParts.length) {
    const days = r.daily.map((d) => d.tanggal);
    const h = wb.addWorksheet(`Harian ${ymLabel(sel.bulan)}`, { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
    row = kop(h, 12, `PO Harian · ${ymLabel(sel.bulan, true)}`);
    head(h, row, ["Part", "Total", ...days.map((d) => String(Number(d.slice(8))))]);
    row++;
    const write = (label: string, total: number, get: (d: string) => number, bold = false) => {
      h.getCell(row, 1).value = label;
      h.getCell(row, 2).value = total;
      days.forEach((d, i) => (h.getCell(row, 3 + i).value = get(d) || null));
      for (let c = 1; c <= 2 + days.length; c++) {
        const cell = h.getCell(row, c);
        cell.border = box;
        if (c > 1) cell.numFmt = "#,##0";
        if (bold) (cell.font = { bold: true }), (cell.fill = fill(TINT));
      }
      row++;
    };
    write("TOTAL", r.daily.reduce((a, d) => a + d.qty, 0), (d) => r.daily.find((x) => x.tanggal === d)?.qty ?? 0, true);
    for (const x of r.dailyParts) write(x.part, x.total, (d) => x.days[d] ?? 0);
    h.getColumn(1).width = 28;
    h.getColumn(2).width = 13;
    days.forEach((_, i) => (h.getColumn(3 + i).width = 9));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
