// Menyajikan halaman form member & leader dari Vercel. Panggilan google.script.run
// di halaman itu diganti fetch ke /api/rpc/<fungsi>, yang menjalankan logika yang sama
// (src/lib/sheets/qa.ts) langsung ke Google Sheet.
import { PAGE_HTML } from "./legacyPage";
import { tipHari } from "./level";
import { todayJakarta } from "./dates";

export const APP_VERSION = "v6.5"; // v6.5: pesan setelah kirim per hari kerja (Senin pantun kehidupan, Selasa penyemangat, Rabu jenaka, Kamis peribahasa, Jumat tebak-tebakan; Sabtu/Minggu kosong), L juga dapat (pengingat sholat dihapus); v6.4: ucapan ulang tahun (Users kolom I) di form, layar kirim, halaman leader & dashboard; v6.3: poin jam kirim (maks 30 menit setelah jam kerja selesai = 16:00 + menit lembur, +2; lewat -1), ditolak/diedit leader -1, NG rate tidak dipakai, bonus streak +5 per 5 laporan sempurna; v6.2: karakter member + level (poin harian & syarat kualitas 30 hari, Users kolom H) (tips harian dimatikan dulu); v6.1: pesan setelah kirim (pantun untuk P, pengingat sholat untuk L, Users kolom G); v6.0: Sabtu/Minggu = hari libur, semua kerja OT (batas OT libur 12 jam); v5.9: halaman leader per tanggal (default hari ini); v5.8: lost time bisa ditandai Lembur (OT)

const CALL_V1 = "function call(fn,args,ok,fail){";
const CALL_WEB = `function call(fn,args,ok,fail){
  var f=fail||showErr;
  fetch('/api/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||[])})
    .then(function(r){return r.json();})
    .then(function(j){if(j&&j.ok){ok&&ok(j.data);}else{f((j&&j.error)||'Gagal memproses.');}})
    .catch(function(){f('Tidak ada koneksi internet. Coba lagi.');});
  return;`;
for (const s of [CALL_V1, "%%VERSI%%", "<head>"])
  if (!PAGE_HTML.includes(s)) throw new Error(`legacyPage: penanda "${s}" tidak ditemukan`);

export type LegacyUser = { name: string; nik: string; lock: boolean; leader?: boolean; home?: string };

export function renderLegacyPage(boot: { page: string; m?: unknown; user?: LegacyUser | null }) {
  const json = JSON.stringify({ page: boot.page, url: "/", m: boot.m ?? null, user: boot.user ?? null, tip: tipHari(todayJakarta()) }).replace(/</g, "\\u003c");
  return PAGE_HTML.replace("%%VERSI%%", APP_VERSION)
    .replace(CALL_V1, CALL_WEB)
    .replace(
      "<head>",
      `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><title>QA Production • Takai</title><meta name="theme-color" content="#9b1b1f"><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=3"><link rel="apple-touch-icon" href="/icon-192.png?v=3"><link rel="manifest" href="/${boot.page === "leader" ? "manifest-leader" : "manifest"}.webmanifest"><script>window.BOOT=${json};</script>`,
    );
}
