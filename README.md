# Aplikasi Laporan Produksi QA

Aplikasi web Laporan Produksi QA untuk PT. Takai Seiki Indonesia. Operator mengisi laporan harian dari HP, leader memvalidasi, dan semua report terhitung otomatis dari data yang sudah disetujui.

```
HP / PC karyawan ──> Vercel (Next.js)
                       │  Google Sheets API + Service Account (hanya dari server)
                       ▼
                     Google Sheet = database
                     (Master Data, Leader, Users, Antrian Validasi, Input - Production, Input - Lost Time)
```

Tidak ada database lain dan tidak ada Apps Script. Struktur Google Sheet sama dengan versi Apps Script v1.5, jadi Dashboard dan tab Report di dalam Sheet tetap jalan.

## Halaman

| Halaman | Siapa | Isi |
| --- | --- | --- |
| `/` | member | Form laporan v1.5 apa adanya (pilih nama tanpa login, nama diingat di HP, banyak part per kiriman, MC per part, NG1–NG10, lost time otomatis 5S / Briefing / Input Laporan, riwayat 7 hari, edit kiriman yang masih Menunggu, perbaiki & kirim ulang yang ditolak) |
| `/?page=leader` | leader | Halaman leader v1.5 (nama + PIN dari tab **Leader**): Menunggu / Disetujui / Ditolak, edit, approve satu atau banyak, reject wajib alasan, link ke Dashboard |
| `/login` | leader, manajemen, admin | Login NIK + PIN dari tab **Users** (sesi 30 hari, rate limit 5x / 5 menit) |
| `/dashboard`, `/reports/*` | leader, manajemen, admin | Dashboard, Daily, Member, Category, Machine, NG per Type, NG per Lot, Laporan Bulanan. Export Excel dan Cetak / PDF |
| `/admin` | admin | Petunjuk dan link ke Google Sheet. Master data dan akun diubah langsung di sheet |

Halaman `/` disajikan dari `src/lib/legacyPage.ts` (HTML Code.gs v1.5). Panggilan `google.script.run` di halaman itu diganti `fetch('/api/rpc/<fungsi>')`, yang menjalankan logika yang sama di `src/lib/sheets/qa.ts`.

Rumus report: Total Qty = qty normal + qty OT; Rated Hours = (menit normal + menit OT) / 60; Std Hours = Total Qty / STKI; Achievement = Σ Std Hours / Σ Rated Hours; NG rate = NG / (Qty + NG). Report membaca tab Input - Production / Input - Lost Time (kiriman yang disetujui + baris yang diisi langsung di sheet), dengan cache 1 menit di server.

## Menyiapkan Google Service Account (sekali saja)

1. Buka [console.cloud.google.com](https://console.cloud.google.com), buat project (mis. `laporan-qa`).
2. **APIs & Services → Library**, cari **Google Sheets API**, klik **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (mis. `laporan-qa`), lewati langkah peran, **Done**.
4. Buka service account itu → tab **Keys → Add key → Create new key → JSON**. File JSON terunduh; simpan baik-baik, jangan dibagikan.
5. Buka Google Sheet → **Share**, tambahkan email service account (berakhiran `@...iam.gserviceaccount.com`) sebagai **Editor**.

## Environment variable (Vercel → Settings → Environment Variables, atau `.env.local`)

- `GOOGLE_SERVICE_ACCOUNT_JSON` = isi file JSON key dari langkah 4 (tempel apa adanya)
- `SHEET_ID` = ID Google Sheet (bagian URL di antara `/d/` dan `/edit`)
- `SESSION_SECRET` = string acak panjang
- `SHEET_URL` (opsional) = link Google Sheet untuk tombol di halaman Admin

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tes Master Data, alur kirim → edit → approve → report, login, dengan Google Sheet palsu
```

Domain kantor (mis. `produksi.tki.co.id`) dipasang di Vercel → Settings → Domains, dengan record CNAME dari pengelola DNS tki.co.id.

## Struktur

```
src/lib/sheets/client.ts  Google Sheets API (token Service Account, baca/tulis range)
src/lib/sheets/qa.ts      Logika Code.gs: master, kirim, riwayat, antrian, edit, approve/reject, login, data report
src/lib/legacy.ts         Menyajikan halaman form/leader v1.5 dan mengganti google.script.run
src/app/route.ts          Halaman / (form member) dan /?page=leader
src/app/api/rpc/[fn]      Pengganti google.script.run
src/lib/reports.ts        Semua report
src/lib/rules.ts          Rumus metrik dan grade
tests/                    Tes dengan Google Sheet palsu (tests/fakeSheet.ts)
```

## Catatan

- Apps Script memakai LockService saat approve. Di Vercel kiriman dan approve diproses bergantian per server; dua approve di detik yang sama dari server berbeda masih mungkin bertabrakan, tapi risikonya kecil dengan 1–2 leader.
- Master Data dibaca ulang paling lambat tiap 1 menit.
- Belum dibuat: notifikasi, ganti PIN sendiri, drill-down klik di report.
