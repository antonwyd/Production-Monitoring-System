// Edit Master Data, Users, dan Leader dari web (khusus admin).
// Hanya kolom isian yang ditulis; kolom rumus (Key, Flag, UKey, Std Key, daftar otomatis) tidak disentuh,
// jadi struktur dan report di Google Sheet tetap jalan seperti biasa.
import type { Cell, Grid } from "./client";
import { clearMasterCache, QaError, sheetsIO } from "./qa";

export type FieldKind = "text" | "number" | "pct" | "status" | "select" | "auto";
export type Field = { key: string; label: string; kind: FieldKind; options?: string[]; required?: boolean; width?: number; hint?: string };
export type MasterTable = {
  id: string;
  title: string;
  desc: string;
  sheet: string;
  fields: Field[];
  /** Kolom pertama di sheet (huruf) dan baris pertama data. */
  col: string;
  firstRow: number;
  maxRows: number;
  /** Kunci unik (gabungan field) untuk cek duplikat. */
  unique?: string[][];
  /** Baris tetap (tidak bisa tambah/hapus), mis. Setting. */
  fixed?: boolean;
};
export type TableData = { rows: Record<string, string>[]; version: string; options: Record<string, string[]> };

const MD = "Master Data";
const STATUS_MD = ["Active", "Inactive"];

/** Daftar tabel yang bisa diedit. Posisi kolom sama persis dengan Google Sheet. */
export const MASTER_TABLES: MasterTable[] = [
  {
    id: "member",
    title: "Member",
    desc: "Nama member di form. Member yang keluar cukup diubah ke Inactive supaya riwayatnya tetap ada.",
    sheet: MD,
    col: "B",
    firstRow: 7,
    maxRows: 290,
    fields: [
      { key: "nik", label: "NIK", kind: "text", width: 110 },
      { key: "name", label: "Nama member", kind: "text", required: true, width: 240 },
      { key: "status", label: "Status", kind: "status", options: STATUS_MD, width: 110 },
    ],
    unique: [["name"], ["nik"]],
  },
  {
    id: "part",
    title: "Part & STKI",
    desc: "Part per kategori dan standar STKI (pcs/jam). Proses terisi otomatis dari kategori.",
    sheet: MD,
    col: "F",
    firstRow: 7,
    maxRows: 290,
    fields: [
      { key: "no", label: "No", kind: "auto", width: 60 },
      { key: "category", label: "Kategori", kind: "select", required: true, width: 190 },
      { key: "process", label: "Proses", kind: "auto", width: 110 },
      { key: "part", label: "Part", kind: "text", required: true, width: 170 },
      { key: "type", label: "Type", kind: "text", width: 80 },
      { key: "stki", label: "STKI (pcs/jam)", kind: "number", required: true, width: 120 },
    ],
    unique: [["category", "part", "type"]],
  },
  {
    id: "category",
    title: "Kategori",
    desc: "Kategori proses yang muncul di form. Setelah menambah kategori, isi juga Grup NG per kategori.",
    sheet: MD,
    col: "P",
    firstRow: 7,
    maxRows: 0, // dihitung: sampai baris di atas judul "Lost Time Type"
    fields: [
      { key: "name", label: "Kategori", kind: "text", required: true, width: 220 },
      { key: "process", label: "Proses", kind: "text", required: true, width: 150 },
    ],
    unique: [["name"]],
  },
  {
    id: "lost",
    title: "Jenis Lost Time",
    desc: "Pilihan lost time di form. Grup menentukan dihitung sebagai Lost Time atau Another Job.",
    sheet: MD,
    col: "P",
    firstRow: 0, // dihitung: baris setelah judul "Lost Time Type"
    maxRows: 0, // sampai baris 60 (batas validasi Input - Lost Time)
    fields: [
      { key: "name", label: "Jenis", kind: "text", required: true, width: 240 },
      { key: "group", label: "Grup", kind: "select", options: ["Lost Time", "Another Job"], required: true, width: 150 },
    ],
    unique: [["name"]],
  },
  {
    id: "machine",
    title: "Mesin (MC)",
    desc: "Daftar mesin per kategori. Ubah Status ke Inactive untuk menyembunyikan dari form.",
    sheet: MD,
    col: "AN",
    firstRow: 7,
    maxRows: 190,
    fields: [
      { key: "no", label: "No", kind: "auto", width: 60 },
      { key: "category", label: "Kategori", kind: "select", required: true, width: 180 },
      { key: "mc", label: "MC No", kind: "text", required: true, width: 90 },
      { key: "line", label: "Line", kind: "text", width: 90 },
      { key: "main", label: "Part utama", kind: "text", width: 150 },
      { key: "alt", label: "Bisa ganti ke", kind: "text", width: 200, hint: "pisahkan dengan koma" },
      { key: "status", label: "Status", kind: "status", options: STATUS_MD, width: 110 },
    ],
    unique: [["category", "mc"]],
  },
  {
    id: "ng",
    title: "Jenis NG",
    desc: "Nama NG per grup NG. Urutan di dalam grup = NG 1 sampai 10 di form, jadi jangan diacak setelah ada data. Maksimal 20 baris.",
    sheet: MD,
    col: "AZ",
    firstRow: 7,
    maxRows: 20,
    fields: [
      { key: "code", label: "Kode", kind: "auto", width: 60 },
      { key: "group", label: "Grup NG", kind: "text", required: true, width: 150 },
      { key: "name", label: "Nama NG", kind: "text", required: true, width: 220 },
    ],
    unique: [["group", "name"]],
  },
  {
    id: "nggroup",
    title: "Grup NG per kategori",
    desc: "Grup NG yang dipakai tiap kategori (menentukan nama NG 1-10 di form).",
    sheet: MD,
    col: "BD",
    firstRow: 7,
    maxRows: 14,
    fields: [
      { key: "category", label: "Kategori", kind: "select", required: true, width: 220 },
      { key: "group", label: "Grup NG", kind: "select", required: true, width: 160 },
    ],
    unique: [["category"]],
  },
  {
    id: "stdmc",
    title: "Standar MC (PF)",
    desc: "Standar mesin PF (pcs/jam per MC), terpisah dari STKI. Dipakai untuk efisiensi Mesin PF.",
    sheet: MD,
    col: "BI",
    firstRow: 7,
    maxRows: 390,
    fields: [
      { key: "category", label: "Kategori", kind: "select", required: true, width: 170 },
      { key: "part", label: "Part", kind: "text", required: true, width: 170 },
      { key: "type", label: "Type", kind: "text", width: 80 },
      { key: "std", label: "Std MC (pcs/jam per MC)", kind: "number", width: 170 },
    ],
    unique: [["category", "part", "type"]],
  },
  {
    id: "setting",
    title: "Setting",
    desc: "Jam kerja normal, batas lembur, target achievement, batas grade, batas NG (PPM), target utilisasi mesin, dan jam tersedia mesin per hari (8 = 1 shift, 16 = 2 shift; baris \"- Kategori\" berlaku untuk kategori itu saja). Persen ditulis 100 untuk 100%.",
    sheet: MD,
    col: "S",
    firstRow: 7,
    maxRows: 24,
    fixed: true,
    fields: [
      { key: "param", label: "Parameter", kind: "auto", width: 280 },
      { key: "value", label: "Nilai", kind: "number", width: 120 },
    ],
  },
  {
    id: "users",
    title: "Akun & hak akses",
    desc: "Login web dengan NIK + PIN. Admin: semua menu termasuk Master Data. Leader: Hari Ini (validasi) dan semua laporan. Manajemen: lihat laporan saja.",
    sheet: "Users",
    col: "A",
    firstRow: 2,
    maxRows: 400,
    fields: [
      { key: "nik", label: "NIK", kind: "text", required: true, width: 110 },
      { key: "name", label: "Nama", kind: "text", required: true, width: 220 },
      { key: "role", label: "Peran", kind: "select", options: ["operator", "leader", "manajemen", "admin"], required: true, width: 130 },
      { key: "pin", label: "PIN", kind: "text", required: true, width: 90 },
      { key: "status", label: "Status", kind: "status", options: ["Aktif", "Nonaktif"], width: 110 },
      { key: "note", label: "Keterangan", kind: "text", width: 200 },
    ],
    unique: [["nik"]],
  },
  {
    id: "leader",
    title: "PIN halaman validasi",
    desc: "Nama dan PIN untuk halaman validasi lama (/?page=leader).",
    sheet: "Leader",
    col: "A",
    firstRow: 2,
    maxRows: 30,
    fields: [
      { key: "name", label: "Nama leader", kind: "text", required: true, width: 220 },
      { key: "pin", label: "PIN", kind: "text", required: true, width: 100 },
      { key: "note", label: "Keterangan", kind: "text", width: 200 },
    ],
    unique: [["name"]],
  },
];

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const colNum = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => {
  let out = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
};
const q = (t: string) => `'${t}'`;
/** Angka dari ketikan orang: "6.656" / "6,656" (ribuan) = 6656, "1,5" = 1.5, "100%" = 100. */
export function parseNum(v: string): number {
  const x = v.replace(/[%\s]/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return Number(x.replace(/[.,]/g, ""));
  return Number(x.replace(",", "."));
}
const isPctSetting = (param: string) => /target|grade/i.test(param);

/** Baris judul "Lost Time Type" di kolom P memisahkan daftar kategori dan daftar lost time. */
async function layout(t: MasterTable): Promise<{ firstRow: number; maxRows: number }> {
  if (t.id !== "category" && t.id !== "lost") return { firstRow: t.firstRow, maxRows: t.maxRows };
  const [g] = await sheetsIO().get([`${q(MD)}!P7:P80`], "FORMATTED_VALUE");
  const idx = g.findIndex((r) => s(r[0]) === "Lost Time Type");
  if (idx < 0) throw new QaError('Judul "Lost Time Type" di Master Data kolom P tidak ditemukan.');
  const header = 7 + idx;
  // Judul bagian (mis. "⏱️ LOST TIME TYPES") tepat di atas "Lost Time Type" bukan bagian daftar kategori.
  const catEnd = idx > 0 && s(g[idx - 1]?.[0]) ? header - 1 : header;
  return t.id === "category" ? { firstRow: 7, maxRows: catEnd - 7 } : { firstRow: header + 1, maxRows: 60 - header };
}

function rangeOf(t: MasterTable, firstRow: number, rows: number, width = t.fields.length) {
  const c0 = colNum(t.col);
  return `${q(t.sheet)}!${t.col}${firstRow}:${colName(c0 + width - 1)}${firstRow + rows - 1}`;
}

function toRows(t: MasterTable, g: Grid, maxRows: number) {
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(g.length, maxRows); i++) {
    const r = g[i] ?? [];
    const row: Record<string, string> = {};
    t.fields.forEach((f, j) => (row[f.key] = s(r[j])));
    if (t.fixed) row._row = String(i);
    if (t.fixed ? row[t.fields[0].key] : t.fields.some((f) => f.kind !== "auto" && row[f.key])) rows.push(row);
  }
  if (t.id === "lost") rows.forEach((r) => (r.group = /another/i.test(r.group) ? "Another Job" : "Lost Time"));
  return rows;
}

function hash(rows: Record<string, string>[]) {
  const text = JSON.stringify(rows);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${rows.length}-${(h >>> 0).toString(36)}`;
}

async function readTable(t: MasterTable) {
  const L = await layout(t);
  const [g] = await sheetsIO().get([rangeOf(t, L.firstRow, L.maxRows)], "UNFORMATTED_VALUE");
  const rows = toRows(t, g, L.maxRows);
  // Persen di Setting ditampilkan 100, bukan 1.
  if (t.id === "setting") rows.forEach((r) => r.value !== "" && isPctSetting(r.param) && (r.value = String(Math.round(Number(r.value) * 10000) / 100)));
  return { L, rows };
}

export async function getMasterTable(id: string): Promise<TableData> {
  const t = MASTER_TABLES.find((x) => x.id === id);
  if (!t) throw new QaError("Tabel tidak dikenal.");
  const [{ rows }, cats, ng] = await Promise.all([
    readTable(t),
    readTable(MASTER_TABLES.find((x) => x.id === "category")!),
    readTable(MASTER_TABLES.find((x) => x.id === "ng")!),
  ]);
  const options: Record<string, string[]> = {};
  for (const f of t.fields) {
    if (f.options) options[f.key] = f.options;
    else if (f.kind === "select" && f.key === "category") options[f.key] = cats.rows.map((r) => r.name);
    else if (f.kind === "select" && f.key === "group") options[f.key] = [...new Set(ng.rows.map((r) => r.group))];
  }
  return { rows, version: hash(rows), options };
}

/** Simpan seluruh isi tabel. Ditolak bila sheet sudah diubah orang lain sejak halaman dibuka. */
export async function saveMasterTable(id: string, version: string, input: Record<string, unknown>[]) {
  const t = MASTER_TABLES.find((x) => x.id === id);
  if (!t) throw new QaError("Tabel tidak dikenal.");
  const { L, rows: current } = await readTable(t);
  if (hash(current) !== version) throw new QaError("Data ini baru saja diubah di Google Sheet atau oleh orang lain. Muat ulang halaman, lalu ulangi perubahan Anda.");

  const rows: Record<string, string>[] = input
    .map((r): Record<string, string> => ({ ...Object.fromEntries(t.fields.map((f) => [f.key, s(r[f.key])])), ...(t.fixed ? { _row: s(r._row) } : {}) }))
    .filter((r) => t.fields.some((f) => f.kind !== "auto" && r[f.key]));
  if (t.fixed && rows.length !== current.length) throw new QaError("Baris setting tidak boleh ditambah atau dihapus.");
  if (rows.length > L.maxRows) throw new QaError(`Maksimal ${L.maxRows} baris untuk ${t.title}.`);

  const errors: string[] = [];
  const cats = id === "part" || id === "machine" || id === "nggroup" || id === "stdmc" ? (await readTable(MASTER_TABLES.find((x) => x.id === "category")!)).rows : [];
  rows.forEach((r, i) => {
    for (const f of t.fields) {
      const v = r[f.key];
      if (f.required && !v && f.kind !== "auto") errors.push(`Baris ${i + 1}: ${f.label} wajib diisi.`);
      if (v && (f.kind === "number" || f.kind === "pct") && Number.isNaN(parseNum(v))) errors.push(`Baris ${i + 1}: ${f.label} harus angka.`);
      if (v && f.options && f.kind !== "status" && !f.options.includes(v)) errors.push(`Baris ${i + 1}: ${f.label} harus salah satu dari ${f.options.join(", ")}.`);
      if (v && f.kind === "select" && f.key === "category" && !cats.some((c) => c.name === v)) errors.push(`Baris ${i + 1}: kategori "${v}" tidak ada di tabel Kategori.`);
    }
  });
  for (const keys of t.unique ?? []) {
    const seen = new Map<string, number>();
    rows.forEach((r, i) => {
      const k = keys.map((x) => r[x].toLowerCase()).join("|");
      if (!keys.some((x) => r[x])) return;
      if (seen.has(k)) errors.push(`Baris ${i + 1} sama dengan baris ${seen.get(k)! + 1} (${keys.map((x) => t.fields.find((f) => f.key === x)!.label).join(" + ")}).`);
      else seen.set(k, i);
    });
  }
  if (errors.length) throw new QaError(errors.slice(0, 8).join(" "));

  // Nomor urut dan proses diisi otomatis.
  const procOf = new Map(cats.map((c) => [c.name, c.process]));
  const values: Cell[][] = rows.map((r, i) =>
    t.fields.map((f) => {
      if (t.fixed && f.kind === "auto") return null as unknown as Cell; // tidak ditulis
      if (f.key === "no") return i + 1;
      if (id === "part" && f.key === "process") return procOf.get(r.category) ?? r.process ?? "";
      if (id === "ng" && f.key === "code") return i + 1;
      const v = r[f.key];
      if (v === "") return "";
      if (f.kind === "number") {
        const n = parseNum(v);
        // Setting persen (target, grade) disimpan sebagai pecahan, mis. 100 → 1.
        return id === "setting" && isPctSetting(r.param) ? n / 100 : n;
      }
      // Angka bulat tanpa nol di depan (NIK, PIN, part "604") tetap angka seperti aslinya; teks lain apa adanya.
      return /^[1-9]\d{0,14}$/.test(v) ? Number(v) : `'${v}`;
    }),
  );
  const data: { range: string; values: Cell[][] }[] = [];
  if (t.fixed) {
    // Hanya kolom Nilai, di baris aslinya masing-masing.
    const vi = t.fields.findIndex((f) => f.key === "value");
    const c = colName(colNum(t.col) + vi);
    rows.forEach((r, i) => {
      const at = L.firstRow + Number(current.find((x) => x._row === r._row && x.param === r.param)?._row ?? NaN);
      if (Number.isNaN(at)) throw new QaError("Baris setting tidak cocok. Muat ulang halaman.");
      data.push({ range: `${q(t.sheet)}!${c}${at}`, values: [[values[i][vi]]] });
    });
  } else {
    // Tulis semua baris + kosongkan sisa baris lama di bawahnya.
    const n = Math.max(current.length, rows.length);
    const width = t.fields.length;
    const blank = () => Array.from({ length: width }, () => "" as Cell);
    const out = Array.from({ length: n }, (_, i) => values[i] ?? blank());
    if (n) data.push({ range: rangeOf(t, L.firstRow, n), values: out });
  }
  await sheetsIO().update(data);
  clearMasterCache();
  return { ok: true, rows: rows.length };
}
