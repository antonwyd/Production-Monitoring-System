// Tab Pantau PO di Google Sheet:
//  "Master Customer" A:M = Customer | Item ID | Item Name | Pcs/Kanban | Pcs/Pole | Diameter Pole | O-Ring | Pole/Kanban | Kanban/Box | Pole/Box | Pcs/Box | Aktif | Catatan
//  "PO Customer"     A:L = ID | No PO | Customer | Item ID | Item Name | Qty PO (pcs) | Tgl Delivery | Status | Catatan | Diinput oleh | Waktu input | Diubah
//  "Input Box"       A:M = ID | Tanggal | Waktu | Proses | Customer | Item ID | Item Name | Box | Pcs/Box | Pcs tambahan | Total Pcs | Oleh | Catatan
// Baris tidak pernah dihapus/digeser: PO dihapus = Status "Dihapus", box dihapus = Proses "Dihapus (...)".
import { nowJakarta, serialToText } from "../dates";
import { PROCESSES, type BoxEntry, type CustItem, type Po, type PoState, type PoStatus, type Process } from "../po";
import { sheetsIO } from "./qa";

export const SHEET_CUST = "Master Customer";
export const SHEET_PO = "PO Customer";
export const SHEET_BOX = "Input Box";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const n = (v: unknown) => {
  if (typeof v === "number") return v;
  const x = Number(s(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const day = (v: unknown) => (typeof v === "number" ? serialToText(v) : s(v).slice(0, 10));
const stamp = (v: unknown) => (typeof v === "number" ? serialToText(v, true) : s(v));
const txt = (v: string) => `'${v}`; // simpan apa adanya (item "6700" tetap teks)

export async function readPoState(): Promise<PoState> {
  const [cust, po, box] = await sheetsIO().get([`'${SHEET_CUST}'!A2:M`, `'${SHEET_PO}'!A2:L`, `'${SHEET_BOX}'!A2:M`], "UNFORMATTED_VALUE");
  const items: CustItem[] = cust
    .filter((r) => s(r[0]) && s(r[1]))
    .map((r) => ({ customer: s(r[0]), itemId: s(r[1]), itemName: s(r[2]) || s(r[1]), pcsPerBox: n(r[10]), active: !/^(tidak|no|n|0|false)$/i.test(s(r[11])) }));
  const pos: Po[] = [];
  po.forEach((r, i) => {
    const st = s(r[7]);
    if (!s(r[0]) || st === "Dihapus") return;
    pos.push({
      id: s(r[0]),
      row: i + 2,
      noPo: s(r[1]),
      customer: s(r[2]),
      itemId: s(r[3]),
      itemName: s(r[4]),
      qty: n(r[5]),
      due: day(r[6]),
      status: (st === "Selesai" || st === "Batal" ? st : "Open") as PoStatus,
      note: s(r[8]),
      by: s(r[9]),
      at: stamp(r[10]),
    });
  });
  const entries: BoxEntry[] = [];
  box.forEach((r, i) => {
    if (!s(r[0])) return;
    const process = PROCESSES.find((p) => p.toLowerCase() === s(r[3]).toLowerCase());
    if (!process) return;
    const b = n(r[7]),
      per = n(r[8]),
      extra = n(r[9]);
    entries.push({
      id: s(r[0]),
      row: i + 2,
      date: day(r[1]),
      time: s(r[2]),
      process,
      customer: s(r[4]),
      itemId: s(r[5]),
      itemName: s(r[6]),
      box: b,
      pcsPerBox: per,
      extra,
      pcs: r[10] === undefined || r[10] === "" ? b * per + extra : n(r[10]),
      by: s(r[11]),
      note: s(r[12]),
    });
  });
  return { items, pos, entries, asOf: nowJakarta() };
}

const rid = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;

export type NewPo = { noPo: string; customer: string; itemId: string; itemName: string; qty: number; due: string; note: string };

export async function addPos(list: NewPo[], by: string): Promise<void> {
  const at = nowJakarta();
  const rows = list.map((p) => [rid("PO"), txt(p.noPo), txt(p.customer), txt(p.itemId), txt(p.itemName), p.qty, p.due, "Open", txt(p.note), by, at, ""]);
  await sheetsIO().append(`'${SHEET_PO}'!A1:L1`, rows);
}

export async function updatePo(row: number, id: string, patch: { qty?: number; due?: string; status?: PoStatus; noPo?: string; note?: string }, by: string): Promise<void> {
  if (!(row >= 2)) throw new Error("Baris PO tidak valid. Muat ulang halaman.");
  const [g] = await sheetsIO().get([`'${SHEET_PO}'!A${row}:L${row}`], "UNFORMATTED_VALUE");
  if (s(g[0]?.[0]) !== id) throw new Error("PO sudah berubah di Sheet. Muat ulang halaman.");
  const data: { range: string; values: (string | number)[][] }[] = [];
  const put = (col: string, v: string | number) => data.push({ range: `'${SHEET_PO}'!${col}${row}`, values: [[v]] });
  if (patch.noPo !== undefined) put("B", txt(patch.noPo));
  if (patch.qty !== undefined) put("F", patch.qty);
  if (patch.due !== undefined) put("G", patch.due);
  if (patch.status !== undefined) put("H", patch.status);
  if (patch.note !== undefined) put("I", txt(patch.note));
  put("L", `${by} ${nowJakarta()}`);
  await sheetsIO().update(data);
}

export async function deletePo(row: number, id: string): Promise<void> {
  if (!(row >= 2)) throw new Error("Baris PO tidak valid. Muat ulang halaman.");
  const [g] = await sheetsIO().get([`'${SHEET_PO}'!A${row}:A${row}`], "UNFORMATTED_VALUE");
  if (s(g[0]?.[0]) !== id) throw new Error("PO sudah berubah di Sheet. Muat ulang halaman.");
  await sheetsIO().update([{ range: `'${SHEET_PO}'!H${row}`, values: [["Dihapus"]] }]);
}

export type NewBox = { date: string; process: Process; customer: string; itemId: string; itemName: string; box: number; pcsPerBox: number; extra: number; note: string };

export async function addBox(b: NewBox, by: string): Promise<string> {
  const id = rid("BX");
  const time = nowJakarta().slice(11, 16);
  await sheetsIO().append(`'${SHEET_BOX}'!A1:M1`, [
    [id, b.date, time, b.process, txt(b.customer), txt(b.itemId), txt(b.itemName), b.box, b.pcsPerBox, b.extra, b.box * b.pcsPerBox + b.extra, by, txt(b.note)],
  ]);
  return id;
}

export async function readBoxRow(row: number): Promise<{ id: string; by: string; date: string } | null> {
  const [g] = await sheetsIO().get([`'${SHEET_BOX}'!A${row}:L${row}`], "UNFORMATTED_VALUE");
  const r = g[0];
  return r && s(r[0]) ? { id: s(r[0]), by: s(r[11]), date: day(r[1]) } : null;
}

export async function deleteBox(row: number, by: string): Promise<void> {
  await sheetsIO().update([{ range: `'${SHEET_BOX}'!D${row}`, values: [[`Dihapus (${by} ${nowJakarta()})`]] }]);
}
