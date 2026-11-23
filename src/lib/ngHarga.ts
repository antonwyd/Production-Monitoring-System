import { partKey } from "./ngMonthly";

// Harga per pcs (USD) untuk kolom "Harga/pcs" & "Kerugian (USD)" di sheet NG% 1 Bulan.
// Sumber: file "09. September NG 2026 new model1.xlsx" (sheet NG% 1 Bulan). Press JPN & PT sama.
const IRON: Record<string, [number, number]> = {
  "625-H": [0.0105, 0.0159],
  "626-BH": [0.0188, 0.0283],
  "688-AH": [0.0114, 0.017],
  "695JC-H": [0.0124, 0.018],
  "626-J": [0, 0],
  "627-J": [0.0074, 0.0105],
  "627-H": [0.0189, 0.0283],
  "628-J": [0.0114, 0.0172],
  "629-J": [0.0093, 0.0134],
  "6800-J": [0.0141, 0.0211],
  "6900-J": [0.0141, 0.0213],
  "6901-J": [0.0168, 0.0251],
  "6902-J": [0.0168, 0.0252],
  "6903-J": [0, 0],
  "698-J": [0.0099, 0.0149],
  "6803-J": [0.0268, 0.0396],
  "608-JCL": [0.0095, 0.0142],
  "6802-H": [0.026, 0.039],
  "6801-J": [0, 0],
  "6802 KDC-J": [0.0137, 0.0206],
};
const PLASTIC: Record<string, number> = {
  "696T12ZZ": 0.015,
  "P 608T": 0,
  "6900TIX": 0.0236,
  "626T1X": 0,
  "695 T12": 0.0132,
  "684T12L": 0.0181,
  "698 T1X": 0.0234,
  "608 T1X": 0.0116,
  "629 T1X": 0.0228,
  "6902 T1X": 0.0317,
  "6800 T1X": 0.0237,
  "B10-100T1X-1": 0.0223,
  "608-X3": 0.008444,
  "608TT": 0.035372,
  W688: 0.011037,
  "608-X1": 0.013697,
  EWC0606X: 0,
  EWC0608X: 0.025266,
  "ML5009-5": 0.012766,
  "6000FG": 0.01476,
  "6700": 0.021476,
  "696-2-X2": 0.007713,
  "698": 0.012034,
  "W693-X3": 0.006649,
  "0826 6140-12B2": 0.00627,
  "6801": 0.020279,
  "604": 0.008976,
  "605-4": 0.008976,
  S8030: 0.007,
  "629T85": 0.045,
  "624": 0.020212,
};
// Dibuat saat pertama dipakai (hindari urutan import melingkar reports -> ngReport -> ngMonthly).
let maps: { iron: Map<string, [number, number]>; plastic: Map<string, number> } | null = null;
const getMaps = () =>
  (maps ??= {
    iron: new Map(Object.entries(IRON).map(([k, v]) => [partKey(k), v])),
    plastic: new Map(Object.entries(PLASTIC).map(([k, v]) => [partKey(k), v])),
  });

/** Harga/pcs USD, null bila belum ada. Type "D2 NC" memakai harga D2. */
export function hargaOf(part: string, type: string, plastic: boolean): number | null {
  if (plastic) return getMaps().plastic.get(partKey(part)) ?? null;
  const v = getMaps().iron.get(partKey(part));
  if (!v) return null;
  return /^D1/i.test(type) ? v[0] : /^D2/i.test(type) ? v[1] : null;
}
