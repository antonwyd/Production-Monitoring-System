// Laporan NG lengkap satu kali download (format file "09. September NG 2026 new model1.xlsx"):
// QC Result bulanan, Produk Jatuh, Page 1 Monthly Report QC, NG% 1 Bulan, NG Rate (tahun fiskal April–Maret),
// Graphic Perbandingan Iron, Perbandingan produk jatuh, Graphic Compare Plastic.
// Sheet mingguan template tidak dipakai (diganti bulanan, permintaan Pak Anton 23 Nov 2026).
import { loadFacts, type Fact } from "./reports";
import { monthEnd } from "./dates";
import type { MasterData } from "./types";
import { buildNgMonthlyFrom, sectionTotals, type NgMonthly } from "./ngMonthly";
import { hargaOf } from "./ngHarga";

export type NgSumRow = { part: string; type: string; after: number; ng: number[]; harga: number | null };
export type NgSumSection = { title: string; key: "JPN" | "PT" | "LAIN" | "PLASTIC"; plastic: boolean; rows: NgSumRow[] };
export type RateCell = { ng: number; sen: number };
export type RateMonth = { month: string; label: string; jpn: RateCell | null; idn: RateCell | null; pla: RateCell | null; source: "app" | "manual" | null };
export type NgReport = NgMonthly & {
  summary: NgSumSection[];
  prev: { month: string; summary: NgSumSection[]; jatuhNg: number[]; jatuhProd: number[]; ada: boolean };
  /** Part jatuh per kolom proses bulan ini (iron + plastik). */
  jatuhNg: number[];
  fy: { start: string; label: string; months: RateMonth[] };
};

/** Data web app mulai bulan ini; bulan sebelumnya pakai angka manual dari file Excel QC. */
export const APP_START = "2026-11";
const MONTH_EN = ["April", "May", "June", "July", "Augst", "Sept", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/** NG Rate sebelum web app (sheet "NG Rate 2026" file September 2026): [Total NG, Total Senbetsu]. */
export const NG_RATE_MANUAL: Record<string, { jpn: [number, number]; idn: [number, number]; pla: [number, number] }> = {
  "2026-04": { jpn: [80115, 8115885], idn: [32581, 19772515], pla: [6216, 2250356] },
  "2026-05": { jpn: [66817, 7160444], idn: [27475, 18277675], pla: [6759, 1650334] },
  "2026-06": { jpn: [97279, 7803459], idn: [32099, 19802535], pla: [5730, 2059710] },
  "2026-07": { jpn: [96230, 10151976], idn: [24950, 21724086], pla: [14354, 2411274] },
  "2026-08": { jpn: [79964, 7780054], idn: [19373, 16436878], pla: [11302, 3707527] },
  "2026-09": { jpn: [114971, 9809991], idn: [32874, 22616811], pla: [19220, 2859445] },
};

export const addMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** Awal tahun fiskal (April) untuk bulan m. */
export const fyStart = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${mo >= 4 ? y : y - 1}-04`;
};

/** Ringkas QC Result per part + D1/D2 (semua lot dijumlah) = isi sheet NG% 1 Bulan. */
export function summarize(d: NgMonthly): NgSumSection[] {
  const KEY: Record<string, NgSumSection["key"]> = { "CAGE BEARING PRESS JAPAN": "JPN", "CAGE BEARING PRESS INDONESIA": "PT", "CAGE BEARING (LOT LAIN)": "LAIN", PLASTIC: "PLASTIC" };
  return d.qc.map((s) => ({
    title: s.title,
    key: KEY[s.title] ?? "LAIN",
    plastic: s.plastic,
    rows: s.parts.flatMap((p) =>
      p.types.map((t) => {
        const ng = Array(10).fill(0) as number[];
        let after = 0;
        for (const l of t.lots) (after += l.after ?? 0), l.ng.forEach((n, i) => (ng[i] += n));
        return { part: p.part, type: t.type, after, ng, harga: hargaOf(p.part, t.type, s.plastic) };
      }),
    ),
  }));
}

const jatuhNgOf = (d: NgMonthly) => {
  const out = Array(d.jatuhProd.length).fill(0) as number[];
  for (const s of d.jatuh) for (const r of s.rows) r.proc.forEach((n, i) => (out[i] += n));
  return out;
};

const rateOf = (d: NgMonthly, title: string): RateCell | null => {
  const s = d.qc.find((x) => x.title === title);
  if (!s) return null;
  const t = sectionTotals(s);
  return { ng: t.total, sen: t.after };
};

export function buildNgReportFrom(master: MasterData, month: string, facts: Fact[]): NgReport {
  const inMonth = (m: string) => facts.filter((f) => f.workDate.slice(0, 7) === m);
  const cur = buildNgMonthlyFrom(master, month, inMonth(month));
  const pm = addMonth(month, -1);
  const prevFacts = inMonth(pm);
  const prevD = buildNgMonthlyFrom(master, pm, prevFacts);
  const start = fyStart(month);
  const months: RateMonth[] = MONTH_EN.map((label, i) => {
    const m = addMonth(start, i);
    if (m > month) return { month: m, label, jpn: null, idn: null, pla: null, source: null };
    if (m < APP_START) {
      const x = NG_RATE_MANUAL[m];
      if (!x) return { month: m, label, jpn: null, idn: null, pla: null, source: null };
      const c = ([ng, sen]: [number, number]) => ({ ng, sen });
      return { month: m, label, jpn: c(x.jpn), idn: c(x.idn), pla: c(x.pla), source: "manual" };
    }
    const d = m === month ? cur : buildNgMonthlyFrom(master, m, inMonth(m));
    return { month: m, label, jpn: rateOf(d, "CAGE BEARING PRESS JAPAN"), idn: rateOf(d, "CAGE BEARING PRESS INDONESIA"), pla: rateOf(d, "PLASTIC"), source: "app" };
  });
  return {
    ...cur,
    summary: summarize(cur),
    jatuhNg: jatuhNgOf(cur),
    prev: { month: pm, summary: summarize(prevD), jatuhNg: jatuhNgOf(prevD), jatuhProd: prevD.jatuhProd, ada: prevFacts.length > 0 },
    fy: { start, label: start.slice(0, 4), months },
  };
}

export async function buildNgReport(master: MasterData, month: string): Promise<NgReport> {
  // Satu kali baca: dari awal tahun fiskal (atau bulan lalu, mana yang lebih awal) sampai akhir bulan.
  const pm = addMonth(month, -1);
  const from = pm < fyStart(month) ? pm : fyStart(month);
  const { facts } = await loadFacts(master, `${from}-01`, monthEnd(`${month}-01`));
  return buildNgReportFrom(master, month, facts);
}

