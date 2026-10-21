// Akses Google Sheets API langsung dari server Vercel memakai Service Account.
// Sheet harus di-share (Editor) ke email Service Account.
import { importPKCS8, SignJWT } from "jose";

export class SheetsError extends Error {}

export type Render = "FORMATTED_VALUE" | "UNFORMATTED_VALUE";
export type Cell = string | number | boolean;
export type Grid = Cell[][];

/** Operasi Sheet yang dipakai aplikasi. Dibuat sempit supaya mudah diganti Sheet palsu di tes. */
export interface SheetsIO {
  /** Ambil beberapa range sekaligus. UNFORMATTED mengembalikan tanggal sebagai serial number. */
  get(ranges: string[], render: Render): Promise<Grid[]>;
  /** Tulis beberapa range sekaligus (USER_ENTERED: rumus dan tanggal ditafsirkan seperti diketik). */
  update(data: { range: string; values: Cell[][] }[]): Promise<void>;
  /** Tambah baris di akhir range (untuk tab tanpa rumus, mis. Antrian Validasi). */
  append(range: string, values: Cell[][]): Promise<void>;
  /** Jumlah baris grid per tab. */
  rowCounts(): Promise<Record<string, { sheetId: number; rows: number }>>;
  /** Tambah `count` baris di akhir tab; rumus baris terakhir ikut disalin, kolom input dikosongkan. */
  growSheet(title: string, count: number, clearCols: string[]): Promise<void>;
}

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new SheetsError("GOOGLE_SERVICE_ACCOUNT_JSON belum diisi di environment.");
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(text) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) throw new Error();
    return sa;
  } catch {
    throw new SheetsError("GOOGLE_SERVICE_ACCOUNT_JSON tidak valid. Tempel isi file JSON key Service Account apa adanya.");
  }
}

let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const sa = serviceAccount();
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new SheetsError(`Login Service Account ke Google gagal: ${body.error_description ?? body.error ?? res.status}`);
  token = { value: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

function sheetId(): string {
  const id = process.env.SHEET_ID;
  if (!id) throw new SheetsError("SHEET_ID belum diisi di environment.");
  return id;
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt < 2) continue;
      throw new SheetsError("Google Sheets tidak bisa dihubungi. Coba lagi sebentar.");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 403 || res.status === 404)
        throw new SheetsError(`Google Sheet tidak bisa dibuka (${msg}). Pastikan SHEET_ID benar dan Sheet di-share ke email Service Account.`);
      throw new SheetsError(`Google Sheets error: ${msg}`);
    }
    return body as T;
  }
}

const enc = (r: string) => encodeURIComponent(r);

export const googleSheets: SheetsIO = {
  async get(ranges, render) {
    const q = ranges.map((r) => `ranges=${enc(r)}`).join("&");
    const body = await api<{ valueRanges: { values?: Grid }[] }>(
      `/values:batchGet?${q}&valueRenderOption=${render}&dateTimeRenderOption=SERIAL_NUMBER`,
    );
    return body.valueRanges.map((v) => v.values ?? []);
  },
  async update(data) {
    if (!data.length) return;
    await api(`/values:batchUpdate`, { method: "POST", body: { valueInputOption: "USER_ENTERED", data } });
  },
  async append(range, values) {
    await api(`/values/${enc(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: { values },
    });
  },
  async rowCounts() {
    const body = await api<{ sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[] }>(
      `?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`,
    );
    return Object.fromEntries(body.sheets.map((s) => [s.properties.title, { sheetId: s.properties.sheetId, rows: s.properties.gridProperties.rowCount }]));
  },
  async growSheet(title, count, clearCols) {
    const meta = (await this.rowCounts())[title];
    if (!meta) throw new SheetsError(`Tab ${title} tidak ditemukan.`);
    const last = meta.rows;
    await api(`:batchUpdate`, {
      method: "POST",
      body: {
        requests: [
          { appendDimension: { sheetId: meta.sheetId, dimension: "ROWS", length: count } },
          {
            copyPaste: {
              source: { sheetId: meta.sheetId, startRowIndex: last - 1, endRowIndex: last },
              destination: { sheetId: meta.sheetId, startRowIndex: last, endRowIndex: last + count },
              pasteType: "PASTE_NORMAL",
            },
          },
        ],
      },
    });
    await api(`/values:batchClear`, {
      method: "POST",
      body: {
        ranges: clearCols.map((cols) => {
          const [c0, c1] = cols.split(":");
          return `'${title}'!${c0}${last + 1}:${c1}${last + count}`;
        }),
      },
    });
  },
};
