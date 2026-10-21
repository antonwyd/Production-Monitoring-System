# Aplikasi Laporan Produksi QA

Tampilan web Laporan Produksi QA untuk PT. Takai Seiki Indonesia. Operator mengisi laporan harian dari HP, leader memvalidasi, dan semua report terhitung otomatis dari data yang sudah disetujui.

```
HP / PC karyawan ──> Vercel (Next.js: form, validasi leader, dashboard, report, export)
                       │  POST JSON + APPS_SCRIPT_KEY (hanya dari server)
                       ▼
                     Google Apps Script (Code.gs: login, validasi, tulis/baca data)
                       ▼
                     Google Sheet (database: Master Data, Users, Antrian Validasi, Input - Production, Input - Lost Time)
```

Tidak ada database lain. Kiriman disimpan di tab "Antrian Validasi" dalam format yang sama dengan form Apps Script v1, sehingga form lama dan web ini bisa dipakai bersamaan selama masa transisi.

## Fitur

| Halaman | Peran | Isi |
| --- | --- | --- |
| `/login` | semua | Login NIK + PIN (PIN di-hash, sesi tersimpan 30 hari, rate limit 5x / 5 menit) |
| `/form` | operator, leader, admin | Form HP: banyak part per kiriman, picker layar penuh dengan cari, MC dikelompokkan (mesin untuk part ini / bisa ganti type / lain), NG1–NG10 dengan label sesuai NG group, lost time / another job, bar bawah (qty, menit normal, sisa dari 480, OT), tombol "Isi sisa ke lost time", draft otomatis di HP, layar ringkasan sebelum kirim, daftar kiriman hari itu beserta status dan alasan reject |
| `/leader` | leader, admin | Tab Menunggu / Disetujui / Ditolak, filter tanggal, detail per part, tanda **Perlu dicek**, approve satu atau banyak, reject wajib alasan. Leader melihat semua member |
| `/dashboard`, `/reports/*` | leader, manajemen, admin | Dashboard, Daily, Member, Category, Machine, NG per Type, NG per Lot, Laporan Bulanan. Export Excel dan Cetak / PDF |
| `/admin` | admin | Petunjuk dan link ke Google Sheet. Master data dan akun diubah langsung di sheet (tab Master Data dan Users) |

Aturan bisnis R1–R16 ada di `src/lib/rules.ts` dan dipakai di form **dan** di server, jadi server selalu mengulang semua validasi form.

Rumus metrik (bagian 9 PRD): Total Qty = qty normal + qty OT; Rated Hours = (menit normal + menit OT) / 60; Std Hours = Total Qty / STKI; Achievement = Σ Std Hours / Σ Rated Hours (bukan rata-rata persen); NG rate = NG / (Qty + NG). STKI disimpan sebagai snapshot saat approve, sehingga perubahan STKI tidak mengubah report bulan lalu.

## Menyiapkan Apps Script

1. Tempel `apps-script/Code.gs` versi v1.6 atau lebih baru ke project Apps Script milik Google Sheet, lalu **Deploy → Manage deployments → Edit → New version** (URL /exec tetap). Akses web app harus **Anyone**.
2. Di Google Sheet, menu **Laporan QA → Buat API key untuk Vercel**. Salin key yang muncul.
3. Akun login ada di tab **Users**: NIK | Nama | Peran (operator, leader, manajemen, admin) | PIN | Status | Keterangan. Nama operator harus sama dengan nama di Master Data agar laporan tercatat atas namanya.

## Menjalankan di komputer

Butuh Node.js 20+. Salin `.env.example` ke `.env.local` lalu isi:

- `APPS_SCRIPT_URL` = URL web app (berakhiran `/exec`)
- `APPS_SCRIPT_KEY` = key dari langkah 2 di atas
- `SESSION_SECRET` = string acak panjang
- `SHEET_URL` (opsional) = link Google Sheet untuk tombol di halaman Admin

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tes aturan + alur kirim → approve → report dengan Apps Script palsu
```

## Produksi (Vercel)

Isi environment variable yang sama di Vercel (Project → Settings → Environment Variables), lalu deploy. Domain kantor (mis. `produksi.tki.co.id`) dipasang di Project → Settings → Domains, dengan record CNAME dari pengelola DNS tki.co.id.

## Struktur

```
src/lib/backend.ts      Panggilan ke Apps Script (doPost) dan bentuk datanya
src/lib/ids.ts          Id tetap dari nama (sheet tidak punya id baris)
src/lib/rules.ts        Aturan R1–R16, pencocokan part/mesin, rumus metrik
src/lib/service.ts      Master, kirim laporan, antrian, approve/reject
src/lib/reports.ts      Semua report (dari Input - Production / Input - Lost Time)
src/app/api/...         API untuk browser
tests/                  Tes aturan dan alur kirim → approve → report (`npm test`)
```

## Keputusan untuk isu terbuka PRD

Diambil supaya bisa mulai coding; semuanya bisa diubah.

- Login operator: NIK + PIN (rekomendasi PRD). Operator hanya bisa kirim atas nama member yang terhubung ke akunnya.
- NG disimpan sebagai 10 kolom tetap (`ng1`–`ng10`) agar migrasi dari sheet v1 mudah.
- Satu baris part = satu MC. Untuk Drum PF yang memakai banyak MC, tambahkan baris part per MC.
- Leader belum bisa mengedit angka operator; leader reject dengan alasan lalu operator kirim ulang.
- Kiriman dobel (member + tanggal yang sudah punya laporan Disetujui) dan qty di luar 30–150% STKI hanya peringatan. Kiriman dobel juga ditandai Perlu dicek.

## Belum dibuat

- Edit kiriman oleh leader / member dan riwayat 7 hari di web (sudah ada di form Apps Script v1.5).
- STKI belum di-snapshot saat approve: report memakai kolom STKI di Input - Production.
- Mode offline penuh (PWA kirim otomatis saat online). Draft sudah tersimpan di HP.
- Notifikasi reject ke operator dan antrian ke leader, email laporan bulanan otomatis (cron).
- Batalkan approve, ganti PIN sendiri, drill-down klik di report, report dalam Bahasa Inggris.
