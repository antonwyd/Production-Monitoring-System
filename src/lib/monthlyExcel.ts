import ExcelJS from "exceljs";
import JSZip from "jszip";
import { formatDateId, nowJakarta } from "./dates";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";
import { monthShort, type MonthlyReport, type SectionReport } from "./monthly";

// Production Report bulanan dalam Excel: sheet "Ringkasan" + satu sheet per section dengan susunan seperti slide PPT:
// kiri = 1. Chart (grafik Excel asli, bisa disalin ke PowerPoint) dan 3. Plan & Result, kanan = 2. Daily Production.

const MAROON = "FF9B1B1F";
const TINT = "FFF8E8E8";
const LINE = "FFCBD5E1";
const MUTED = "FF64748B";
const RED = "FFC00000";
const GOOD = "FF065F46";
const OFF = "FFF1F5F9";

const thin = { style: "thin" as const, color: { argb: LINE } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const INT = "#,##0;[Red](#,##0)";
const DEC1 = "#,##0.0;[Red]-#,##0.0";

/** Posisi tabel & grafik di sheet section (dipakai juga saat menyisipkan grafik). */
const DAILY_COL = 10; // kolom J
const DAILY_HEAD = 6; // baris judul tabel harian (2 baris header)
const CHART_FROM = { col: 0, row: 5 }; // A6
const CHART_TO = { col: 8, row: 27 }; // sampai I27

function sheetName(s: string) {
  return s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function kop(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, r: MonthlyReport, section: string, pic: string, width: number) {
  const logo = wb.addImage({ base64: LOGO_PNG_BASE64, extension: "png" });
  ws.addImage(logo, { tl: { col: 0.15, row: 0.2 }, ext: { width: Math.round(40 * LOGO_RATIO), height: 40 } });
  ws.mergeCells(1, 3, 1, 8);
  const t = ws.getCell(1, 3);
  t.value = "PRODUCTION REPORT";
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(2, 3, 2, 8);
  const p = ws.getCell(2, 3);
  p.value = `Periode ${r.label}`;
  p.font = { bold: true, size: 11, color: { argb: MAROON }, underline: true };
  p.alignment = { horizontal: "center" };
  const info: [string, string][] = [
    ["PIC", pic || "-"],
    ["SECTION", section],
    ["DATE", formatDateId(nowJakarta().slice(0, 10))],
  ];
  info.forEach(([k, v], i) => {
    ws.getCell(i + 1, width - 2).value = k;
    ws.getCell(i + 1, width - 1).value = `: ${v}`;
    ws.getCell(i + 1, width - 2).font = { size: 9 };
    ws.getCell(i + 1, width - 1).font = { size: 9, bold: k === "SECTION" };
  });
  ws.getRow(1).height = 22;
  for (let c = 1; c <= width; c++) ws.getCell(4, c).border = { top: { style: "medium", color: { argb: MAROON } } };
}

function head(c: ExcelJS.Cell, v: string) {
  c.value = v;
  c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
  c.fill = fill(MAROON);
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  c.border = box;
}

function title(ws: ExcelJS.Worksheet, row: number, col: number, text: string) {
  const c = ws.getCell(row, col);
  c.value = text;
  c.font = { bold: true, size: 11, color: { argb: MAROON } };
}

function sectionSheet(wb: ExcelJS.Workbook, r: MonthlyReport, s: SectionReport) {
  const ws = wb.addWorksheet(sheetName(s.def.name), { views: [{ showGridLines: false }] });
  const nCols = s.columns.length;
  const lastCol = DAILY_COL + nCols + 5; // Date, Plan, cols.., Total, Balance, Total Plan, Total Result
  kop(wb, ws, r, s.def.name, s.pic, lastCol);
  // lebar kolom
  ws.getColumn(1).width = 22;
  for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 11;
  ws.getColumn(9).width = 3;
  ws.getColumn(DAILY_COL).width = 8;
  for (let c = DAILY_COL + 1; c <= lastCol; c++) ws.getColumn(c).width = 11.5;

  title(ws, 5, 1, "1. Chart");

  // 3. Plan & Result di bawah grafik
  let row = CHART_TO.row + 2;
  title(ws, row, 1, "3. Plan & Result");
  row++;
  ws.mergeCells(row, 1, row + 1, 1);
  head(ws.getCell(row, 1), "Description");
  ws.mergeCells(row, 2, row, 4);
  head(ws.getCell(row, 2), monthShort(r.month));
  ws.mergeCells(row, 5, row, 7);
  head(ws.getCell(row, 5), monthShort(r.nextMonth));
  ["Plan", "Result", "%", "Plan", "Result", "%"].forEach((h, i) => head(ws.getCell(row + 1, i + 2), h));
  row += 2;
  for (const l of s.lines) {
    const fmt = l.format === "dec1" ? DEC1 : INT;
    const a = ws.getCell(row, 1);
    a.value = l.label;
    a.font = { bold: true, size: 9 };
    const vals: (number | null)[] = [l.plan, l.result, null, l.next, null, null];
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 2);
      c.value = v;
      c.numFmt = fmt;
      c.font = { size: 9 };
    });
    const pc = ws.getCell(row, 4);
    pc.value = { formula: `IFERROR(C${row}/B${row},"")` };
    pc.numFmt = "0.0%";
    pc.font = { size: 9, bold: true, color: { argb: l.pct != null && l.pct < 1 ? RED : GOOD } };
    for (let c = 1; c <= 7; c++) ws.getCell(row, c).border = box;
    row++;
  }
  row++;
  title(ws, row, 1, "Notes:");
  ws.mergeCells(row + 1, 1, row + 4, 8);
  const n = ws.getCell(row + 1, 1);
  n.value = s.note || (s.hasPlan ? "" : "Plan bulan ini belum diisi leader.");
  n.alignment = { wrapText: true, vertical: "top" };
  n.border = box;

  // 4. Per part & kualitas di bawah Notes
  row += 6;
  title(ws, row, 1, "4. Per Part & Kualitas");
  const q = s.quality;
  const qn = ws.getCell(row + 1, 1);
  qn.value = `Total OK ${q.qty.toLocaleString("id-ID")} pcs · NG ${q.ng.toLocaleString("id-ID")} pcs · NG rate ${q.rate == null ? "-" : `${(q.rate * 100).toFixed(2).replace(".", ",")}%`}${q.top.length ? ` · NG terbanyak: ${q.top.slice(0, 3).map((t) => t.name).join(", ")}` : ""}`;
  qn.font = { size: 9, color: { argb: MUTED } };
  row += 2;
  ["Part", "Kategori", "Result (pcs)", "Porsi", "OT (pcs)", "NG (pcs)", "NG rate", "NG terbanyak"].forEach((h, i) => head(ws.getCell(row, i + 1), h));
  row++;
  for (const p of s.parts) {
    const v: (string | number | null)[] = [p.part, p.category, p.qty, p.share, p.qtyOt || null, p.ng || null, p.rate, p.topNg || ""];
    v.forEach((x, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = x;
      c.border = box;
      c.font = { size: 9, bold: i === 0 };
      if (i === 2 || i === 4 || i === 5) c.numFmt = INT;
      if (i === 3) c.numFmt = "0.0%";
      if (i === 6) c.numFmt = "0.00%";
    });
    row++;
  }

  // 2. Daily Production di kanan
  title(ws, 5, DAILY_COL, "2. Daily Production");
  const h1 = DAILY_HEAD,
    h2 = DAILY_HEAD + 1;
  ws.mergeCells(h1, DAILY_COL, h2, DAILY_COL);
  head(ws.getCell(h1, DAILY_COL), "Date");
  ws.mergeCells(h1, DAILY_COL + 1, h2, DAILY_COL + 1);
  head(ws.getCell(h1, DAILY_COL + 1), "Daily Plan");
  ws.mergeCells(h1, DAILY_COL + 2, h1, DAILY_COL + 2 + nCols);
  head(ws.getCell(h1, DAILY_COL + 2), "Daily Result");
  s.columns.forEach((c, i) => head(ws.getCell(h2, DAILY_COL + 2 + i), c));
  head(ws.getCell(h2, DAILY_COL + 2 + nCols), "Total");
  const extra = ["Balance", "Total Plan", "Total Result"];
  extra.forEach((t, i) => {
    ws.mergeCells(h1, DAILY_COL + 3 + nCols + i, h2, DAILY_COL + 3 + nCols + i);
    head(ws.getCell(h1, DAILY_COL + 3 + nCols + i), t);
  });
  ws.getRow(h2).height = 26;
  let dr = h2 + 1;
  const first = dr;
  const L = (c: number) => ws.getColumn(c).letter;
  for (const d of s.daily) {
    const vals: (number | string | null | ExcelJS.CellFormulaValue)[] = [
      `${d.day}-${monthShort(d.date.slice(0, 7)).slice(0, 3)}`,
      d.plan,
      ...d.cols.map((v) => v || null),
      { formula: `SUM(${L(DAILY_COL + 2)}${dr}:${L(DAILY_COL + 1 + nCols)}${dr})`, result: d.total },
      { formula: `${L(DAILY_COL + 2 + nCols)}${dr}-${L(DAILY_COL + 1)}${dr}`, result: d.balance },
      { formula: dr === first ? `${L(DAILY_COL + 1)}${dr}` : `${L(DAILY_COL + 4 + nCols)}${dr - 1}+${L(DAILY_COL + 1)}${dr}`, result: d.cumPlan },
      { formula: dr === first ? `${L(DAILY_COL + 2 + nCols)}${dr}` : `${L(DAILY_COL + 5 + nCols)}${dr - 1}+${L(DAILY_COL + 2 + nCols)}${dr}`, result: d.cumResult },
    ];
    vals.forEach((v, i) => {
      const c = ws.getCell(dr, DAILY_COL + i);
      c.value = v as ExcelJS.CellValue;
      c.border = box;
      c.font = { size: 9, color: i === 0 && !d.work ? { argb: RED } : undefined };
      if (i > 0) c.numFmt = INT;
      else c.alignment = { horizontal: "center" };
      if (!d.work) c.fill = fill(OFF);
    });
    dr++;
  }
  const tot = ws.getCell(dr, DAILY_COL);
  tot.value = "Total";
  for (let i = 1; i <= nCols + 2; i++) {
    const c = ws.getCell(dr, DAILY_COL + i);
    c.value = { formula: `SUM(${L(DAILY_COL + i)}${first}:${L(DAILY_COL + i)}${dr - 1})` };
    c.numFmt = INT;
  }
  const bal = ws.getCell(dr, DAILY_COL + nCols + 3);
  bal.value = { formula: `${L(DAILY_COL + nCols + 2)}${dr}-${L(DAILY_COL + 1)}${dr}`, result: s.total.balance };
  bal.numFmt = INT;
  for (let i = 0; i <= nCols + 5; i++) {
    const c = ws.getCell(dr, DAILY_COL + i);
    c.font = { bold: true, size: 9 };
    c.fill = fill(TINT);
    c.border = box;
  }
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  return { ws, firstRow: first, lastRow: dr - 1, nCols };
}

function summarySheet(wb: ExcelJS.Workbook, r: MonthlyReport) {
  const ws = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  const cols = ["Section", "Plan", "Result", "%", "Balance", "Member/MC Plan", "Member/MC Result", "Productivity Plan", "Productivity Result", `Plan ${monthShort(r.nextMonth)}`, "PIC"];
  kop(wb, ws, r, "Semua section", "", cols.length + 2);
  ws.getColumn(1).width = 20;
  for (let c = 2; c <= cols.length; c++) ws.getColumn(c).width = 14;
  ws.getColumn(cols.length).width = 20;
  title(ws, 6, 1, `Ringkasan Plan vs Result · ${r.label}`);
  cols.forEach((h, i) => head(ws.getCell(7, i + 1), h));
  ws.getRow(7).height = 30;
  r.sections.forEach((s, k) => {
    const row = 8 + k;
    const vals: (string | number | null)[] = [
      s.def.name,
      s.lines[0].plan,
      s.lines[0].result,
      null,
      s.hasPlan ? s.total.balance : null,
      s.lines[4].plan,
      s.lines[4].result,
      s.lines[5].plan,
      s.lines[5].result,
      s.lines[0].next,
      s.pic || "-",
    ];
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = box;
      if (i > 0 && i < 10) c.numFmt = INT;
      if (i === 0) c.font = { bold: true };
    });
    const pc = ws.getCell(row, 4);
    pc.value = { formula: `IFERROR(C${row}/B${row},"")` };
    pc.numFmt = "0.0%";
    pc.font = { bold: true, color: { argb: s.lines[0].pct != null && s.lines[0].pct < 1 ? RED : GOOD } };
  });
  const nr = 9 + r.sections.length;
  ws.mergeCells(nr, 1, nr + 1, cols.length);
  const n = ws.getCell(nr, 1);
  n.value =
    "Productivity = pcs per jam per member (Senbetsu/Seiretsu) atau per mesin (PF). Time Required = Production / (Productivity x Member/MC). Need Over Time = Time Required - Time Normal. Result dari laporan yang sudah disetujui leader, Plan diisi leader di web.";
  n.font = { italic: true, size: 9, color: { argb: MUTED } };
  n.alignment = { wrapText: true, vertical: "top" };
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
}

// ---------- Grafik Excel asli (exceljs belum bisa membuat chart, jadi XML-nya disisipkan sendiri) ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function series(idx: number, name: string, cat: string, val: string, color: string, kind: "bar" | "line", dash = false) {
  const sp =
    kind === "bar"
      ? `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`
      : `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dash ? '<a:prstDash val="dash"/>' : ""}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>`;
  return `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/><c:tx><c:v>${esc(name)}</c:v></c:tx>${sp}<c:cat><c:strRef><c:f>${esc(cat)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(val)}</c:f></c:numRef></c:val>${kind === "line" ? '<c:smooth val="0"/>' : ""}</c:ser>`;
}

const axis = (tag: "catAx" | "valAx", id: number, cross: number, pos: string, opts: { del?: boolean; crosses?: string; grid?: boolean } = {}) =>
  `<c:${tag}><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${opts.del ? 1 : 0}"/><c:axPos val="${pos}"/>${opts.grid ? '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' : ""}${tag === "valAx" ? '<c:numFmt formatCode="#,##0" sourceLinked="0"/>' : ""}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="700"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:crossAx val="${cross}"/><c:crosses val="${opts.crosses ?? "autoZero"}"/>${tag === "catAx" ? '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/>' : '<c:crossBetween val="between"/>'}</c:${tag}>`;

function chartXml(sheet: string, firstRow: number, lastRow: number, nCols: number, title: string) {
  const L = (c: number) => {
    let s = "";
    for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const ref = (c: number) => `'${sheet.replace(/'/g, "''")}'!$${L(c)}$${firstRow}:$${L(c)}$${lastRow}`;
  const cat = ref(DAILY_COL);
  const bars =
    series(0, "Daily Plan", cat, ref(DAILY_COL + 1), "7030A0", "bar") + series(1, "Daily Result", cat, ref(DAILY_COL + 2 + nCols), "92D050", "bar");
  const lines =
    series(2, "Total Plan", cat, ref(DAILY_COL + 4 + nCols), "7030A0", "line", true) + series(3, "Total Result", cat, ref(DAILY_COL + 5 + nCols), "70AD47", "line");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1000" b="1"/><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${bars}<c:gapWidth val="60"/><c:axId val="1001"/><c:axId val="1002"/></c:barChart><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lines}<c:marker val="1"/><c:axId val="1003"/><c:axId val="1004"/></c:lineChart>${axis("catAx", 1001, 1002, "b")}${axis("valAx", 1002, 1001, "l", { grid: true })}${axis("catAx", 1003, 1004, "b", { del: true })}${axis("valAx", 1004, 1003, "r", { crosses: "max" })}</c:plotArea><c:legend><c:legendPos val="t"/><c:overlay val="0"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}

const anchor = (rid: string, id: number) =>
  `<xdr:twoCellAnchor><xdr:from><xdr:col>${CHART_FROM.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${CHART_FROM.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${CHART_TO.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${CHART_TO.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

/** Sisipkan grafik ke drawing tiap sheet section (drawing sudah ada karena logo). */
async function addCharts(buf: Buffer, charts: { sheetIndex: number; sheet: string; firstRow: number; lastRow: number; nCols: number; title: string }[]) {
  const zip = await JSZip.loadAsync(buf);
  let types = await zip.file("[Content_Types].xml")!.async("string");
  let n = 0;
  for (const c of charts) {
    const relsPath = `xl/worksheets/_rels/sheet${c.sheetIndex}.xml.rels`;
    const rels = await zip.file(relsPath)?.async("string");
    const target = rels?.match(/Target="([^"]*drawings\/drawing\d+\.xml)"/)?.[1];
    if (!target) continue;
    const drawingPath = `xl/drawings/${target.split("/").pop()}`;
    const drawingRels = `xl/drawings/_rels/${target.split("/").pop()}.rels`;
    n++;
    const chartPath = `xl/charts/chart${n}.xml`;
    zip.file(chartPath, chartXml(c.sheet, c.firstRow, c.lastRow, c.nCols, c.title));
    const rid = `rIdChart${n}`;
    const dr = (await zip.file(drawingRels)?.async("string")) ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    zip.file(drawingRels, dr.replace("</Relationships>", `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/></Relationships>`));
    const d = await zip.file(drawingPath)!.async("string");
    zip.file(drawingPath, d.replace("</xdr:wsDr>", `${anchor(rid, 100 + n)}</xdr:wsDr>`));
    types = types.replace("</Types>", `<Override PartName="/${chartPath}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
  }
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function monthlyToXlsx(r: MonthlyReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QA Production";
  wb.created = new Date();
  summarySheet(wb, r);
  const charts = r.sections.map((s, i) => {
    const { ws, firstRow, lastRow, nCols } = sectionSheet(wb, r, s);
    return { sheetIndex: i + 2, sheet: ws.name, firstRow, lastRow, nCols, title: `${s.def.name} · ${r.label}` };
  });
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return addCharts(buf, charts);
}
