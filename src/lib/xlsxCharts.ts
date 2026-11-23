import JSZip from "jszip";

// ExcelJS belum bisa membuat grafik. Modul ini menambahkan grafik Excel asli (line / bar kolom)
// ke file .xlsx yang sudah ditulis ExcelJS, dengan menulis bagian drawing + chart ke dalam zip.
// Data grafik berupa referensi sel (mis. 'NG Rate 2026'!$B$7:$M$7), jadi grafik ikut berubah
// bila angka di sheet dikoreksi manual.

export type ChartSeries = {
  name: string;
  /** Referensi nilai, mis. "'NG Rate 2026'!$B$7:$M$7" atau gabungan "('S'!$D$25:$D$50,'S'!$L$25:$L$46)". */
  ref: string;
  color: string; // RRGGBB
  dash?: boolean;
  /** Tampilkan angka di titik / batang. */
  labels?: boolean;
};
export type ChartSpec = {
  sheet: string;
  type: "line" | "bar";
  title: string;
  /** Kategori (sumbu X). */
  cats: string;
  series: ChartSeries[];
  /** Posisi: kolom & baris 0-based seperti xdr:from / xdr:to. */
  from: { col: number; row: number };
  to: { col: number; row: number };
  /** Format angka sumbu Y, mis. "0.00%". */
  numFmt?: string;
  yMin?: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function chartXml(c: ChartSpec) {
  const fmt = esc(c.numFmt ?? "General");
  const ser = c.series
    .map((s, i) => {
      const ln = `<a:ln w="${c.type === "line" ? 28575 : 9525}"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${s.dash ? '<a:prstDash val="dash"/>' : ""}</a:ln>`;
      const sp = c.type === "line" ? `<c:spPr>${ln}</c:spPr>` : `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${ln}</c:spPr>`;
      const marker =
        c.type === "line"
          ? s.dash
            ? `<c:marker><c:symbol val="none"/></c:marker>`
            : `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr></c:marker>`
          : "";
      const lbl = s.labels
        ? `<c:dLbls><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="700"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
        : `<c:dLbls><c:delete val="1"/></c:dLbls>`;
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${sp}${marker}${c.type === "bar" ? '<c:invertIfNegative val="0"/>' : ""}${lbl}<c:cat><c:strRef><c:f>${esc(c.cats)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(s.ref)}</c:f></c:numRef></c:val>${c.type === "line" ? '<c:smooth val="0"/>' : ""}</c:ser>`;
    })
    .join("");
  const body =
    c.type === "line"
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/><c:axId val="1001"/><c:axId val="1002"/></c:lineChart>`
      : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}<c:gapWidth val="80"/><c:axId val="1001"/><c:axId val="1002"/></c:barChart>`;
  const txt = (sz: number) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
  const catAx = `<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln></c:spPr>${txt(800)}<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/>${c.yMin != null ? `<c:min val="${c.yMin}"/>` : ""}</c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln></c:spPr>${txt(800)}<c:crossAx val="1001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:date1904 val="0"/><c:lang val="en-US"/><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1100" b="1"/><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${body}${catAx}${valAx}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/>${txt(800)}</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}

function anchorXml(c: ChartSpec, i: number) {
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DRAWING_T = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CHART_T = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";

/** Tambahkan grafik ke file xlsx (hasil ExcelJS). Sheet yang sudah punya drawing tidak didukung. */
export async function addCharts(buf: Buffer | Uint8Array, charts: ChartSpec[]): Promise<Buffer> {
  if (!charts.length) return Buffer.from(buf);
  const zip = await JSZip.loadAsync(buf);
  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? null;
  const wbXml = (await read("xl/workbook.xml"))!;
  const wbRels = (await read("xl/_rels/workbook.xml.rels"))!;
  let types = (await read("[Content_Types].xml"))!;
  const sheetPath = (name: string) => {
    const m = new RegExp(`<sheet [^>]*name="${esc(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*r:id="([^"]+)"`).exec(wbXml);
    if (!m) throw new Error(`Sheet ${name} tidak ada`);
    const t = new RegExp(`<Relationship [^>]*Id="${m[1]}"[^>]*Target="([^"]+)"`).exec(wbRels) ?? new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${m[1]}"`).exec(wbRels);
    return "xl/" + t![1].replace(/^\/?xl\//, "");
  };
  const bySheet = new Map<string, ChartSpec[]>();
  for (const c of charts) bySheet.set(c.sheet, [...(bySheet.get(c.sheet) ?? []), c]);

  let chartNo = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f)).length;
  let drawNo = Object.keys(zip.files).filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f)).length;
  for (const [sheet, list] of bySheet) {
    const sp = sheetPath(sheet);
    const relPath = sp.replace(/worksheets\/(sheet\d+\.xml)$/, "worksheets/_rels/$1.rels");
    let sheetXml = (await read(sp))!;
    if (sheetXml.includes("<drawing ")) throw new Error(`Sheet ${sheet} sudah punya drawing`);
    const dNo = ++drawNo;
    const drawRels: string[] = [];
    const anchors: string[] = [];
    list.forEach((c, i) => {
      const n = ++chartNo;
      zip.file(`xl/charts/chart${n}.xml`, chartXml(c));
      types = types.replace("</Types>", `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      drawRels.push(`<Relationship Id="rId${i + 1}" Type="${CHART_T}" Target="../charts/chart${n}.xml"/>`);
      anchors.push(anchorXml(c, i));
    });
    zip.file(
      `xl/drawings/drawing${dNo}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join("")}</xdr:wsDr>`,
    );
    zip.file(`xl/drawings/_rels/drawing${dNo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}">${drawRels.join("")}</Relationships>`);
    types = types.replace("</Types>", `<Override PartName="/xl/drawings/drawing${dNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);

    let rels = (await read(relPath)) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"></Relationships>`;
    const rid = `rIdChart${dNo}`;
    rels = rels.replace("</Relationships>", `<Relationship Id="${rid}" Type="${DRAWING_T}" Target="../drawings/drawing${dNo}.xml"/></Relationships>`);
    zip.file(relPath, rels);
    // <drawing> harus sebelum legacyDrawing / tableParts / extLst (urutan skema).
    const tag = `<drawing r:id="${rid}"/>`;
    const at = ["<legacyDrawing", "<legacyDrawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst", "</worksheet>"].map((t) => sheetXml.indexOf(t)).filter((i) => i >= 0);
    const pos = Math.min(...at);
    sheetXml = sheetXml.slice(0, pos) + tag + sheetXml.slice(pos);
    if (!/xmlns:r=/.test(sheetXml.slice(0, sheetXml.indexOf(">", sheetXml.indexOf("<worksheet")))))
      sheetXml = sheetXml.replace("<worksheet ", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    zip.file(sp, sheetXml);
  }
  zip.file("[Content_Types].xml", types);
  return Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
}
