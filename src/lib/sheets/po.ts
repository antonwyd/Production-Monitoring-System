// Monitoring PO di Google Sheet:
//  "Master Customer" A:M = Customer | Item ID | Item Name | Pcs/Kanban | Pcs/Pole | Diameter Pole | O-Ring | Pole/Kanban | Kanban/Box | Pole/Box | Pcs/Box | Aktif | Catatan
//  "PO Customer"     A:T = ID | Customer | Item ID | Part | Pcs/Box | Qty PO (pcs) | Qty PO (box) | Tgl Delivery | Seiretsu (box) | Senbetsu (box) | Washing (box)
//                          | Total Output (pcs) | Kekurangan (pcs) | Kekurangan (box) | Progress | Sisa hari | Status | No PO | Diinput oleh | Update terakhir
//    G dan L:P rumus di Sheet (supaya Sheet sendiri terbaca); aplikasi menghitung ulang sendiri dari A:F, H:K, Q.
//  "Log Box" (disembunyikan, ditulis otomatis) A:I = Waktu | Tanggal | PO ID | Customer | Part | Proses | Box | Pcs | Oleh
// Baris PO tidak pernah dihapus/digeser: PO dihapus = Status "Dihapus".
import { nowJakarta, serialToText } from "../dates";
import { PROCESSES, type BoxLog, type CustItem, type Po, type PoState, type PoStatus, type Process } from "../po";
import { sheetsIO } from "./qa";

export const SHEET_CUST = "Master Customer";
export const SHEET_PO = "PO Customer";
export const SHEET_LOG = "Log Box";

const BOX_COL: Record<Process, string> = { Seiretsu: "I", Senbetsu: "J", Washing: "K" };
const BOX_IDX: Record<Process, number> = { Seiretsu: 8, Senbetsu: 9, Washing: 10 };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const n = (v: unknown) => {
  if (typeof v === "number") return v;
  const x = Number(s(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const day = (v: unknown) => (typeof v === "number" ? serialToText(v) : s(v).slice(0, 10));
const txt = (v: string) => `'${v}`; // simpan apa adanya (part "6700" tetap teks)

/** Rumus kolom G dan L:P untuk baris r. */
export const formulas = (r: number) => ({
  G: `=IF(E${r}>0,ROUNDUP(F${r}/E${r}),"")`,
  LP: [
    `=IF(Q${r}="Dikirim",F${r},MIN(F${r},MIN(I${r},J${r},K${r})*E${r}))`,
    `=IF(Q${r}<>"Open",0,MAX(0,F${r}-L${r}))`,
    `=IF(E${r}>0,ROUNDUP(M${r}/E${r}),"")`,
    `=IF(F${r}>0,L${r}/F${r},"")`,
    `=IF(H${r}="","",H${r}-TODAY())`,
  ],
});

export async function readPoState(): Promise<PoState> {
  const [cust, po, log] = await sheetsIO().get([`'${SHEET_CUST}'!A2:M`, `'${SHEET_PO}'!A2:T`, `'${SHEET_LOG}'!A2:I`], "UNFORMATTED_VALUE").catch(async () => {
    // Tab log belum ada: tetap jalan tanpa grafik.
    const [c, p] = await sheetsIO().get([`'${SHEET_CUST}'!A2:M`, `'${SHEET_PO}'!A2:T`], "UNFORMATTED_VALUE");
    return [c, p, []];
  });
  const items: CustItem[] = cust
    .filter((r) => s(r[0]) && s(r[1]))
    .map((r) => ({ customer: s(r[0]), itemId: s(r[1]), itemName: s(r[2]) || s(r[1]), pcsPerBox: n(r[10]), active: !/^(tidak|no|n|0|false)$/i.test(s(r[11])) }));
  const pos: Po[] = [];
  po.forEach((r, i) => {
    const st = s(r[16]);
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
      box: { Seiretsu: n(r[8]), Senbetsu: n(r[9]), Washing: n(r[10]) },
      status: (st === "Dikirim" || st === "Batal" ? st : "Open") as PoStatus,
      noPo: s(r[17]),
      by: s(r[18]),
      updated: s(r[19]),
    });
  });
  const logs: BoxLog[] = [];
  for (const r of log) {
    const process = PROCESSES.find((p) => p === s(r[5]));
    if (!process || !s(r[2])) continue;
    logs.push({ date: day(r[1]), poId: s(r[2]), customer: s(r[3]), process, box: n(r[6]), pcs: n(r[7]) });
  }
  return { items, pos, log: logs, asOf: nowJakarta() };
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
    const row = { range: `'${SHEET_PO}'!A${r}:T${r}`, values: [[rid(), txt(p.customer), txt(p.itemId), txt(p.itemName), p.pcsPerBox, p.qty, f.G, p.due, 0, 0, 0, ...f.LP, "Open", txt(p.noPo), by, at]] };
    r++;
    return row;
  });
  await sheetsIO().update(data);
}

async function checkRow(row: number, id: string) {
  if (!(row >= 2)) throw new Error("Baris PO tidak valid. Muat ulang halaman.");
  const [g] = await sheetsIO().get([`'${SHEET_PO}'!A${row}:K${row}`], "UNFORMATTED_VALUE");
  if (s(g[0]?.[0]) !== id) throw new Error("PO sudah berubah di Sheet. Muat ulang halaman.");
  return g[0];
}

/** Tambah (atau kurangi) box selesai pada satu PO + catat di log. Mengembalikan jumlah box baru. */
export async function addBox(row: number, id: string, process: Process, delta: number, by: string): Promise<number> {
  const r = await checkRow(row, id);
  const next = n(r[BOX_IDX[process]]) + delta;
  if (next < 0) throw new Error("Jumlah box tidak boleh kurang dari 0.");
  const now = nowJakarta();
  const sign = delta > 0 ? `+${delta}` : String(delta);
  await sheetsIO().update([
    { range: `'${SHEET_PO}'!${BOX_COL[process]}${row}`, values: [[next]] },
    { range: `'${SHEET_PO}'!T${row}`, values: [[`${by} ${now.slice(0, 16)} ${process} ${sign} box`]] },
  ]);
  try {
    await sheetsIO().append(`'${SHEET_LOG}'!A1:I1`, [[now, now.slice(0, 10), id, txt(s(r[1])), txt(s(r[3])), process, delta, delta * n(r[4]), by]]);
  } catch {
    // log hanya untuk grafik; jangan gagalkan input box
  }
  return next;
}

export async function updatePo(row: number, id: string, patch: { qty?: number; due?: string; status?: PoStatus | "Dihapus"; noPo?: string; box?: Partial<Record<Process, number>> }, by: string): Promise<void> {
  await checkRow(row, id);
  const data: { range: string; values: (string | number)[][] }[] = [];
  const put = (col: string, v: string | number) => data.push({ range: `'${SHEET_PO}'!${col}${row}`, values: [[v]] });
  if (patch.qty !== undefined) put("F", patch.qty);
  if (patch.due !== undefined) put("H", patch.due);
  for (const pr of PROCESSES) if (patch.box?.[pr] !== undefined) put(BOX_COL[pr], patch.box[pr]!);
  if (patch.status !== undefined) put("Q", patch.status);
  if (patch.noPo !== undefined) put("R", txt(patch.noPo));
  put("T", `${by} ${nowJakarta().slice(0, 16)} ubah PO`);
  await sheetsIO().update(data);
}
