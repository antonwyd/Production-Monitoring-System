// Laporan NG bulanan format QC (template "Laporan NG.xlsx" dari Pak Anton):
// sheet 1 "QC Result" = per part, D1/D2, lot: Total Before Senbetsu, Total After, 10 jenis NG, total, persen.
// sheet 2 "Produk Jatuh" = NG "9. Part jatuh" per part & D1/D2, dipecah per proses.
// Aturan (disepakati 23 Nov 2026):
//  - Qty (Total Before Senbetsu) hanya dari laporan kategori proses Senbetsu.
//  - NG dari SEMUA proses (Seiretsu, PF, Drum PF, Senbetsu) untuk part + D1/D2 + lot yang sama.
//  - Total After = Before − Total NG. Lot tanpa laporan Senbetsu: Before = total NG, After kosong (100%).
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
export type NgLotRow = { lot: string; before: number; ng: number[]; noSenbetsu?: boolean };
export type NgTypeBlock = { type: string; lots: NgLotRow[] };
export type NgPartBlock = { part: string; types: NgTypeBlock[] };
export type NgSection = { title: string; plastic: boolean; parts: NgPartBlock[] };
export type JatuhRow = { part: string; type: string; before: number; proc: number[] };
export type JatuhSection = { title: string; plastic: boolean; rows: JatuhRow[] };
export type NgMonthly = { month: string; from: string; to: string; qc: NgSection[]; jatuh: JatuhSection[] };

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
    return { name: p?.name ?? f.part, type: p && p.type && p.type !== "-" ? p.type : "" };
  };
  const byOrder = (a: string, b: string) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b);

  // ---- QC Result: kunci section|part|type|lot
  type Acc = { section: string; plastic: boolean; part: string; type: string; lot: string; before: number; ng: number[] };
  const acc = new Map<string, Acc>();
  for (const f of facts) {
    const plastic = isPlastic(f);
    const { name, type } = partName(f);
    const section = plastic ? "PLASTIC" : pressOf(f.lot);
    const lot = f.lot === "(tanpa lot)" ? "" : f.lot;
    const k = `${section}|${name}|${type}|${lot}`;
    const e = acc.get(k) ?? { section, plastic, part: name, type, lot, before: 0, ng: Array(10).fill(0) };
    if (isSenbetsu(f)) e.before += f.qty;
    f.ng.forEach((n, i) => (e.ng[i] += n));
    acc.set(k, e);
  }
  const SECTIONS: [string, string, boolean][] = [
    ["JPN", "CAGE BEARING PRESS JAPAN", false],
    ["PT", "CAGE BEARING PRESS INDONESIA", false],
    ["LAIN", "CAGE BEARING (LOT LAIN)", false],
    ["PLASTIC", "PLASTIC", true],
  ];
  const qc: NgSection[] = [];
  for (const [key, title, plastic] of SECTIONS) {
    const rows = [...acc.values()].filter((e) => e.section === key && (e.before > 0 || sum(e.ng) > 0));
    if (!rows.length && key === "LAIN") continue;
    const parts = [...new Set(rows.map((r) => r.part))].sort(byOrder).map((part) => {
      const pr = rows.filter((r) => r.part === part);
      const types = [...new Set(pr.map((r) => r.type))].sort().map((type) => ({
        type,
        lots: pr
          .filter((r) => r.type === type)
          .sort((a, b) => a.lot.localeCompare(b.lot))
          .map((r) => (r.before > 0 ? { lot: r.lot, before: r.before, ng: r.ng } : { lot: r.lot, before: sum(r.ng), ng: r.ng, noSenbetsu: true })),
      }));
      return { part, types };
    });
    qc.push({ title, plastic, parts });
  }

  // ---- Produk Jatuh: per part|type, semua press digabung.
  type JAcc = JatuhRow & { plastic: boolean };
  const jacc = new Map<string, JAcc>();
  for (const f of facts) {
    const plastic = isPlastic(f);
    const { name, type } = partName(f);
    const k = `${plastic ? "P" : "I"}|${name}|${type}`;
    const e = jacc.get(k) ?? { part: name, type, before: 0, proc: Array(JATUH_PROC.length).fill(0), plastic };
    if (isSenbetsu(f)) e.before += f.qty;
    // Kode 9 = Part jatuh hanya ada di grup Iron Cage.
    if (!plastic) e.proc[jatuhProcOf(f.categoryName, procOfCat.get(f.categoryName) ?? "")] += f.ng[JATUH_IDX] || 0;
    jacc.set(k, e);
  }
  const jatuh: JatuhSection[] = [false, true].map((plastic) => ({
    title: plastic ? "PLASTIC" : "CAGE BEARING PRESS",
    plastic,
    rows: [...jacc.values()]
      .filter((e) => e.plastic === plastic && (e.before > 0 || sum(e.proc) > 0))
      .sort((a, b) => byOrder(a.part, b.part) || a.type.localeCompare(b.type))
      .map(({ plastic: _p, ...r }) => r),
  }));
  return { month, from, to, qc, jatuh };
}

export async function buildNgMonthly(master: MasterData, month: string): Promise<NgMonthly> {
  const from = `${month}-01`;
  const { facts } = await loadFacts(master, from, monthEnd(from));
  return buildNgMonthlyFrom(master, month, facts);
}

/** Total satu section QC Result. */
export function sectionTotals(s: NgSection) {
  let before = 0;
  const ng = Array(10).fill(0) as number[];
  for (const p of s.parts) for (const t of p.types) for (const l of t.lots) (before += l.before), l.ng.forEach((n, i) => (ng[i] += n));
  return { before, ng, total: sum(ng) };
}
