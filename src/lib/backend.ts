// Penghubung data untuk Dashboard & Report: memanggil logika Google Sheet (src/lib/sheets/qa.ts).
// Lapisan tipis ini memudahkan tes memakai data palsu tanpa Google Sheet.
import { SheetsError } from "./sheets/client";
import { apiLogin, apiMaster, apiQueue, apiRows, QaError } from "./sheets/qa";

export class BackendError extends Error {}

type Transport = (action: string, args: Record<string, unknown>) => Promise<unknown>;

async function directTransport(action: string, a: Record<string, unknown>): Promise<unknown> {
  try {
    switch (action) {
      case "master":
        return await apiMaster();
      case "login":
        return await apiLogin(String(a.nik ?? ""), String(a.pin ?? ""));
      case "queue":
        return await apiQueue(a as { status?: string; date?: string; member?: string });
      case "rows":
        return await apiRows(String(a.from ?? ""), String(a.to ?? ""));
    }
  } catch (e) {
    if (e instanceof QaError || e instanceof SheetsError) throw new BackendError(e.message);
    throw e;
  }
  throw new BackendError(`Aksi tidak dikenal: ${action}`);
}

let transport: Transport = directTransport;

/** Untuk tes: ganti sumber data dengan backend palsu di memori. */
export function setTransport(t: Transport | null) {
  transport = t ?? directTransport;
}

export async function callBackend<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await transport(action, args)) as T;
}

// ---------- Bentuk data ----------

export type RawMaster = {
  today: string;
  members: { nik: string; name: string; section?: string }[];
  categories: { name: string; process: string; ngGroup: string; ng: string[] }[];
  parts: { category: string; name: string; type: string; stki: number }[];
  machines: { category: string; mc: string; line: string; main: string; alt: string }[];
  lostTypes: { name: string; group: string }[];
  settings: { normalMin: number; otLimitHrs: number; target: number; gradeA: number; gradeB: number; gradeC: number; ngPpmMax?: number; utilTarget?: number; mcHrsDay?: number; mcHrsCat?: Record<string, number> };
};

/** Isi kiriman seperti yang disimpan v1 di kolom "Data" tab Antrian Validasi (pakai nama, bukan id). */
export type RawItem = {
  category: string;
  part: string;
  type: string;
  mc: string;
  normalQty: number | "";
  normalMin: number | "";
  otQty: number | "";
  otMin: number | "";
  lot: string;
  oiban: string;
  ng: (number | "")[];
};
export type RawLost = { type: string; minutes: number | ""; remarks: string };
export type RawMeta = { needsCheck?: boolean; warnings?: string[]; by?: string; via?: string };

export type RawSubmission = {
  id: string;
  sent: string; // yyyy-MM-dd HH:mm (Asia/Jakarta)
  date: string;
  member: string;
  parts: number;
  qty: number;
  ltMin: number;
  status: "Menunggu" | "Disetujui" | "Ditolak";
  leader: string;
  decided: string;
  note: string;
  items: RawItem[];
  lostTimes: RawLost[];
  edited: string;
  meta: RawMeta | null;
};

export type RawRows = {
  cols: string[];
  /** Waktu (ms) isi sheet ini dibaca dari Google; bisa lebih lama dari permintaan karena cache. */
  at?: number;
  // date, member, category, part, type, normalQty, normalMin, otQty, otMin, lot, oiban, mc, ng1..ng10, stki
  prod: (string | number)[][];
  // date, member, type, minutes, remarks
  lost: (string | number)[][];
};

export type RawLogin = { ok: boolean; inactive?: boolean; nik?: string; name?: string; role?: string };

/**
 * Kiriman Ditolak yang belum diperbaiki: tidak ada kiriman lain dari member itu untuk tanggal yang sama
 * yang dikirim sesudahnya. Member seperti ini tetap tampil "Ditolak" walau punya kiriman lain yang disetujui.
 */
export function openRejections(subs: RawSubmission[]): RawSubmission[] {
  return subs.filter((x) => x.status === "Ditolak" && !subs.some((y) => y !== x && y.member === x.member && y.date === x.date && y.sent > x.sent));
}
