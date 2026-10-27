// Plan bulanan per section untuk Production Report (laporan akhir bulan ke Presdir).
// Tab "Plan Bulanan": Bulan | Section | Plan Produksi | Hari Kerja | Jam Normal | Member/Mesin | Productivity | Catatan | Diisi oleh | Diubah.
// Satu baris per bulan + section; leader mengisi lewat halaman /production-report/plan.
import { nowJakarta } from "../dates";
import { sheetsIO } from "./qa";

export const SHEET_PLAN = "Plan Bulanan";

export type MonthPlan = {
  month: string; // YYYY-MM
  section: string; // key section, mis. "senbetsu-iron"
  production: number;
  /** Tanggal hari kerja (1..31); plan harian = production / jumlah hari kerja. */
  workDays: number[];
  /** Jam normal per orang/mesin sebulan. */
  hoursNormal: number;
  /** Jumlah member (Senbetsu/Seiretsu) atau mesin (PF). */
  units: number;
  /** pcs per jam per member/mesin. */
  productivity: number;
  note: string;
  by: string;
  updated: string;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const n = (v: unknown) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;

export function parseDays(v: unknown): number[] {
  return [...new Set(s(v).split(/[^\d]+/).map(Number).filter((d) => d >= 1 && d <= 31))].sort((a, b) => a - b);
}

async function readGrid() {
  const [g] = await sheetsIO().get([`'${SHEET_PLAN}'!A2:J`], "FORMATTED_VALUE");
  return g;
}

function rowToPlan(r: unknown[]): MonthPlan {
  return {
    month: s(r[0]),
    section: s(r[1]),
    production: n(r[2]),
    workDays: parseDays(r[3]),
    hoursNormal: n(r[4]),
    units: n(r[5]),
    productivity: n(r[6]),
    note: s(r[7]),
    by: s(r[8]),
    updated: s(r[9]),
  };
}

/** Plan untuk beberapa bulan sekaligus (bulan laporan + bulan berikutnya). Tab belum ada = kosong. */
export async function readPlans(months: string[]): Promise<MonthPlan[]> {
  let g: unknown[][];
  try {
    g = await readGrid();
  } catch {
    return [];
  }
  return g.map(rowToPlan).filter((p) => p.section && months.includes(p.month));
}

/** Simpan (tambah atau timpa) plan satu bulan + section. */
export async function savePlan(p: Omit<MonthPlan, "updated">): Promise<void> {
  const g = await readGrid();
  const idx = g.findIndex((r) => s(r[0]) === p.month && s(r[1]) === p.section);
  // Apostrof: supaya "2026-10" dan "1,2,3" tetap teks, tidak diubah Sheet jadi tanggal/angka.
  const row = [`'${p.month}`, p.section, p.production, `'${p.workDays.join(",")}`, p.hoursNormal, p.units, p.productivity, p.note, p.by, nowJakarta()];
  const r = idx >= 0 ? idx + 2 : g.length + 2;
  await sheetsIO().update([{ range: `'${SHEET_PLAN}'!A${r}:J${r}`, values: [row] }]);
}
