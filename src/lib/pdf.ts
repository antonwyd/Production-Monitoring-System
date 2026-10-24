import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDateId, nowJakarta } from "./dates";
import { formatCell } from "./format";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";
import type { Chart, ColFormat, Report, Table } from "./reports";

// PDF siap kirim / cetak, dibuat di server (bukan print browser): A4 landscape, kop + logo di tiap halaman,
// angka utama vs target, grafik utama, tabel, kotak Dibuat / Diperiksa / Disetujui, nomor halaman.

const MAROON: [number, number, number] = [155, 27, 31];
const PINK: [number, number, number] = [232, 165, 167];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const GOOD: [number, number, number] = [6, 95, 70];
const GOOD_BG: [number, number, number] = [209, 250, 229];
const BAD: [number, number, number] = [153, 27, 27];
const BAD_BG: [number, number, number] = [254, 226, 226];

const W = 297;
const H = 210;
const M = 12;
const TOP = 30; // isi dimulai di bawah kop
/** Daftar rincian dipotong di PDF, lengkapnya di Excel. */
const DETAIL_ROWS = 15;

const isNum = (f?: ColFormat) => !!f && f !== "text" && f !== "grade";

/** Huruf standar PDF (Helvetica) tidak punya beberapa simbol; ganti dengan yang setara. */
const safe = (s: string) =>
  s
    .replace(/▲/g, "+")
    .replace(/▼/g, "-")
    .replace(/[−–—]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E -ÿ]/g, "");

/** Kop sekali per halaman (autoTable juga memanggilnya saat tabel pindah halaman). */
function kop(doc: jsPDF, r: Report) {
  const page = doc.getCurrentPageInfo().pageNumber;
  const done = (doc as unknown as { _kop?: Set<number> })._kop ?? new Set<number>();
  (doc as unknown as { _kop?: Set<number> })._kop = done;
  if (done.has(page)) return;
  done.add(page);
  const lh = 13;
  doc.addImage(LOGO_PNG_BASE64, "PNG", M, 8, lh * LOGO_RATIO, lh);
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
  doc.text("PT. TAKAI SEIKI INDONESIA", M + lh * LOGO_RATIO + 5, 11.5);
  doc.setFontSize(15).setTextColor(...MAROON);
  doc.text(safe(r.title), M + lh * LOGO_RATIO + 5, 18);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(safe(r.subtitle), M + lh * LOGO_RATIO + 5, 23);
  doc.setDrawColor(...MAROON).setLineWidth(0.6).line(M, 26, W - M, 26);
}

function footer(doc: jsPDF, r: Report) {
  const n = doc.getNumberOfPages();
  const made = `Dibuat ${formatDateId(nowJakarta().slice(0, 10))} ${nowJakarta().slice(11, 16)} WIB · angka dari laporan yang sudah disetujui leader`;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, H - 10, W - M, H - 10);
    doc.text(safe(`PT. Takai Seiki Indonesia · ${r.title} · ${made}`), M, H - 6);
    doc.text(`Halaman ${i} dari ${n}`, W - M, H - 6, { align: "right" });
  }
}

/** Kartu angka utama: label, nilai besar, target + status berwarna di bawahnya. */
function kpiCards(doc: jsPDF, r: Report, y: number) {
  const kpis = r.kpis.slice(0, 6);
  if (!kpis.length) return y;
  const gap = 4;
  const w = (W - 2 * M - gap * (kpis.length - 1)) / kpis.length;
  const h = 24;
  kpis.forEach((k, i) => {
    const x = M + i * (w + gap);
    doc.setDrawColor(...LINE).setFillColor(255, 255, 255).setLineWidth(0.3).roundedRect(x, y, w, h, 2, 2, "FD");
    if (k.status) {
      doc.setFillColor(...(k.status === "good" ? GOOD : BAD)).rect(x, y + 2, 1.2, h - 4, "F");
    }
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(safe(k.label), x + 4, y + 5.5, { maxWidth: w - 6 });
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...INK);
    doc.text(safe(formatCell(k.value, k.format)), x + 4, y + 13.5);
    doc.setFont("helvetica", "normal").setFontSize(7);
    if (k.target) {
      const ok = k.status === "good";
      const label = k.status ? `${ok ? "Sesuai" : "Di luar"} target (${k.target})` : `Target ${k.target}`;
      doc.setTextColor(...(k.status ? (ok ? GOOD : BAD) : MUTED));
      doc.text(safe(label), x + 4, y + 18.5, { maxWidth: w - 6 });
      if (k.hint) {
        doc.setTextColor(...MUTED);
        doc.text(safe(k.hint), x + 4, y + 22, { maxWidth: w - 6 });
      }
    } else if (k.hint) {
      doc.setTextColor(...MUTED);
      doc.text(safe(k.hint), x + 4, y + 19, { maxWidth: w - 6 });
    }
  });
  return y + h + 6;
}

/** Grafik sederhana: batang (opsional garis kumulatif Pareto) atau garis. */
function drawChart(doc: jsPDF, c: Chart, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...LINE).setLineWidth(0.3).roundedRect(x, y, w, h, 2, 2, "S");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
  doc.text(safe(c.title), x + 4, y + 6);
  const s = c.series[0];
  const data = c.data.slice(0, 15);
  const vals = data.map((d) => Number(d[s.key]) || 0);
  const max = Math.max(...vals, 0) || 1;
  const px = x + 14;
  const py = y + 11;
  const pw = w - 22;
  const ph = h - 26;
  doc.setDrawColor(...LINE).setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = py + ph - (ph * i) / 4;
    doc.line(px, gy, px + pw, gy);
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
    doc.text(safe(formatCell((max * i) / 4, s.format === "pct" ? "pct" : s.format === "dec1" ? "dec1" : "int")), px - 1.5, gy + 1, { align: "right" });
  }
  const step = pw / Math.max(data.length, 1);
  const pts: [number, number][] = [];
  data.forEach((d, i) => {
    const v = vals[i];
    const cx = px + step * i + step / 2;
    const bh = (ph * v) / max;
    if (c.type === "line") pts.push([cx, py + ph - bh]);
    else {
      doc.setFillColor(...MAROON).rect(cx - step * 0.32, py + ph - bh, step * 0.64, bh, "F");
    }
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
    const lbl = safe(String(d[c.xKey] ?? ""));
    doc.text(lbl.length > 14 ? `${lbl.slice(0, 13)}.` : lbl, cx, py + ph + 3.5, { align: "center", maxWidth: step + 4 });
  });
  if (c.type === "line" && pts.length) {
    doc.setDrawColor(...MAROON).setLineWidth(0.6);
    for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    pts.forEach(([a, b]) => doc.setFillColor(...MAROON).circle(a, b, 0.8, "F"));
  }
  if (c.type === "pareto") {
    const cum = data.map((d, i) => [px + step * i + step / 2, py + ph - ph * (Number(d.cum) || 0)] as [number, number]);
    doc.setDrawColor(...PINK).setLineWidth(0.6);
    for (let i = 1; i < cum.length; i++) doc.line(cum[i - 1][0], cum[i - 1][1], cum[i][0], cum[i][1]);
    cum.forEach(([a, b]) => doc.setFillColor(...PINK).circle(a, b, 0.8, "F"));
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
    doc.text("100%", px + pw + 1, py + 1);
    doc.text("kumulatif", px + pw - 1, py - 1.5, { align: "right" });
  }
}

function charts(doc: jsPDF, r: Report, y: number) {
  const list = r.charts.filter((c) => c.data.length > 1).slice(0, 2);
  if (!list.length) return y;
  const h = 62;
  if (y + h > H - 16) {
    doc.addPage();
    kop(doc, r);
    y = TOP + 2;
  }
  const gap = 6;
  const w = list.length === 1 ? W - 2 * M : (W - 2 * M - gap) / 2;
  list.forEach((c, i) => drawChart(doc, c, M + i * (w + gap), y, w, h));
  return y + h + 6;
}

function table(doc: jsPDF, r: Report, t: Table, y: number) {
  const rows = t.detail ? t.rows.slice(0, DETAIL_ROWS) : t.rows;
  const all = t.total && t.rows.length ? [...rows, t.total] : rows;
  if (y > H - 40) {
    doc.addPage();
    kop(doc, r);
    y = TOP + 2;
  }
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...MAROON);
  doc.text(safe(t.title), M, y + 4);
  let start = y + 6.5;
  if (t.note) {
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(safe(t.note), M, y + 8.5, { maxWidth: W - 2 * M });
    start = y + 11;
  }
  const totalIdx = t.total && t.rows.length ? all.length - 1 : -1;
  autoTable(doc, {
    startY: start,
    margin: { left: M, right: M, top: TOP + 2, bottom: 14 },
    head: [t.columns.map((c) => safe(c.label))],
    body: all.length ? all.map((r) => t.columns.map((c) => safe(formatCell(r[c.key], c.format)))) : [[{ content: "Belum ada data di periode ini.", colSpan: t.columns.length, styles: { halign: "center", textColor: MUTED, fontStyle: "italic" } }]],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(t.columns.map((c, i) => [i, { halign: isNum(c.format) ? "right" : c.format === "grade" ? "center" : "left" }])),
    didParseCell: (d) => {
      if (d.section === "head") {
        const c = t.columns[d.column.index];
        d.cell.styles.halign = isNum(c?.format) ? "right" : c?.format === "grade" ? "center" : "left";
        return;
      }
      if (d.section !== "body") return;
      if (d.row.index === totalIdx) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [248, 232, 232];
        return;
      }
      const c = t.columns[d.column.index];
      const raw = String(d.cell.raw ?? "");
      if (d.column.index === 0) d.cell.styles.fontStyle = "bold";
      if (c?.format === "grade" && /^[A-D]$/.test(raw)) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = raw === "A" ? GOOD : raw === "D" ? BAD : raw === "C" ? [154, 52, 18] : INK;
      }
      if (c?.key === "status") {
        if (raw === "OK") Object.assign(d.cell.styles, { textColor: GOOD, fillColor: GOOD_BG, fontStyle: "bold" });
        else if (raw === "Di bawah target") Object.assign(d.cell.styles, { textColor: BAD, fillColor: BAD_BG, fontStyle: "bold" });
        else if (raw === "Tidak jalan") d.cell.styles.textColor = [148, 163, 184];
      }
    },
    willDrawPage: () => kop(doc, r),
  });
  let end = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  if (t.detail && t.rows.length > DETAIL_ROWS) {
    doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(`${t.rows.length - DETAIL_ROWS} baris lainnya ada di file Excel.`, M, end + 4);
    end += 4;
  }
  return end + 7;
}

function signBoxes(doc: jsPDF, r: Report, y: number) {
  const h = 30;
  if (y + h > H - 14) {
    doc.addPage();
    kop(doc, r);
    y = TOP + 2;
  }
  const w = 52;
  const gap = 5;
  const x0 = W - M - 3 * w - 2 * gap;
  ["Dibuat", "Diperiksa", "Disetujui"].forEach((p, i) => {
    const x = x0 + i * (w + gap);
    doc.setDrawColor(148, 163, 184).setLineWidth(0.3).rect(x, y, w, h);
    doc.setFillColor(248, 232, 232).rect(x, y, w, 6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK);
    doc.text(p, x + w / 2, y + 4.2, { align: "center" });
    doc.line(x, y + h - 6, x + w, y + h - 6);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
    doc.text("Nama / Tgl", x + 2, y + h - 2);
  });
  return y + h + 4;
}

export function reportToPdf(r: Report): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `${r.title} · ${r.subtitle}`, author: "PT. Takai Seiki Indonesia", creator: "QA Production" });
  kop(doc, r);
  let y = TOP + 2;
  y = kpiCards(doc, r, y);
  y = charts(doc, r, y);
  for (const t of r.tables) y = table(doc, r, t, y);
  signBoxes(doc, r, y);
  footer(doc, r);
  return Buffer.from(doc.output("arraybuffer"));
}
