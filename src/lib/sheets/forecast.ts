// Penyimpanan Forecast harian vs PO harian di Google Sheet.
//  Tab "Forecast Harian": Versi | Customer | Part | Tanggal | Qty pcs | Diisi oleh | Waktu | Pcs/Box
//  Tab "PO Harian":       Customer | Part | Tanggal kirim | Qty pcs | Diinput oleh | Waktu
// Forecast: satu versi (bulan) per customer; simpan ulang bulan yang sama = baris lama dikosongkan, baris baru ditambah.
// PO: satu set per customer + tanggal kirim; simpan ulang tanggal yang sama menimpa. Hanya qty > 0 yang disimpan.
import { nowJakarta } from "../dates";
import type { FcDaily, FcDailyStored, PoDaily } from "../forecast";
import { sheetsIO } from "./qa";

export const SHEET_FC_DAILY = "Forecast Harian";
export const SHEET_PO = "PO Harian";
const HEAD_DAY = ["Versi", "Customer", "Part", "Tanggal", "Qty pcs", "Diisi oleh", "Waktu", "Pcs/Box"];
const HEAD_PO = ["Customer", "Part", "Tanggal kirim", "Qty pcs", "Diinput oleh", "Waktu"];

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const t = (v: unknown) => (s(v) === "" ? "" : `'${s(v)}`);
const n = (v: unknown) => (typeof v === "number" ? v : Number(s(v).replace(/,/g, "")) || 0);
/** Bulan/tanggal bisa terbaca sebagai teks "2026-11-07" atau serial tanggal bila diketik manual di Sheet. */
function dOf(v: unknown, len: 7 | 10): string {
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400) * 1000).toISOString().slice(0, len);
  return s(v).slice(0, len);
}
const col = (k: number) => String.fromCharCode(64 + k);

let cache: { at: number; fc: FcDailyStored[]; po: PoDaily[] } | null = null;
const TTL = 60_000;

async function ensureTab(title: string, head: string[]) {
  const io = sheetsIO();
  const counts = await io.rowCounts();
  if (!counts[title]) {
    if (!io.addTab) throw new Error(`Tab "${title}" belum ada di Google Sheet.`);
    await io.addTab(title);
  }
  await io.update([{ range: `'${title}'!A1:${col(head.length)}1`, values: [head] }]);
}

export async function readForecast(force = false): Promise<{ fc: FcDailyStored[]; po: PoDaily[] }> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache;
  const io = sheetsIO();
  const get = async (range: string) => {
    try {
      return (await io.get([range], "UNFORMATTED_VALUE"))[0];
    } catch {
      return []; // tab belum ada = belum ada data
    }
  };
  const [g, h] = await Promise.all([get(`'${SHEET_FC_DAILY}'!A2:H`), get(`'${SHEET_PO}'!A2:F`)]);
  const fc: FcDailyStored[] = [];
  for (const r of g) {
    const versi = dOf(r[0], 7);
    const tanggal = dOf(r[3], 10);
    if (!versi || !s(r[2]) || tanggal.length !== 10 || !n(r[4])) continue;
    fc.push({ versi, customer: s(r[1]), part: s(r[2]), tanggal, qty: n(r[4]), by: s(r[5]), at: s(r[6]), box: n(r[7]) || undefined });
  }
  const po: PoDaily[] = [];
  for (const r of h) {
    const tanggal = dOf(r[2], 10);
    if (!s(r[0]) || !s(r[1]) || tanggal.length !== 10 || !n(r[3])) continue;
    po.push({ customer: s(r[0]), part: s(r[1]), tanggal, qty: n(r[3]), by: s(r[4]), at: s(r[5]) });
  }
  cache = { at: Date.now(), fc, po };
  return cache;
}

/** Kosongkan baris-baris (nomor baris sheet) dalam blok-blok berurutan. */
function blanks(title: string, width: number, rowNums: number[]) {
  const out: { range: string; values: string[][] }[] = [];
  rowNums.sort((a, b) => a - b);
  for (let i = 0; i < rowNums.length; ) {
    let j = i;
    while (j + 1 < rowNums.length && rowNums[j + 1] === rowNums[j] + 1) j++;
    out.push({ range: `'${title}'!A${rowNums[i]}:${col(width)}${rowNums[j]}`, values: Array.from({ length: j - i + 1 }, () => Array(width).fill("")) });
    i = j + 1;
  }
  return out;
}
const same = (a: unknown, b: string) => s(a).toLowerCase() === b.toLowerCase();

/** Simpan forecast harian satu bulan untuk satu customer (menimpa bulan + customer yang sama). */
export async function saveForecastMonth(opts: { versi: string; customer: string; daily: FcDaily[]; by: string }) {
  const { versi, customer, daily, by } = opts;
  await ensureTab(SHEET_FC_DAILY, HEAD_DAY);
  const io = sheetsIO();
  const [g] = await io.get([`'${SHEET_FC_DAILY}'!A2:B`], "UNFORMATTED_VALUE");
  const old = g.flatMap((r, i) => (dOf(r[0], 7) === versi && same(r[1], customer) ? [i + 2] : []));
  if (old.length) await io.update(blanks(SHEET_FC_DAILY, HEAD_DAY.length, old));
  const now = nowJakarta();
  if (daily.length) await io.append(`'${SHEET_FC_DAILY}'!A:H`, daily.map((d) => [t(versi), t(customer), t(d.part), t(d.tanggal), d.qty, by, now, d.box ?? ""]));
  cache = null;
}

/** Simpan PO satu tanggal kirim untuk satu customer (menimpa tanggal + customer yang sama). */
export async function savePoDay(opts: { customer: string; tanggal: string; items: { part: string; qty: number }[]; by: string }) {
  const { customer, tanggal, items, by } = opts;
  await ensureTab(SHEET_PO, HEAD_PO);
  const io = sheetsIO();
  const [g] = await io.get([`'${SHEET_PO}'!A2:C`], "UNFORMATTED_VALUE");
  const old = g.flatMap((r, i) => (same(r[0], customer) && dOf(r[2], 10) === tanggal ? [i + 2] : []));
  if (old.length) await io.update(blanks(SHEET_PO, HEAD_PO.length, old));
  const now = nowJakarta();
  const rows = items.filter((i) => i.qty > 0);
  if (rows.length) await io.append(`'${SHEET_PO}'!A:F`, rows.map((i) => [t(customer), t(i.part), t(tanggal), i.qty, by, now]));
  cache = null;
}

export async function deleteForecastMonth(versi: string, customer: string) {
  const io = sheetsIO();
  const [g] = await io.get([`'${SHEET_FC_DAILY}'!A2:B`], "UNFORMATTED_VALUE");
  const old = g.flatMap((r, i) => (dOf(r[0], 7) === versi && same(r[1], customer) ? [i + 2] : []));
  if (old.length) await io.update(blanks(SHEET_FC_DAILY, HEAD_DAY.length, old));
  cache = null;
}

/** Customer + part dari tab Master Customer (A Customer, C Item Name, K Pcs/Box, L Aktif). */
export async function masterCustomers(): Promise<{ customers: string[]; parts: Record<string, { part: string; box: number }[]> }> {
  try {
    const [g] = await sheetsIO().get([`'Master Customer'!A2:L`], "UNFORMATTED_VALUE");
    const parts: Record<string, { part: string; box: number }[]> = {};
    for (const r of g) {
      const c = s(r[0]);
      if (!c || /^tidak|^no$/i.test(s(r[11]))) continue;
      (parts[c] ??= []);
      if (s(r[2])) parts[c].push({ part: s(r[2]), box: n(r[10]) });
    }
    return { customers: Object.keys(parts).sort(), parts };
  } catch {
    return { customers: [], parts: {} };
  }
}
