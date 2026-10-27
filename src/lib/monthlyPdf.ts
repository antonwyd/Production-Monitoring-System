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
const PLAN: RGB = [100, 116, 139];
const SOFT: RGB = [232, 165, 167];
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

/** Nilai sumbu yang enak dibaca: 0, 250 rb, 500 rb, ... */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k * p >= v)!;
  return m * p;
}
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1e3 ? `${Math.round(v / 1e3)} rb` : String(Math.round(v)));

/** Dua panel: atas kumulatif Result (area) vs Plan (garis putus), bawah result harian (merah tua = capai plan). */
function chart(doc: jsPDF, s: SectionReport, x: number, y: number, w: number, h: number) {
  const d = s.daily;
  const last = d[d.length - 1];
  doc.setDrawColor(...LINE).setLineWidth(0.25).roundedRect(x, y, w, h, 1.5, 1.5, "S");

  // angka utama
  const pctv = s.hasPlan && last.cumPlan ? last.cumResult / last.cumPlan : null;
  const kp: [string, string, RGB][] = [
    ["Result", int(last.cumResult), INK],
    ["Plan", s.hasPlan ? int(last.cumPlan) : "-", INK],
    ["Pencapaian", pct(pctv), pctv == null ? INK : pctv >= 1 ? GOOD : RED],
    ["Selisih", s.hasPlan ? neg(last.cumResult - last.cumPlan) : "-", pctv == null ? INK : pctv >= 1 ? GOOD : RED],
  ];
  const kw = (w - 8) / 4;
  kp.forEach(([k, v, c], i) => {
    const kx = x + 4 + i * kw;
    doc.setFillColor(248, 250, 252).roundedRect(kx, y + 3, kw - 2, 10, 1, 1, "F");
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED).text(k, kx + 2, y + 6.3);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...c).text(v, kx + 2, y + 11.2);
  });

  const px = x + 13,
    pw = w - 17;
  const step = pw / d.length;
  const axisY = (top: number, ph: number, max: number, label: string) => {
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...INK).text(label, x + 4, top - 1.5);
    doc.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...MUTED);
    for (let i = 0; i <= 4; i++) {
      const gy = top + ph - (ph * i) / 4;
      doc.setDrawColor(235, 238, 242).setLineWidth(0.15).line(px, gy, px + pw, gy);
      doc.text(short((max * i) / 4), px - 1, gy + 0.8, { align: "right" });
    }
  };
  const xLabels = (base: number) => {
    doc.setFontSize(5.2);
    d.forEach((r, i) => {
      if (i % 3 !== 0) return;
      doc.setTextColor(...(r.work ? MUTED : RED)).text(String(r.day), px + step * i + step / 2, base + 3, { align: "center" });
    });
  };

  // Panel 1: kumulatif
  const t1 = y + 19,
    h1 = (h - 32) * 0.58;
  const max1 = niceMax(Math.max(last.cumResult, s.hasPlan ? last.cumPlan : 0));
  axisY(t1, h1, max1, "Kumulatif");
  const cx = (i: number) => px + step * i + step / 2;
  const cy = (v: number) => t1 + h1 - (h1 * v) / max1;
  // area result
  const pts = d.map((r, i) => [cx(i), cy(r.cumResult)] as [number, number]);
  const gs = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  doc.saveGraphicsState();
  (doc as unknown as { setGState: (g: unknown) => void }).setGState(new gs({ opacity: 0.14 }));
  doc.setFillColor(...MAROON);
  const lines = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.lines([...lines, [0, t1 + h1 - pts[pts.length - 1][1]], [pts[0][0] - pts[pts.length - 1][0], 0], [0, pts[0][1] - (t1 + h1)]], pts[0][0], pts[0][1], [1, 1], "F", true);
  doc.restoreGraphicsState();
  doc.setDrawColor(...MAROON).setLineWidth(0.8);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  if (s.hasPlan) {
    doc.setDrawColor(...PLAN).setLineWidth(0.5).setLineDashPattern([1.4, 1], 0);
    for (let i = 1; i < d.length; i++) doc.line(cx(i - 1), cy(d[i - 1].cumPlan), cx(i), cy(d[i].cumPlan));
    doc.setLineDashPattern([], 0);
  }
  xLabels(t1 + h1);

  // Panel 2: harian
  const t2 = t1 + h1 + 9,
    h2 = y + h - 5 - t2;
  const max2 = niceMax(Math.max(1, ...d.map((r) => Math.max(r.total, r.plan))));
  axisY(t2, h2, max2, "Harian");
  const bw = Math.min(step * 0.62, 3);
  d.forEach((r, i) => {
    if (!r.total) return;
    const bh = (h2 * r.total) / max2;
    doc.setFillColor(...(!s.hasPlan || !r.plan || r.total >= r.plan ? MAROON : SOFT)).rect(cx(i) - bw / 2, t2 + h2 - bh, bw, bh, "F");
  });
  if (s.hasPlan) {
    doc.setDrawColor(...PLAN).setLineWidth(0.4).setLineDashPattern([1, 0.8], 0);
    d.forEach((r, i) => r.plan && doc.line(cx(i) - step / 2, t2 + h2 - (h2 * r.plan) / max2, cx(i) + step / 2, t2 + h2 - (h2 * r.plan) / max2));
    doc.setLineDashPattern([], 0);
  }
  xLabels(t2 + h2);

  // legenda
  const leg: [string, RGB, "bar" | "dash"][] = s.hasPlan
    ? [
        ["Result", MAROON, "bar"],
        ["Di bawah plan harian", SOFT, "bar"],
        ["Plan", PLAN, "dash"],
      ]
    : [["Result", MAROON, "bar"]];
  let lx = x + w - 4;
  doc.setFont("helvetica", "normal").setFontSize(6);
  [...leg].reverse().forEach(([t, c, k]) => {
    lx -= doc.getTextWidth(t) + 7;
    if (k === "bar") doc.setFillColor(...c).rect(lx, t1 - 3.6, 3, 2.2, "F");
    else {
      doc.setDrawColor(...c).setLineWidth(0.5).setLineDashPattern([1, 0.7], 0).line(lx, t1 - 2.5, lx + 4, t1 - 2.5);
      doc.setLineDashPattern([], 0);
    }
    doc.setTextColor(...MUTED).text(t, lx + 5, t1 - 1.6);
  });
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
