// Pantau PO Customer: satu baris = satu PO (customer, part, qty, delivery) + jumlah box selesai Seiretsu & Senbetsu.
// Dipakai bersama oleh server (API) dan browser (halaman /po), tanpa akses Sheet.

export const PROCESSES = ["Seiretsu", "Senbetsu"] as const;
export type Process = (typeof PROCESSES)[number];

/** Satu baris tab "Master Customer". */
export type CustItem = { customer: string; itemId: string; itemName: string; pcsPerBox: number; active: boolean };

export type PoStatus = "Open" | "Dikirim" | "Batal";

/** Satu baris tab "PO Customer". */
export type Po = {
  id: string;
  row: number;
  customer: string;
  itemId: string;
  itemName: string;
  pcsPerBox: number;
  qty: number;
  due: string;
  box: Record<Process, number>;
  status: PoStatus;
  noPo: string;
  by: string;
  updated: string;
};

export type PoState = { items: CustItem[]; pos: Po[]; asOf: string };

export type ProcProgress = { done: number; short: number; shortBox: number };
export type PoRow = Po & {
  qtyBox: number;
  daysLeft: number;
  proc: Record<Process, ProcProgress>;
  /** Masih kurang di salah satu proses. */
  open: boolean;
  level: "late" | "urgent" | "soon" | "ok" | "done";
};

export const key = (customer: string, itemId: string) => `${customer.trim().toUpperCase()}|${itemId.trim().toUpperCase()}`;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

export const LEVEL_RANK: Record<PoRow["level"], number> = { late: 0, urgent: 1, soon: 2, ok: 3, done: 4 };

function levelOf(open: boolean, daysLeft: number): PoRow["level"] {
  if (!open) return "done";
  if (daysLeft < 0) return "late";
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 6) return "soon";
  return "ok";
}

/** Hitung kekurangan tiap PO. Box selesai = box × Pcs/Box; kurang tidak pernah minus. */
export function toRow(p: Po, today: string): PoRow {
  const per = p.pcsPerBox;
  const proc = {} as Record<Process, ProcProgress>;
  for (const pr of PROCESSES) {
    const done = p.status === "Dikirim" ? p.qty : Math.min(p.qty, p.box[pr] * per);
    const short = Math.max(0, p.qty - done);
    proc[pr] = { done, short, shortBox: per > 0 ? Math.ceil(short / per) : 0 };
  }
  const open = p.status === "Open" && PROCESSES.some((pr) => proc[pr].short > 0);
  const daysLeft = daysBetween(today, p.due);
  return { ...p, qtyBox: per > 0 ? Math.ceil(p.qty / per) : 0, daysLeft, proc, open, level: levelOf(open, daysLeft) };
}

/** PO aktif (bukan Batal), paling mendesak dulu. */
export function rowsOf(pos: Po[], today: string): PoRow[] {
  return pos
    .filter((p) => p.status !== "Batal")
    .map((p) => toRow(p, today))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.due.localeCompare(b.due) || a.customer.localeCompare(b.customer) || a.row - b.row);
}

export type CustomerSum = { customer: string; short: Record<Process, { pcs: number; box: number }>; open: number };

export function byCustomer(rows: PoRow[]): CustomerSum[] {
  const m = new Map<string, CustomerSum>();
  for (const r of rows) {
    const c = m.get(r.customer) ?? { customer: r.customer, short: { Seiretsu: { pcs: 0, box: 0 }, Senbetsu: { pcs: 0, box: 0 } }, open: 0 };
    if (r.status === "Open")
      for (const pr of PROCESSES) {
        c.short[pr].pcs += r.proc[pr].short;
        c.short[pr].box += r.proc[pr].shortBox;
      }
    if (r.open) c.open++;
    m.set(r.customer, c);
  }
  return [...m.values()];
}
