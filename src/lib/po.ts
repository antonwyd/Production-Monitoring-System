// Pantau PO Customer: hitung kekurangan per PO per proses dari input box Seiretsu / Senbetsu.
// Dipakai bersama oleh server (API) dan browser (halaman /po), tanpa akses Sheet.

export const PROCESSES = ["Seiretsu", "Senbetsu"] as const;
export type Process = (typeof PROCESSES)[number];

/** Satu baris tab "Master Customer". */
export type CustItem = { customer: string; itemId: string; itemName: string; pcsPerBox: number; active: boolean };

export type PoStatus = "Open" | "Selesai" | "Batal";
/** Satu baris tab "PO Customer". */
export type Po = {
  id: string;
  row: number;
  noPo: string;
  customer: string;
  itemId: string;
  itemName: string;
  qty: number;
  due: string;
  status: PoStatus;
  note: string;
  by: string;
  at: string;
};

/** Satu baris tab "Input Box". */
export type BoxEntry = {
  id: string;
  row: number;
  date: string;
  time: string;
  process: Process;
  customer: string;
  itemId: string;
  itemName: string;
  box: number;
  pcsPerBox: number;
  extra: number;
  pcs: number;
  by: string;
  note: string;
};

export type PoState = { items: CustItem[]; pos: Po[]; entries: BoxEntry[]; asOf: string };

export type ProcProgress = { done: number; short: number; shortBox: number };
export type PoRow = Po & {
  pcsPerBox: number;
  daysLeft: number;
  proc: Record<Process, ProcProgress>;
  /** Kurang di salah satu proses. */
  open: boolean;
  level: "late" | "urgent" | "soon" | "ok" | "done";
};

export type CustomerSum = {
  customer: string;
  rows: PoRow[];
  short: Record<Process, { pcs: number; box: number }>;
  nextDue: string | null;
  worst: PoRow["level"];
};

export type Summary = {
  rows: PoRow[];
  customers: CustomerSum[];
  /** Hasil box yang belum punya PO (kelebihan / stok), per customer|item|proses. */
  surplus: { customer: string; itemId: string; itemName: string; process: Process; pcs: number }[];
};

export const key = (customer: string, itemId: string) => `${customer.trim().toUpperCase()}|${itemId.trim().toUpperCase()}`;

const DAY = 86400000;
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY);
}

const LEVEL_RANK: Record<PoRow["level"], number> = { late: 0, urgent: 1, soon: 2, ok: 3, done: 4 };

function levelOf(open: boolean, daysLeft: number): PoRow["level"] {
  if (!open) return "done";
  if (daysLeft < 0) return "late";
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 6) return "soon";
  return "ok";
}

/**
 * Box dibagi ke PO secara FIFO: PO dengan tanggal delivery paling awal terisi dulu (per customer + item + proses).
 * PO "Batal" tidak dihitung. PO "Selesai" (sudah dikirim) tetap memakai jatahnya supaya box lama tidak pindah ke PO baru.
 */
export function summarize(state: Pick<PoState, "items" | "pos" | "entries">, today: string): Summary {
  const boxOf = new Map(state.items.map((i) => [key(i.customer, i.itemId), i.pcsPerBox]));
  const made = new Map<string, number>();
  for (const e of state.entries) {
    const k = `${key(e.customer, e.itemId)}|${e.process}`;
    made.set(k, (made.get(k) ?? 0) + e.pcs);
  }
  const pos = state.pos.filter((p) => p.status !== "Batal").sort((a, b) => a.due.localeCompare(b.due) || a.row - b.row);
  const left = new Map(made);
  const rows: PoRow[] = pos.map((p) => {
    const pcsPerBox = boxOf.get(key(p.customer, p.itemId)) ?? 0;
    const proc = {} as Record<Process, ProcProgress>;
    for (const pr of PROCESSES) {
      const k = `${key(p.customer, p.itemId)}|${pr}`;
      const avail = Math.max(0, left.get(k) ?? 0);
      const done = p.status === "Selesai" ? p.qty : Math.min(p.qty, avail);
      left.set(k, avail - Math.min(p.qty, avail));
      const short = Math.max(0, p.qty - done);
      proc[pr] = { done, short, shortBox: pcsPerBox > 0 ? Math.ceil(short / pcsPerBox) : 0 };
    }
    const open = p.status === "Open" && PROCESSES.some((pr) => proc[pr].short > 0);
    const daysLeft = daysBetween(today, p.due);
    return { ...p, pcsPerBox, daysLeft, proc, open, level: levelOf(open, daysLeft) };
  });

  const byCust = new Map<string, PoRow[]>();
  for (const r of rows) (byCust.get(r.customer) ?? byCust.set(r.customer, []).get(r.customer)!).push(r);
  const customers: CustomerSum[] = [...byCust].map(([customer, rs]) => {
    const short = Object.fromEntries(
      PROCESSES.map((pr) => [pr, { pcs: rs.reduce((s, r) => s + (r.status === "Open" ? r.proc[pr].short : 0), 0), box: rs.reduce((s, r) => s + (r.status === "Open" ? r.proc[pr].shortBox : 0), 0) }]),
    ) as CustomerSum["short"];
    const openRows = rs.filter((r) => r.open);
    const worst = rs.reduce<PoRow["level"]>((w, r) => (LEVEL_RANK[r.level] < LEVEL_RANK[w] ? r.level : w), "done");
    return { customer, rows: rs, short, nextDue: openRows.length ? openRows[0].due : null, worst };
  });
  customers.sort((a, b) => LEVEL_RANK[a.worst] - LEVEL_RANK[b.worst] || (a.nextDue ?? "9").localeCompare(b.nextDue ?? "9") || a.customer.localeCompare(b.customer));

  const names = new Map(state.items.map((i) => [key(i.customer, i.itemId), i]));
  const surplus: Summary["surplus"] = [];
  for (const [k, pcs] of left) {
    if (pcs <= 0) continue;
    const [c, it, process] = k.split("|");
    const item = names.get(`${c}|${it}`);
    const e = state.entries.find((x) => key(x.customer, x.itemId) === `${c}|${it}`);
    surplus.push({ customer: item?.customer ?? e?.customer ?? c, itemId: item?.itemId ?? e?.itemId ?? it, itemName: item?.itemName ?? e?.itemName ?? it, process: process as Process, pcs });
  }
  return { rows, customers, surplus };
}

/** Sisa kurang untuk satu customer+item+proses (semua PO Open). */
export function shortFor(sum: Summary, customer: string, itemId: string, process: Process): { pcs: number; box: number; next?: PoRow } {
  const rs = sum.rows.filter((r) => r.status === "Open" && key(r.customer, r.itemId) === key(customer, itemId));
  const open = rs.filter((r) => r.proc[process].short > 0);
  return { pcs: open.reduce((s, r) => s + r.proc[process].short, 0), box: open.reduce((s, r) => s + r.proc[process].shortBox, 0), next: open[0] };
}

// ---------- Tempel PO dari Excel ----------

const norm = (s: string) => s.toUpperCase().replace(/[\s*_]+/g, "");

/** Cari item customer dari teks (Item Name atau Item ID, spasi/bintang diabaikan). */
export function findItem(items: CustItem[], customer: string, text: string): CustItem | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const own = items.filter((i) => key(i.customer, "") === key(customer, ""));
  return own.find((i) => norm(i.itemName) === t) ?? own.find((i) => norm(i.itemId) === t) ?? own.find((i) => norm(i.itemId).endsWith("-" + t));
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };
const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-11-05", "05/11/2026", "5-11-26", "5-Nov", "5 Nov 2026" -> yyyy-mm-dd. Tahun kosong = tahun ini/depan terdekat. */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t);
  let d: number, mo: number, y: number | undefined;
  if (m) {
    d = +m[1];
    mo = +m[2];
    y = m[3] ? +m[3] : undefined;
  } else {
    m = /^(\d{1,2})[\s/-]*([a-z]{3})[a-z]*[\s/-]*(\d{2,4})?$/.exec(t);
    if (!m || !MONTHS[m[2]]) return null;
    d = +m[1];
    mo = MONTHS[m[2]];
    y = m[3] ? +m[3] : undefined;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y !== undefined && y < 100) y += 2000;
  if (y === undefined) {
    y = +today.slice(0, 4);
    if (daysBetween(today, `${y}-${p2(mo)}-${p2(d)}`) < -60) y += 1;
  }
  return `${y}-${p2(mo)}-${p2(d)}`;
}

const qtyOf = (s: string) => {
  const v = Number(s.replace(/[.,\s](?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

export type PoDraft = { itemId: string; itemName: string; qty: number; due: string; noPo: string };
export type PasteResult = { ok: PoDraft[]; errors: string[] };

/**
 * Tempelan Excel, satu baris per PO: Item | Qty | Tgl delivery | No PO (opsional), dipisah TAB atau ";".
 * Qty boleh ditulis "5 box" untuk dikali Pcs/Box.
 */
export function parsePoPaste(text: string, items: CustItem[], customer: string, today: string): PasteResult {
  const ok: PoDraft[] = [];
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cols = raw.split(/\t|;/).map((c) => c.trim());
    if (cols.length < 3) {
      errors.push(`"${raw}": butuh minimal Item, Qty, Tanggal.`);
      continue;
    }
    const item = findItem(items, customer, cols[0]);
    if (!item) {
      if (!/item|part/i.test(cols[0])) errors.push(`"${cols[0]}": tidak ada di Master Customer ${customer}.`);
      continue;
    }
    const boxM = /^([\d.,]+)\s*box$/i.exec(cols[1]);
    const qty = boxM ? qtyOf(boxM[1]) * item.pcsPerBox : qtyOf(cols[1]);
    if (!(qty > 0)) {
      errors.push(`"${raw}": qty tidak terbaca.`);
      continue;
    }
    const due = parseDate(cols[2], today);
    if (!due) {
      errors.push(`"${raw}": tanggal delivery tidak terbaca.`);
      continue;
    }
    ok.push({ itemId: item.itemId, itemName: item.itemName, qty: Math.round(qty), due, noPo: cols[3] ?? "" });
  }
  return { ok, errors };
}
