# Aplikasi Laporan Produksi QA

Web app pengganti v1 (Google Apps Script + Google Sheet) untuk PT. Takai Seiki Indonesia, dibangun dari PRD "Aplikasi Laporan Produksi QA". Operator mengisi laporan harian dari HP, leader memvalidasi, dan semua report terhitung otomatis dari data yang sudah disetujui.

## Fitur

| Halaman | Peran | Isi |
| --- | --- | --- |
| `/login` | semua | Login NIK + PIN (PIN di-hash, sesi tersimpan 30 hari, rate limit 5x / 5 menit) |
| `/form` | operator, leader, admin | Form HP: banyak part per kiriman, picker layar penuh dengan cari, MC dikelompokkan (mesin untuk part ini / bisa ganti type / lain), NG1–NG10 dengan label sesuai NG group, lost time / another job, bar bawah (qty, menit normal, sisa dari 480, OT), tombol "Isi sisa ke lost time", draft otomatis di HP, layar ringkasan sebelum kirim, daftar kiriman hari itu beserta status dan alasan reject |
| `/leader` | leader, admin | Tab Menunggu / Disetujui / Ditolak, filter tanggal, detail per part, tanda **Perlu dicek**, approve satu atau banyak, reject wajib alasan. Leader hanya melihat member di areanya |
| `/dashboard`, `/reports/*` | leader, manajemen, admin | Dashboard, Daily, Member, Category, Machine, NG per Type, NG per Lot, Laporan Bulanan. Export Excel dan Cetak / PDF |
| `/admin` | admin | Kelola member, user & peran, kategori, part & STKI, mesin, jenis lost time, kode NG, NG group, setting. Data tidak dihapus, cukup dinonaktifkan. Semua perubahan tercatat di audit log |

Aturan bisnis R1–R16 ada di `src/lib/rules.ts` dan dipakai di form **dan** di server, jadi server selalu mengulang semua validasi form.

Rumus metrik (bagian 9 PRD): Total Qty = qty normal + qty OT; Rated Hours = (menit normal + menit OT) / 60; Std Hours = Total Qty / STKI; Achievement = Σ Std Hours / Σ Rated Hours (bukan rata-rata persen); NG rate = NG / (Qty + NG). STKI disimpan sebagai snapshot saat approve, sehingga perubahan STKI tidak mengubah report bulan lalu.

## Menjalankan di komputer

Butuh Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Tanpa `DATABASE_URL`, aplikasi memakai **PGlite** (PostgreSQL yang berjalan di dalam proses Node) di folder `./data/pglite`, jadi tidak perlu install database. Saat pertama jalan, tabel dibuat dan diisi master data dari PRD plus data contoh.

Akun contoh (PIN semua `1234`):

| NIK | Nama | Peran |
| --- | --- | --- |
| `admin` | Anton Wahyudi | Admin |
| `L001` | Dian Kartika | Leader PF |
| `M001` | Kepala Produksi | Manajemen |
| `201003`, `201015`, … | Harjuki, Siti Rahma, … | Operator |

## Produksi (Vercel + Supabase, sesuai rekomendasi PRD)

1. Buat project Supabase, salin connection string PostgreSQL.
2. Set environment variable:
   - `DATABASE_URL` = connection string PostgreSQL
   - `SESSION_SECRET` = string acak panjang (wajib; aplikasi menolak login tanpa ini di produksi)
   - `ADMIN_NIK` dan `ADMIN_PIN` = akun admin pertama (default `admin` / `1234`, segera ganti)
   - `SEED_DEMO=0` agar tidak membuat member dan laporan contoh
3. Deploy ke Vercel. Migrasi database (`drizzle/`) dijalankan otomatis saat aplikasi pertama terhubung.

Bisa juga di server lokal pabrik: `npm run build && npm start` dengan PostgreSQL lokal.

## Struktur

```
src/db/schema.ts        Tabel (users, members, categories, parts, machines, lost_time_types,
                        ng_groups, ng_codes, submissions, production_rows, lost_time_rows,
                        settings, audit_log)
src/db/seed.ts          Master data awal dari PRD + data contoh
src/lib/rules.ts        Aturan R1–R16, pencocokan part/mesin, rumus metrik
src/lib/service.ts      Kirim laporan, antrian, approve/reject (transaksi + row lock)
src/lib/reports.ts      Semua report
src/app/api/...         API sesuai bagian 13 PRD
drizzle/                Migrasi SQL (buat ulang dengan `npm run db:generate` setelah ubah schema)
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

- Impor master dari Excel / Google Sheet v1 dan migrasi data historis.
- Mode offline penuh (PWA kirim otomatis saat online). Draft sudah tersimpan di HP.
- Notifikasi reject ke operator dan antrian ke leader, email laporan bulanan otomatis (cron).
- Batalkan approve, ganti PIN sendiri, drill-down klik di report, report dalam Bahasa Inggris.
- Nama NG, part, dan STKI di seed adalah contoh; ganti dengan data asli lewat halaman Admin.
