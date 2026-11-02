// Pantau PO di Google Sheet, cukup dua tab:
//  "Master Customer" A:M = Customer | Item ID | Item Name | Pcs/Kanban | Pcs/Pole | Diameter Pole | O-Ring | Pole/Kanban | Kanban/Box | Pole/Box | Pcs/Box | Aktif | Catatan
//  "PO Customer"     A:S = ID | Customer | Item ID | Part | Pcs/Box | Qty PO (pcs) | Qty PO (box) | Tgl Delivery | Seiretsu (box) | Senbetsu (box)
//                          | Seiretsu kurang (pcs) | Senbetsu kurang (pcs) | Seiretsu kurang (box) | Senbetsu kurang (box) | Sisa hari | Status | No PO | Diinput oleh | Update terakhir
// G dan K:O rumus di Sheet (supaya Sheet sendiri juga terbaca); aplikasi menghitung ulang sendiri dari A:F, H:J, P.
// Baris tidak pernah dihapus/digeser: PO dihapus = Status "Dihapus".
import { nowJakarta, serialToText } from "../dates";
import type { CustItem, Po, PoState, PoStatus, Process } from "../po";
import { sheetsIO } from "./qa";

export const SHEET_CUST = "Master Customer";
export const SHEET_PO = "PO Customer";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const n = (v: unknown) => {
  if (typeof v === "number") return v;
  const x = Number(s(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const day = (v: unknown) => (typeof v === "number" ? serialToText(v) : s(v).slice(0, 10));
const txt = (v: string) => `'${v}`; // simpan apa adanya (part "6700" tetap teks)

/** Rumus kolom G dan K:O untuk baris r. */
export const formulas = (r: number) => ({
  G: `=IF(E${r}>0,ROUNDUP(F${r}/E${r}),"")`,
  KO: [
    `=IF(P${r}<>"Open",0,MAX(0,F${r}-I${r}*E${r}))`,
    `=IF(P${r}<>"Open",0,MAX(0,F${r}-J${r}*E${r}))`,
    `=IF(E${r}>0,ROUNDUP(K${r}/E${r}),"")`,
    `=IF(E${r}>0,ROUNDUP(L${r}/E${r}),"")`,
    `=IF(H${r}="","",H${r}-TODAY())`,
  ],
});

export async function readPoState(): Promise<PoState> {
  const [cust, po] = await sheetsIO().get([`'${SHEET_CUST}'!A2:M`, `'${SHEET_PO}'!A2:S`], "UNFORMATTED_VALUE");
  const items: CustItem[] = cust
    .filter((r) => s(r[0]) && s(r[1]))
    .map((r) => ({ customer: s(r[0]), itemId: s(r[1]), itemName: s(r[2]) || s(r[1]), pcsPerBox: n(r[10]), active: !/^(tidak|no|n|0|false)$/i.test(s(r[11])) }));
  const pos: Po[] = [];
  po.forEach((r, i) => {
    const st = s(r[15]);
    if (!s(r[0]) || st === "Dihapus") return;
    pos.push({
      id: s(r[0]),
      row: i + 2,
      customer: s(r[1]),
      itemId: s(r[2]),
      itemName: s(r[3]) || s(r[2]),
      pcsPerBox: n(r[4]),
      qty: n(r[5]),
      due: day(r[7]),
      box: { Seiretsu: n(r[8]), Senbetsu: n(r[9]) },
      status: (st === "Dikirim" || st === "Batal" ? st : "Open") as PoStatus,
      noPo: s(r[16]),
      by: s(r[17]),
      updated: s(r[18]),
    });
  });
  return { items, pos, asOf: nowJakarta() };
}

const rid = () => `PO${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;

export type NewPo = { customer: string; itemId: string; itemName: string; pcsPerBox: number; qty: number; due: string; noPo: string };

/** Tambah PO di baris kosong berikutnya (setelah baris terisi terakhir). */
export async function addPos(list: NewPo[], by: string): Promise<void> {
  const [ids] = await sheetsIO().get([`'${SHEET_PO}'!A2:A`], "UNFORMATTED_VALUE");
  let r = ids.length + 2;
  const at = `${by} ${nowJakarta().slice(0, 16)}`;
  const data = list.map((p) => {
    const f = formulas(r);
    const row = { range: `'${SHEET_PO}'!A${r}:S${r}`, values: [[rid(), txt(p.customer), txt(p.itemId), txt(p.itemName), p.pcsPerBox, p.qty, f.G, p.due, 0, 0, ...f.KO, "Open", txt(p.noPo), by, at]] };
    r++;
    return row;
  });
  await sheetsIO().update(data);
}

async function checkRow(row: number, id: string) {
  if (!(row >= 2)) throw new Error("Baris PO tidak valid. Muat ulang halaman.");
  const [g] = await sheetsIO().get([`'${SHEET_PO}'!A${row}:J${row}`], "UNFORMATTED_VALUE");
  if (s(g[0]?.[0]) !== id) throw new Error("PO sudah berubah di Sheet. Muat ulang halaman.");
  return g[0];
}

/** Tambah (atau kurangi) box selesai pada satu PO. Mengembalikan jumlah box baru. */
export async function addBox(row: number, id: string, process: Process, delta: number, by: string): Promise<number> {
  const r = await checkRow(row, id);
  const col = process === "Seiretsu" ? "I" : "J";
  const next = n(r[process === "Seiretsu" ? 8 : 9]) + delta;
  if (next < 0) throw new Error("Jumlah box tidak boleh kurang dari 0.");
  const sign = delta > 0 ? `+${delta}` : String(delta);
  await sheetsIO().update([
    { range: `'${SHEET_PO}'!${col}${row}`, values: [[next]] },
    { range: `'${SHEET_PO}'!S${row}`, values: [[`${by} ${nowJakarta().slice(0, 16)} ${process} ${sign} box`]] },
  ]);
  return next;
}

export async function updatePo(row: number, id: string, patch: { qty?: number; due?: string; status?: PoStatus | "Dihapus"; noPo?: string; box?: Partial<Record<Process, number>> }, by: string): Promise<void> {
  await checkRow(row, id);
  const data: { range: string; values: (string | number)[][] }[] = [];
  const put = (col: string, v: string | number) => data.push({ range: `'${SHEET_PO}'!${col}${row}`, values: [[v]] });
  if (patch.qty !== undefined) put("F", patch.qty);
  if (patch.due !== undefined) put("H", patch.due);
  if (patch.box?.Seiretsu !== undefined) put("I", patch.box.Seiretsu);
  if (patch.box?.Senbetsu !== undefined) put("J", patch.box.Senbetsu);
  if (patch.status !== undefined) put("P", patch.status);
  if (patch.noPo !== undefined) put("Q", txt(patch.noPo));
  put("S", `${by} ${nowJakarta().slice(0, 16)} ubah PO`);
  await sheetsIO().update(data);
}
