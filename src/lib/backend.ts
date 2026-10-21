// Penghubung ke Google Apps Script (backend) yang membaca dan menulis Google Sheet.
// Dipanggil hanya dari server Next.js, jadi APPS_SCRIPT_KEY tidak pernah sampai ke browser.

export class BackendError extends Error {}

type Transport = (action: string, args: Record<string, unknown>) => Promise<unknown>;

async function httpTransport(action: string, args: Record<string, unknown>): Promise<unknown> {
  const url = process.env.APPS_SCRIPT_URL;
  const key = process.env.APPS_SCRIPT_KEY;
  if (!url || !key) throw new BackendError("APPS_SCRIPT_URL dan APPS_SCRIPT_KEY belum diisi di environment.");
  let res: Response;
  try {
    // text/plain: Apps Script membaca isi body apa adanya (e.postData.contents).
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key, action, args }),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new BackendError("Google Apps Script tidak bisa dihubungi. Coba lagi sebentar.");
  }
  const text = await res.text();
  let body: { ok?: boolean; data?: unknown; error?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new BackendError(`Apps Script tidak membalas JSON (HTTP ${res.status}). Cek deploy web app dan aksesnya "Anyone".`);
  }
  if (!body.ok) throw new BackendError(body.error || "Apps Script mengembalikan error.");
  return body.data;
}

let transport: Transport = httpTransport;

/** Untuk tes: ganti Apps Script dengan backend palsu di memori. */
export function setTransport(t: Transport | null) {
  transport = t ?? httpTransport;
}

export async function callBackend<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await transport(action, args)) as T;
}

// ---------- Bentuk data dari Apps Script ----------

export type RawMaster = {
  today: string;
  members: { nik: string; name: string }[];
  categories: { name: string; process: string; ngGroup: string; ng: string[] }[];
  parts: { category: string; name: string; type: string; stki: number }[];
  machines: { category: string; mc: string; line: string; main: string; alt: string }[];
  lostTypes: { name: string; group: string }[];
  settings: { normalMin: number; otLimitHrs: number; target: number; gradeA: number; gradeB: number; gradeC: number };
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
  // date, member, category, part, type, normalQty, normalMin, otQty, otMin, lot, oiban, mc, ng1..ng10, stki
  prod: (string | number)[][];
  // date, member, type, minutes, remarks
  lost: (string | number)[][];
};

export type RawLogin = { ok: boolean; inactive?: boolean; nik?: string; name?: string; role?: string };
