import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDateId, nowJakarta } from "./dates";
import { formatCell } from "./format";
import { LOGO_PNG_BASE64, LOGO_RATIO } from "./logo";
import { monthShort, type MonthlyReport, type SectionReport } from "./monthly";

// Production Report bulanan dalam bentuk PDF: halaman 1 ringkasan semua section, lalu satu halaman per section
// dengan susunan seperti slide PPT lama: 1. Chart, 2. Daily Production, 3. Plan & Result, Notes.

type RGB = [number, number, number];
const MAROON: RGB = [155, 27, 31];
const INK: RGB = [30, 41, 59];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [203, 213, 225];
const PLAN: RGB = [112, 48, 160];
const RESULT: RGB = [146, 208, 80];
const RED: RGB = [192, 0, 0];
const GOOD: RGB = [6, 95, 70];

const W = 297;
const H = 210;
const M = 8;

const int = (v: number | null) => formatCell(v == null ? null : Math.round(v), "int");
const dec1 = (v: number | null) => formatCell(v, "dec1");
const pct = (v: number | null) => formatCell(v, "pct");
const neg = (v: number) => (v < 0 ? `(${int(-v)})` : int(v));

function kop(doc: jsPDF, r: MonthlyReport, section: string, pic: string) {
  const lh = 10;
  doc.addImage(LOGO_PNG_BASE64, "PNG", M, 6, lh * LOGO_RATIO, lh);
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...INK);
  doc.text("PRODUCTION REPORT", W / 2, 11, { align: "center" });
  doc.setFontSize(10).setTextColor(...MAROON);
  doc.text(`Periode ${r.label}`, W / 2, 17, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
  const x = W - M - 62;
  [
    ["PIC", pic || "-"],
    ["SECTION", section],
    ["DATE", formatDateId(nowJakarta().slice(0, 10))],
  ].forEach(([k, v], i) => {
    doc.text(k, x, 9 + i * 4.5);
    doc.text(`: ${v}`, x + 17, 9 + i * 4.5);
  });
  doc.setDrawColor(...MAROON).setLineWidth(0.6).line(M, 22, W - M, 22);
}

function footer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  const made = `Dibuat ${formatDateId(nowJakarta().slice(0, 10))} ${nowJakarta().slice(11, 16)} WIB · Result dari laporan yang sudah disetujui leader, Plan diisi leader`;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
    doc.text(`PT. Takai Seiki Indonesia · ${made}`, M, H - 4);
    doc.text(`Halaman ${i} dari ${n}`, W - M, H - 4, { align: "right" });
  }
}

function heading(doc: jsPDF, t: string, x: number, y: number) {
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...MAROON);
  doc.text(t, x, y);
}

/** Batang Daily Plan & Daily Result (sumbu kiri) + garis Total Plan & Total Result kumulatif (sumbu kanan). */
function chart(doc: jsPDF, s: SectionReport, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...LINE).setLineWidth(0.3).rect(x, y, w, h);
  const px = x + 15,
    py = y + 12,
    pw = w - 32,
    ph = h - 22;
  const d = s.daily;
  const maxBar = Math.max(1, ...d.map((r) => Math.max(r.plan, r.total)));
  const maxCum = Math.max(1, ...d.map((r) => Math.max(r.cumPlan, r.cumResult)));
  // legenda
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...INK);
  const leg: [string, RGB, "bar" | "dash" | "line"][] = [
    ["Daily Plan", PLAN, "bar"],
    ["Daily Result", RESULT, "bar"],
    ["Total Plan", PLAN, "dash"],
    ["Total Result", RESULT, "line"],
  ];
  leg.forEach(([t, c, k], i) => {
    const lx = x + 6 + i * 30;
    if (k === "bar") doc.setFillColor(...c).rect(lx, y + 3.3, 5, 2.2, "F");
    else {
      doc.setDrawColor(...c).setLineWidth(0.7);
      if (k === "dash") doc.setLineDashPattern([1, 0.8], 0);
      doc.line(lx, y + 4.4, lx + 5, y + 4.4);
      doc.setLineDashPattern([], 0);
    }
    doc.text(t, lx + 6.5, y + 5.3);
  });
  // grid + sumbu
  doc.setFontSize(5.5).setTextColor(...MUTED);
  for (let i = 0; i <= 4; i++) {
    const gy = py + ph - (ph * i) / 4;
    doc.setDrawColor(235, 238, 242).setLineWidth(0.2).line(px, gy, px + pw, gy);
    doc.text(int((maxBar * i) / 4), px - 1, gy + 0.8, { align: "right" });
    doc.text(int((maxCum * i) / 4), px + pw + 1, gy + 0.8);
  }
  const step = pw / d.length;
  const bw = Math.min(step * 0.36, 2.4);
  const pPts: [number, number][] = [];
  const rPts: [number, number][] = [];
  d.forEach((r, i) => {
    const cx = px + step * i + step / 2;
    if (r.plan > 0) doc.setFillColor(...PLAN).rect(cx - bw, py + ph - (ph * r.plan) / maxBar, bw, (ph * r.plan) / maxBar, "F");
    if (r.total > 0) doc.setFillColor(...RESULT).rect(cx, py + ph - (ph * r.total) / maxBar, bw, (ph * r.total) / maxBar, "F");
    pPts.push([cx, py + ph - (ph * r.cumPlan) / maxCum]);
    rPts.push([cx, py + ph - (ph * r.cumResult) / maxCum]);
    if (i % 2 === 0) {
      doc.setFontSize(5.2).setTextColor(...(r.work ? MUTED : RED));
      doc.text(String(r.day), cx, py + ph + 3, { align: "center" });
    }
  });
  const poly = (pts: [number, number][], c: RGB, dash: boolean) => {
    doc.setDrawColor(...c).setLineWidth(0.7);
    if (dash) doc.setLineDashPattern([1.2, 0.9], 0);
    for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    doc.setLineDashPattern([], 0);
  };
  if (s.hasPlan) poly(pPts, PLAN, true);
  poly(rPts, RESULT, false);
  // nilai akhir di kotak seperti di PPT
  const last = d[d.length - 1];
  const box = (v: number, c: RGB, by: number) => {
    const t = int(v);
    doc.setFont("helvetica", "bold").setFontSize(8);
    const tw = doc.getTextWidth(t) + 5;
    doc.setDrawColor(...c).setLineWidth(0.5).setFillColor(255, 255, 255).rect(px + 4, by, tw, 5.5, "FD");
    doc.setTextColor(...INK).text(t, px + 6.5, by + 4);
  };
  if (s.hasPlan) box(last.cumPlan, PLAN, py + 1);
  box(last.cumResult, RESULT, py + (s.hasPlan ? 8 : 1));
  doc.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...MUTED);
  doc.text("pcs/hari", x + 2, py - 2);
  doc.text("kumulatif", x + w - 2, py - 2, { align: "right" });
}

function planResult(doc: jsPDF, r: MonthlyReport, s: SectionReport, x: number, y: number, w: number) {
  const fmtv = (v: number | null, f: "int" | "dec1") => (f === "dec1" ? dec1(v) : int(v));
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: W - x - w },
    tableWidth: w,
    head: [
      [
        { content: "Description", rowSpan: 2, styles: { valign: "middle" } },
        { content: monthShort(r.month), colSpan: 3, styles: { halign: "center" } },
        { content: monthShort(r.nextMonth), colSpan: 3, styles: { halign: "center" } },
      ],
      ["Plan", "Result", "%", "Plan", "Result", "%"],
    ],
    body: s.lines.map((l) => [l.label, fmtv(l.plan, l.format), fmtv(l.result, l.format), pct(l.pct), fmtv(l.next, l.format), "-", "-"]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, textColor: INK, lineColor: LINE, lineWidth: 0.2, halign: "right" },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 38 } },
    didParseCell: (c) => {
      if (c.section === "body" && c.column.index === 3) {
        const v = s.lines[c.row.index].pct;
        if (v != null && c.row.index === 0) c.cell.styles.textColor = v >= 1 ? GOOD : RED;
      }
    },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function daily(doc: jsPDF, s: SectionReport, x: number, y: number, w: number) {
  const cols = s.columns;
  const many = cols.length > 4;
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: W - x - w, bottom: 8 },
    tableWidth: w,
    head: [
      [
        { content: "Date", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Daily Plan", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Daily Result", colSpan: cols.length + 1, styles: { halign: "center" } },
        { content: "Balance", rowSpan: 2, styles: { valign: "middle" } },
      ],
      [...cols, "Total"],
    ],
    body: [
      ...s.daily.map((r) => [`${r.day}-${monthShort(r.date.slice(0, 7)).slice(0, 3)}`, r.work ? int(r.plan) : "0", ...r.cols.map((v) => (v ? int(v) : "")), r.total ? int(r.total) : "-", neg(r.balance)]),
      ["Total", int(s.total.plan), ...s.total.cols.map((v) => int(v)), int(s.total.total), neg(s.total.balance)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: many ? 5.2 : 6, cellPadding: { top: 0.75, bottom: 0.75, left: 0.8, right: 0.8 }, textColor: INK, lineColor: LINE, lineWidth: 0.15, halign: "right", overflow: "ellipsize" },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", valign: "middle", fontSize: many ? 5 : 6 },
    columnStyles: { 0: { halign: "center", cellWidth: 11 } },
    didParseCell: (c) => {
      if (c.section !== "body") return;
      const last = c.row.index === s.daily.length;
      if (last) {
        c.cell.styles.fontStyle = "bold";
        c.cell.styles.fillColor = [248, 232, 232];
        return;
      }
      const r = s.daily[c.row.index];
      if (c.column.index === 0 && !r.work) c.cell.styles.textColor = RED;
      if (!r.work) c.cell.styles.fillColor = [248, 250, 252];
      if (c.column.index === cols.length + 3 && r.balance < 0) c.cell.styles.textColor = RED;
    },
  });
}

function sectionPage(doc: jsPDF, r: MonthlyReport, s: SectionReport) {
  kop(doc, r, s.def.name, s.pic);
  const lw = 150;
  heading(doc, "1. Chart", M, 28);
  chart(doc, s, M, 30, lw, 82);
  heading(doc, "3. Plan & Result", M, 119);
  const end = planResult(doc, r, s, M, 121, lw);
  heading(doc, "Notes:", M, end + 6);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...INK);
  const note = s.note || (s.hasPlan ? "-" : "Plan bulan ini belum diisi leader.");
  doc.text(doc.splitTextToSize(note, lw).slice(0, 6), M, end + 10.5);
  const rx = M + lw + 6;
  heading(doc, "2. Daily Production", rx, 28);
  daily(doc, s, rx, 30, W - M - rx);
}

function summaryPage(doc: jsPDF, r: MonthlyReport) {
  kop(doc, r, "Semua section", "");
  heading(doc, `Ringkasan Plan vs Result · ${r.label}`, M, 30);
  autoTable(doc, {
    startY: 33,
    margin: { left: M, right: M },
    head: [["Section", "Plan", "Result", "%", "Balance", "Member/MC (Plan)", "Member/MC (Result)", "Productivity Plan", "Productivity Result", `Plan ${r.nextLabel}`, "PIC"]],
    body: r.sections.map((s) => {
      const l = (i: number) => s.lines[i];
      return [
        s.def.name,
        int(l(0).plan),
        int(l(0).result),
        pct(l(0).pct),
        s.hasPlan ? neg(s.total.balance) : "-",
        int(l(4).plan),
        int(l(4).result),
        int(l(5).plan),
        int(l(5).result),
        int(l(0).next),
        s.pic || "-",
      ];
    }),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.2, halign: "right" },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", valign: "middle" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 10: { halign: "left" } },
    didParseCell: (c) => {
      if (c.section === "body" && c.column.index === 3) {
        const v = r.sections[c.row.index].lines[0].pct;
        if (v != null) c.cell.styles.textColor = v >= 1 ? GOOD : RED;
      }
    },
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize(
      "Productivity = pcs per jam per member (Senbetsu/Seiretsu) atau per mesin (PF). Time Required = Production / (Productivity x Member/MC). Need Over Time = Time Required - Time Normal. Result Member = member yang lapor di section itu; Result MC = mesin yang jalan.",
      W - 2 * M,
    ),
    M,
    y,
  );
  const w = 52,
    gap = 5,
    by = y + 14,
    x0 = W - M - 3 * w - 2 * gap;
  ["Dibuat", "Diperiksa", "Disetujui"].forEach((p, i) => {
    const x = x0 + i * (w + gap);
    doc.setDrawColor(148, 163, 184).setLineWidth(0.3).rect(x, by, w, 30);
    doc.setFillColor(248, 232, 232).rect(x, by, w, 6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK);
    doc.text(p, x + w / 2, by + 4.2, { align: "center" });
  });
}

/** 4. Detail per Part & Kualitas: semua section bertumpuk, 10 part terbesar per section. */
function partsPages(doc: jsPDF, r: MonthlyReport) {
  doc.addPage();
  kop(doc, r, "Detail per part", "");
  let y = 30;
  for (const s of r.sections) {
    if (y > H - 40) {
      doc.addPage();
      kop(doc, r, "Detail per part", "");
      y = 30;
    }
    heading(doc, `4. ${s.def.name} · per part & kualitas`, M, y);
    const q = s.quality;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    const top = q.top.slice(0, 3).map((t) => `${t.name} ${int(t.qty)} (${pct(t.share)})`).join(", ");
    doc.text(`Total OK ${int(q.qty)} pcs · NG ${int(q.ng)} pcs · NG rate ${pct(q.rate)}${top ? ` · NG terbanyak: ${top}` : ""}`, M, y + 4, { maxWidth: W - 2 * M });
    const rows = s.parts.slice(0, 10);
    const rest = s.parts.slice(10);
    const body = rows.map((p) => [p.part, p.category, int(p.qty), pct(p.share), p.qtyOt ? int(p.qtyOt) : "-", p.ng ? int(p.ng) : "-", pct(p.rate), p.topNg || "-"]);
    if (rest.length) {
      const qty = rest.reduce((a, p) => a + p.qty, 0);
      const ng = rest.reduce((a, p) => a + p.ng, 0);
      body.push([`${rest.length} part lainnya`, "", int(qty), pct(q.qty ? qty / q.qty : null), "", int(ng), pct(qty + ng ? ng / (qty + ng) : null), ""]);
    }
    autoTable(doc, {
      startY: y + 6,
      margin: { left: M, right: M, top: 28, bottom: 10 },
      head: [["Part", "Kategori", "Result (pcs)", "Porsi", "OT (pcs)", "NG (pcs)", "NG rate", "NG terbanyak"]],
      body: body.length ? body : [[{ content: "Belum ada data bulan ini.", colSpan: 8, styles: { halign: "center", textColor: MUTED, fontStyle: "italic" } }]],
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.1, textColor: INK, lineColor: LINE, lineWidth: 0.15, halign: "right" },
      headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "left" }, 7: { halign: "left" } },
      willDrawPage: (d) => {
        if (d.pageNumber > 1) kop(doc, r, "Detail per part", "");
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
}

export function monthlyToPdf(r: MonthlyReport): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `Production Report ${r.label}`, author: "PT. Takai Seiki Indonesia", creator: "QA Production" });
  summaryPage(doc, r);
  for (const s of r.sections) {
    doc.addPage();
    sectionPage(doc, r, s);
  }
  partsPages(doc, r);
  footer(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
