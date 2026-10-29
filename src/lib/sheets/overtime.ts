// Rencana Lembur yang disimpan: tab "Rencana Lembur" = Nama | Data (JSON isian halaman) | Diisi oleh | Diubah.
// Satu baris per nama rencana; simpan dengan nama yang sama = timpa.
import { nowJakarta } from "../dates";
import { sheetsIO } from "./qa";

export const SHEET_OT = "Rencana Lembur";

export type SavedPlan = { name: string; data: unknown; by: string; updated: string };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();

async function readGrid() {
  const [g] = await sheetsIO().get([`'${SHEET_OT}'!A2:D`], "FORMATTED_VALUE");
  return g;
}

/** Rencana tersimpan, terbaru dulu. Tab belum ada = kosong. */
export async function readOtPlans(): Promise<SavedPlan[]> {
  let g: unknown[][];
  try {
    g = await readGrid();
  } catch {
    return [];
  }
  const out: SavedPlan[] = [];
  for (const r of g) {
    if (!s(r[0])) continue;
    try {
      out.push({ name: s(r[0]), data: JSON.parse(s(r[1])), by: s(r[2]), updated: s(r[3]) });
    } catch {
      // baris rusak dilewati
    }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function saveOtPlan(name: string, data: unknown, by: string): Promise<void> {
  let g: unknown[][];
  try {
    g = await readGrid();
  } catch {
    throw new Error(`Tab "${SHEET_OT}" belum ada di Google Sheet.`);
  }
  const idx = g.findIndex((r) => s(r[0]).toLowerCase() === name.toLowerCase());
  const r = idx >= 0 ? idx + 2 : g.length + 2;
  await sheetsIO().update([{ range: `'${SHEET_OT}'!A${r}:D${r}`, values: [[`'${name}`, `'${JSON.stringify(data)}`, by, nowJakarta()]] }]);
}

export async function deleteOtPlan(name: string): Promise<void> {
  const g = await readGrid();
  const idx = g.findIndex((r) => s(r[0]).toLowerCase() === name.toLowerCase());
  if (idx < 0) return;
  const r = idx + 2;
  await sheetsIO().update([{ range: `'${SHEET_OT}'!A${r}:D${r}`, values: [["", "", "", ""]] }]);
}
