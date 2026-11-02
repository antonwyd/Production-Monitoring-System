// Monitoring PO Customer: satu baris = satu PO (customer, part, qty, delivery) + jumlah box selesai Seiretsu, Senbetsu, Washing.
// Dipakai bersama oleh server (API) dan browser (halaman /po), tanpa akses Sheet.

export const PROCESSES = ["Seiretsu", "Senbetsu", "Washing"] as const;
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

/** Satu baris tab log (otomatis, tersembunyi): untuk grafik output harian. */
export type BoxLog = { date: string; poId: string; customer: string; process: Process; box: number; pcs: number };

export type PoState = { items: CustItem[]; pos: Po[]; log: BoxLog[]; asOf: string };

export type ProcProgress = { done: number; short: number; shortBox: number };
export type PoRow = Po & {
  qtyBox: number;
  daysLeft: number;
  proc: Record<Process, ProcProgress>;
  /** Output jadi = proses paling sedikit (barang harus lewat semua proses). */
  output: number;
  short: number;
  shortBox: number;
  progress: number;
  /** Masih kurang di salah satu proses. */
  open: boolean;
  level: "late" | "urgent" | "soon" | "ok" | "done";
  /** Selesai = output penuh; Kekurangan = belum penuh dan delivery ≤ 2 hari / lewat; selain itu On Progress. */
  state: "Selesai" | "On Progress" | "Kekurangan";
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
  const output = Math.min(...PROCESSES.map((pr) => proc[pr].done));
  const short = Math.max(0, p.qty - output);
  const level = levelOf(open, daysLeft);
  const state = !open ? "Selesai" : level === "late" || level === "urgent" ? "Kekurangan" : "On Progress";
  return { ...p, qtyBox: per > 0 ? Math.ceil(p.qty / per) : 0, daysLeft, proc, output, short, shortBox: per > 0 ? Math.ceil(short / per) : 0, progress: p.qty > 0 ? output / p.qty : 0, open, level, state };
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
    const c = m.get(r.customer) ?? { customer: r.customer, short: { Seiretsu: { pcs: 0, box: 0 }, Senbetsu: { pcs: 0, box: 0 }, Washing: { pcs: 0, box: 0 } }, open: 0 };
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

/** Output per tanggal per proses dari log, untuk grafik tren. */
export function dailyOutput(log: BoxLog[], from: string, to: string, poIds?: Set<string>): { date: string; Seiretsu: number; Senbetsu: number; Washing: number }[] {
  const out: { date: string; Seiretsu: number; Senbetsu: number; Washing: number }[] = [];
  const idx = new Map<string, number>();
  for (let d = from; d <= to; d = new Date(Date.parse(d + "T00:00:00Z") + 86400000).toISOString().slice(0, 10)) {
    idx.set(d, out.length);
    out.push({ date: d, Seiretsu: 0, Senbetsu: 0, Washing: 0 });
    if (out.length > 400) break;
  }
  for (const l of log) {
    const i = idx.get(l.date);
    if (i === undefined || (poIds && !poIds.has(l.poId))) continue;
    out[i][l.process] += l.pcs;
  }
  return out;
}
