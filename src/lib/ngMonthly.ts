// Laporan NG bulanan format QC (template "Laporan NG.xlsx" dari Pak Anton):
// sheet 1 "QC Result" = per part, D1/D2, lot: Total Before Senbetsu, Total After, 10 jenis NG, total, persen.
// sheet 2 "Produk Jatuh" = NG "9. Part jatuh" per part & D1/D2, dipecah per proses.
// Aturan (disepakati 23 Nov 2026):
//  - Qty hanya dari laporan kategori proses Senbetsu.
//  - NG dari SEMUA proses (Seiretsu, PF, Drum PF, Senbetsu) untuk part + D1/D2 + lot yang sama.
//  - Total After Senbetsu = hasil laporan Senbetsu; Total Before = After + Total NG; Percentage = NG / After.
//  - Urutan part & D1/D2 mengikuti template (semua part template tetap tampil), tiap type 10 baris lot di Excel.
//  - Jenis NG dipetakan menurut nomor kode (NG1..NG10 = kolom 1..10; grup plastik = kolom 11..20).
//  - Press JAPAN = lot diawali 01, Press INDONESIA (PT) = lot diawali 31 atau 33.
//  - Part jatuh = NG nomor 9 (grup Iron Cage), masuk di kedua sheet.
import { loadFacts, type Fact } from "./reports";
import { monthEnd } from "./dates";
import type { MasterData } from "./types";

export const IRON_NG = ["1.Tercampur part lain", "2.Press tidak sempurna", "3.Pitchzure", "4.Dokking", "5.Kizu / Scratch", "6.Henkei", "7.Karat", "8.Material kasar", "9.Part jatuh", "10.Lain - lain"];
export const IRON_NG_JA = ["（混入）", "（加工不良）", "（加工不良）", "（ドッキング）", "（傷）", "（変形）", "（錆び）", "（粗い素材）", "（落下品）", "（他の）"];
export const PLASTIC_NG = ["11.Shooto (short)", "12.Kureta", "13.Kizu / Scratch", "14.Black Spot", "15.Bari", "16.Hike", "17.Yake", "18.Weldline", "19.Yogore (Kotor)", "20.Lain - lain"];
export const JATUH_PROC = ["Press", "Molding", "Barrel", "Seiretsu / PF Iron", "Senbetsu Iron", "Seiretsu / PF Plastik", "Senbetsu Plastik", "Washing"] as const;
/** Indeks NG "Part jatuh" di grup Iron Cage (kode 9). */
export const JATUH_IDX = 8;

/** noSenbetsu: lot belum ada di laporan Senbetsu, Before diisi = total NG (100%) seperti template. */
/** after = hasil laporan Senbetsu (null bila lot belum disenbetsu). Before = after + total NG (rumus template). */
/** Daftar part & type persis urutan template (Laporan NG.xlsx). */
const T = (names: string, types = ["D1", "D2"]) => names.split(",").flatMap((n) => types.map((t) => [n.trim(), t] as [string, string]));
export const TEMPLATE_PARTS: Record<"JPN" | "PT" | "PLASTIC" | "JATUH", [string, string][]> = {
  JPN: T("625-H,626-BH,688-AH,695JC-H,626-J,627-J,627-H,628-J,629-J,6800-J,6900-J,6901-J,6902-J,6903-J,698-J,6803-J,608-JCL,6802-H,6801-J,6802 KDC-J"),
  PT: [...T("625-H,688A-H,627-J"), ["629-J", "D1"], ["629-J", "D2"], ["629-J", "D2 NC"]],
  PLASTIC: T(
    "696T12ZZ,P 608 T,6900TIX,626T1X,695 T12,684T12L,698 T1X,608 T1X,629 T1X,6902 T1X,6800 T1X,B10-100T1X-1,608 - X3,608 TT,W 688,608-X1,EWC0606X,EWC0608X,ML 5009,6000FG,6700,696-2-X2,698,W693-X3,0826 6140-12B2,6801,604,605-4,S8030,629T85,624",
    [""],
  ),
  JATUH: T("625-H,626-BH,688-AH,695JC-H,626-J,627-J,627-H,628-J,629-J,6800-J,6900-J,6901-J,6902-J,6903-J,698-J,6803-J,608-JCL,6802-H,6801-J,6802 KDC-J"),
};
/** Nama part dibandingkan tanpa spasi/strip; beberapa nama Master Data beda tulisan dengan template. */
const ALIAS: Record<string, string> = { "608JCL1J": "608JCL", "695H": "695JCH", "695AH": "695JCH", ML50095: "ML5009" };
export function partKey(name: string) {
  const k = name.toUpperCase().replace(/[\s\-]/g, "").replace(/TIX/g, "T1X");
  return ALIAS[k] ?? k;
}
/** "629-J NC" type D2 di Master Data = part 629-J type "D2 NC" di template. */
export function splitNc(name: string, type: string) {
  const m = /^(.*?)\s+NC$/i.exec(name.trim());
  return m ? { name: m[1], type: `${type} NC`.trim() } : { name, type };
}

export type NgLotRow = { lot: string; after: number | null; ng: number[] };
export type NgTypeBlock = { type: string; lots: NgLotRow[] };
export type NgPartBlock = { part: string; types: NgTypeBlock[] };
export type NgSection = { title: string; plastic: boolean; parts: NgPartBlock[] };
export type JatuhRow = { part: string; type: string; before: number; proc: number[] };
export type JatuhSection = { title: string; plastic: boolean; rows: JatuhRow[] };
/** jatuhProd = total qty laporan per kolom proses Produk Jatuh (untuk persen jatuh per section). */
export type NgMonthly = { month: string; from: string; to: string; qc: NgSection[]; jatuh: JatuhSection[]; jatuhProd: number[] };

const isPlastic = (f: Pick<Fact, "categoryName">) => /plastik|plastic/i.test(f.categoryName);

/** Kelompok press menurut nomor lot material. */
export function pressOf(lot: string): "JPN" | "PT" | "LAIN" {
  const l = lot.trim();
  if (l.startsWith("01")) return "JPN";
  if (l.startsWith("31") || l.startsWith("33")) return "PT";
  return "LAIN";
}

/** Kolom proses di sheet Produk Jatuh untuk satu kategori. */
export function jatuhProcOf(categoryName: string, process: string): number {
  const s = `${categoryName} ${process}`.toLowerCase();
  const plastic = /plastik|plastic/.test(s);
  if (/press/.test(s)) return 0;
  if (/molding/.test(s)) return 1;
  if (/barrel/.test(s)) return 2;
  if (/washing/.test(s)) return 7;
  if (/senbetsu/.test(s)) return plastic ? 6 : 4;
  return plastic ? 5 : 3;
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function buildNgMonthlyFrom(master: MasterData, month: string, facts: Fact[]): NgMonthly {
  const from = `${month}-01`;
  const to = monthEnd(from);
  const procOfCat = new Map(master.categories.map((c) => [c.name, c.process]));
  const isSenbetsu = (f: Fact) => /senbetsu/i.test(procOfCat.get(f.categoryName) || f.categoryName);
  // Urutan part mengikuti Master Data (nama part pertama kali muncul).
  const order = new Map<string, number>();
  master.parts.forEach((p, i) => !order.has(p.name) && order.set(p.name, i));
  const partName = (f: Fact) => {
    const p = master.parts.find((x) => x.id === f.partId);
    return splitNc(p?.name ?? f.part, p && p.type && p.type !== "-" ? p.type : "");
  };
  const byOrder = (a: string, b: string) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b);

  // ---- QC Result: kunci section|part|type|lot
  type Acc = { section: string; part: string; type: string; lot: string; after: number; sen: boolean; ng: number[] };
  const acc = new Map<string, Acc>();
  for (const f of facts) {
    const plastic = isPlastic(f);
    const { name, type } = partName(f);
    const section = plastic ? "PLASTIC" : pressOf(f.lot);
    const lot = f.lot === "(tanpa lot)" ? "" : f.lot;
    const k = `${section}|${partKey(name)}|${type}|${lot}`;
    const e = acc.get(k) ?? { section, part: name, type, lot, after: 0, sen: false, ng: Array(10).fill(0) };
    if (isSenbetsu(f)) (e.after += f.qty), (e.sen = true);
    f.ng.forEach((n, i) => (e.ng[i] += n));
    acc.set(k, e);
  }
  const SECTIONS: [keyof typeof TEMPLATE_PARTS | "LAIN", string, boolean][] = [
    ["JPN", "CAGE BEARING PRESS JAPAN", false],
    ["PT", "CAGE BEARING PRESS INDONESIA", false],
    ["LAIN", "CAGE BEARING (LOT LAIN)", false],
    ["PLASTIC", "PLASTIC", true],
  ];
  const qc: NgSection[] = [];
  for (const [key, title, plastic] of SECTIONS) {
    const rows = [...acc.values()].filter((e) => e.section === key && (e.sen || sum(e.ng) > 0));
    if (!rows.length && key === "LAIN") continue;
    const tpl = key === "LAIN" ? [] : TEMPLATE_PARTS[key];
    // Part template dulu (urutan template, walau kosong), lalu part lain yang ada datanya.
    const parts: NgPartBlock[] = [];
    const block = (k: string, label: string) => {
      let p = parts.find((x) => partKey(x.part) === k);
      if (!p) parts.push((p = { part: label, types: [] }));
      return p;
    };
    const typeOf = (p: NgPartBlock, t: string) => {
      let b = p.types.find((x) => x.type === t);
      if (!b) p.types.push((b = { type: t, lots: [] }));
      return b;
    };
    for (const [n, t] of tpl) typeOf(block(partKey(n), n), t);
    const extra = rows.filter((r) => !tpl.some(([n]) => partKey(n) === partKey(r.part)));
    for (const r of [...rows.filter((x) => !extra.includes(x)), ...extra.sort((a, b) => byOrder(a.part, b.part) || a.type.localeCompare(b.type))])
      typeOf(block(partKey(r.part), r.part), r.type).lots.push({ lot: r.lot, after: r.sen ? r.after : null, ng: r.ng });
    for (const p of parts) for (const t of p.types) t.lots.sort((a, b) => a.lot.localeCompare(b.lot));
    qc.push({ title, plastic, parts });
  }

  // ---- Produk Jatuh: per part|type, semua press digabung.
  type JAcc = JatuhRow & { plastic: boolean };
  const jacc = new Map<string, JAcc>();
  const jatuhProd = Array(JATUH_PROC.length).fill(0) as number[];
  for (const f of facts) {
    jatuhProd[jatuhProcOf(f.categoryName, procOfCat.get(f.categoryName) ?? "")] += f.qty;
    const plastic = isPlastic(f);
    const pn = partName(f);
    const name = pn.name;
    // Template Produk Jatuh hanya D1/D2: 629-J NC digabung ke D2.
    const type = pn.type.replace(/\s*NC$/i, "");
    const k = `${plastic ? "P" : "I"}|${partKey(name)}|${type}`;
    const e = jacc.get(k) ?? { part: name, type, before: 0, proc: Array(JATUH_PROC.length).fill(0), plastic };
    if (isSenbetsu(f)) e.before += f.qty;
    // Kode 9 = Part jatuh hanya ada di grup Iron Cage.
    if (!plastic) e.proc[jatuhProcOf(f.categoryName, procOfCat.get(f.categoryName) ?? "")] += f.ng[JATUH_IDX] || 0;
    jacc.set(k, e);
  }
  const jatuh: JatuhSection[] = [false, true].map((plastic) => {
    const tpl = plastic ? TEMPLATE_PARTS.PLASTIC : TEMPLATE_PARTS.JATUH;
    const data = [...jacc.values()].filter((e) => e.plastic === plastic && (e.before > 0 || sum(e.proc) > 0));
    const take = (n: string, t: string) => {
      const i = data.findIndex((e) => partKey(e.part) === partKey(n) && e.type === t);
      return i >= 0 ? data.splice(i, 1)[0] : null;
    };
    const rows: JatuhRow[] = tpl.map(([n, t]) => {
      const e = take(n, t);
      return { part: n, type: t, before: e?.before ?? 0, proc: e?.proc ?? Array(JATUH_PROC.length).fill(0) };
    });
    // Part / type yang tidak ada di template ditaruh setelah part yang sama, atau di akhir.
    for (const e of data.sort((a, b) => byOrder(a.part, b.part) || a.type.localeCompare(b.type))) {
      const r = { part: e.part, type: e.type, before: e.before, proc: e.proc };
      let at = -1;
      rows.forEach((x, i) => partKey(x.part) === partKey(e.part) && (at = i));
      if (at >= 0) rows.splice(at + 1, 0, { ...r, part: rows[at].part });
      else rows.push(r);
    }
    return { title: plastic ? "PLASTIC" : "CAGE BEARING PRESS", plastic, rows };
  });
  return { month, from, to, qc, jatuh, jatuhProd };
}

export async function buildNgMonthly(master: MasterData, month: string): Promise<NgMonthly> {
  const from = `${month}-01`;
  const { facts } = await loadFacts(master, from, monthEnd(from));
  return buildNgMonthlyFrom(master, month, facts);
}

/** Total satu section QC Result: after = hasil Senbetsu, before = after + NG. */
export function sectionTotals(s: NgSection) {
  let after = 0;
  const ng = Array(10).fill(0) as number[];
  for (const p of s.parts) for (const t of p.types) for (const l of t.lots) (after += l.after ?? 0), l.ng.forEach((n, i) => (ng[i] += n));
  const total = sum(ng);
  return { after, before: after + total, ng, total };
}
