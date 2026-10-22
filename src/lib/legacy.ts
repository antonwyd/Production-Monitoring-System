// Menyajikan halaman form member & leader v1.5 dari Vercel. Panggilan google.script.run
// di halaman itu diganti fetch ke /api/rpc/<fungsi>, yang menjalankan logika yang sama
// (src/lib/sheets/qa.ts) langsung ke Google Sheet.
import { PAGE_HTML } from "./legacyPage";

export const APP_VERSION = "v2.2 • Vercel";

const CALL_V1 = "function call(fn,args,ok,fail){";
const CALL_WEB = `function call(fn,args,ok,fail){
  var f=fail||showErr;
  fetch('/api/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||[])})
    .then(function(r){return r.json();})
    .then(function(j){if(j&&j.ok){ok&&ok(j.data);}else{f((j&&j.error)||'Gagal memproses.');}})
    .catch(function(){f('Tidak ada koneksi internet. Coba lagi.');});
  return;`;
const LEADER_BAR = `+'<span style="font-size:12px;color:var(--muted);margin-left:auto">Masuk sebagai`;
const LEADER_BAR_WEB = `+'<a class="btn ghost" href="/hari-ini" style="height:42px;display:inline-flex;align-items:center;text-decoration:none">Hari Ini &amp; Laporan</a>'${LEADER_BAR}`;

for (const s of [CALL_V1, LEADER_BAR, "%%VERSI%%", "<head>"])
  if (!PAGE_HTML.includes(s)) throw new Error(`legacyPage: penanda "${s}" tidak ditemukan`);

export function renderLegacyPage(boot: { page: string; m?: unknown }) {
  const json = JSON.stringify({ page: boot.page, url: "/", m: boot.m ?? null }).replace(/</g, "\\u003c");
  return PAGE_HTML.replace("%%VERSI%%", APP_VERSION)
    .replace(CALL_V1, CALL_WEB)
    .replace(LEADER_BAR, LEADER_BAR_WEB)
    .replace(
      "<head>",
      `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><title>Laporan Produksi QA • Takai</title><link rel="icon" href="/icon.svg"><script>window.BOOT=${json};</script>`,
    );
}
