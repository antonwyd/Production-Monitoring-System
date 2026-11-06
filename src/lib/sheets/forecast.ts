// Penyimpanan Forecast vs PO di Google Sheet.
//  Tab "Forecast PO":     Versi | Customer | Part | Jenis | Bulan | Qty pcs | Pcs/Box | Sumber | Diisi oleh | Waktu
//  Tab "Forecast Harian": Versi | Customer | Part | Tanggal | Qty pcs | Diisi oleh | Waktu
// Satu versi (bulan file) per customer. Upload ulang versi yang sama = baris lama dikosongkan, baris baru ditambah.
// Hanya qty bukan nol yang disimpan; baris "(TOTAL)" per bulan mencatat jumlah (juga bila 0).
import { nowJakarta } from "../dates";
import { JENIS, type FcDailyStored, type FcRow, type FcStored, type FcDaily, type Jenis } from "../forecast";
import { sheetsIO } from "./qa";

export const SHEET_FC = "Forecast PO";
export const SHEET_FC_DAILY = "Forecast Harian";
const HEAD_FC = ["Versi", "Customer", "Part", "Jenis", "Bulan", "Qty pcs", "Pcs/Box", "Sumber", "Diisi oleh", "Waktu"];
const HEAD_DAY = ["Versi", "Customer", "Part", "Tanggal", "Qty pcs", "Diisi oleh", "Waktu"];

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const t = (v: unknown) => (s(v) === "" ? "" : `'${s(v)}`);
const n = (v: unknown) => (typeof v === "number" ? v : Number(s(v).replace(/,/g, "")) || 0);
/** Bulan/tanggal bisa terbaca sebagai teks "2026-11" atau serial tanggal bila diketik manual di Sheet. */
function ymOf(v: unknown, len: 7 | 10): string {
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400) * 1000).toISOString().slice(0, len);
  return s(v).slice(0, len);
}

let cache: { at: number; rows: FcStored[]; daily: FcDailyStored[] } | null = null;
const TTL = 60_000;

async function ensureTab(title: string, head: string[]) {
  const io = sheetsIO();
  const counts = await io.rowCounts();
  if (counts[title]) return;
  if (!io.addTab) throw new Error(`Tab "${title}" belum ada di Google Sheet.`);
  await io.addTab(title);
  await io.update([{ range: `'${title}'!A1:${String.fromCharCode(64 + head.length)}1`, values: [head] }]);
}

export async function readForecast(force = false): Promise<{ rows: FcStored[]; daily: FcDailyStored[] }> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache;
  let g: unknown[][] = [],
    h: unknown[][] = [];
  try {
    [g, h] = await sheetsIO().get([`'${SHEET_FC}'!A2:J`, `'${SHEET_FC_DAILY}'!A2:E`], "UNFORMATTED_VALUE");
  } catch {
    // tab belum ada = belum ada data
  }
  const rows: FcStored[] = [];
  for (const r of g) {
    const versi = ymOf(r[0], 7);
    const jenis = s(r[3]) as Jenis;
    if (!versi || !s(r[2]) || !JENIS.includes(jenis)) continue;
    rows.push({ versi, customer: s(r[1]), part: s(r[2]), jenis, bulan: ymOf(r[4], 7), qty: n(r[5]), box: n(r[6]) || undefined, sumber: s(r[7]), by: s(r[8]), at: s(r[9]) });
  }
  const daily: FcDailyStored[] = [];
  for (const r of h) {
    const versi = ymOf(r[0], 7);
    if (!versi || !s(r[2])) continue;
    daily.push({ versi, customer: s(r[1]), part: s(r[2]), tanggal: ymOf(r[3], 10), qty: n(r[4]) });
  }
  cache = { at: Date.now(), rows, daily };
  return cache;
}

/** Kosongkan baris-baris (nomor baris sheet) dalam blok-blok berurutan. */
function blanks(title: string, lastCol: string, width: number, rowNums: number[]) {
  const out: { range: string; values: string[][] }[] = [];
  rowNums.sort((a, b) => a - b);
  for (let i = 0; i < rowNums.length; ) {
    let j = i;
    while (j + 1 < rowNums.length && rowNums[j + 1] === rowNums[j] + 1) j++;
    out.push({ range: `'${title}'!A${rowNums[i]}:${lastCol}${rowNums[j]}`, values: Array.from({ length: j - i + 1 }, () => Array(width).fill("")) });
    i = j + 1;
  }
  return out;
}

/** Simpan satu versi forecast (menimpa versi + customer yang sama). `daily` null = data harian lama dibiarkan. */
export async function saveForecastVersion(opts: { versi: string; customer: string; rows: FcRow[]; daily: FcDaily[] | null; by: string; sumber: string }) {
  const { versi, customer, rows, daily, by, sumber } = opts;
  await ensureTab(SHEET_FC, HEAD_FC);
  await ensureTab(SHEET_FC_DAILY, HEAD_DAY);
  const io = sheetsIO();
  const [g, h] = await io.get([`'${SHEET_FC}'!A2:B`, `'${SHEET_FC_DAILY}'!A2:B`], "UNFORMATTED_VALUE");
  const same = (r: unknown[]) => ymOf(r[0], 7) === versi && s(r[1]).toLowerCase() === customer.toLowerCase();
  const oldFc = g.flatMap((r, i) => (same(r) ? [i + 2] : []));
  const oldDay = daily ? h.flatMap((r, i) => (same(r) ? [i + 2] : [])) : [];
  const now = nowJakarta();
  await io.update([...blanks(SHEET_FC, "J", 10, oldFc), ...blanks(SHEET_FC_DAILY, "G", 7, oldDay)]);
  if (rows.length)
    await io.append(
      `'${SHEET_FC}'!A:J`,
      rows.map((r) => [t(versi), t(customer), t(r.part), r.jenis, t(r.bulan), r.qty, r.box ?? "", sumber, by, now]),
    );
  if (daily?.length) await io.append(`'${SHEET_FC_DAILY}'!A:G`, daily.map((d) => [t(versi), t(customer), t(d.part), t(d.tanggal), d.qty, by, now]));
  cache = null;
}

export async function deleteForecastVersion(versi: string, customer: string) {
  const io = sheetsIO();
  const [g, h] = await io.get([`'${SHEET_FC}'!A2:B`, `'${SHEET_FC_DAILY}'!A2:B`], "UNFORMATTED_VALUE");
  const same = (r: unknown[]) => ymOf(r[0], 7) === versi && s(r[1]).toLowerCase() === customer.toLowerCase();
  await io.update([
    ...blanks(SHEET_FC, "J", 10, g.flatMap((r, i) => (same(r) ? [i + 2] : []))),
    ...blanks(SHEET_FC_DAILY, "G", 7, h.flatMap((r, i) => (same(r) ? [i + 2] : []))),
  ]);
  cache = null;
}

/** Daftar customer dari tab Master Customer (kolom B) bila ada. */
export async function customerList(): Promise<string[]> {
  try {
    const [g] = await sheetsIO().get([`'Master Customer'!B2:B`], "FORMATTED_VALUE");
    return [...new Set(g.map((r) => s(r[0])).filter(Boolean))].sort();
  } catch {
    return [];
  }
}
