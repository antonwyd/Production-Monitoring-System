// v6.4: ucapan ulang tahun. Tanggal lahir di tab Users kolom I "Tanggal Ulang tahun".
import { serialToText } from "./dates";

/** Tanggal lahir -> "yyyy-MM-dd" (dari serial Sheets, "yyyy-mm-dd", "yyyy/m/d", atau "d/m/yyyy"); "" bila tidak terbaca. */
export function tanggalLahir(v: unknown): string {
  if (typeof v === "number" && v > 0) return serialToText(v);
  const t = String(v ?? "").trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

/** Apakah `date` (yyyy-MM-dd) hari ulang tahun? Lahir 29 Feb dirayakan 28 Feb di tahun bukan kabisat. */
export function ulangTahun(lahir: string, date: string): boolean {
  if (!lahir || !date) return false;
  const md = lahir.slice(5, 10),
    today = date.slice(5, 10);
  if (md === today) return true;
  const y = Number(date.slice(0, 4));
  const kabisat = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return md === "02-29" && !kabisat && today === "02-28";
}

export function ucapanUltah(nama: string): string {
  const depan = nama.trim().split(/\s+/)[0] || nama;
  return `Selamat ulang tahun, ${depan}! 🎉 Semoga sehat selalu, panjang umur, rezeki lancar, dan makin sukses. Terima kasih sudah jadi bagian dari tim QA!`;
}
