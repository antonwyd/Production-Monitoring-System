import AppShell from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";

export const metadata = { title: "Admin · Produksi QA" };

const TABS = [
  { tab: "Master Data", desc: "Member (NIK, nama, status), part & STKI, kategori, mesin, jenis lost time, kode NG, setting jam kerja dan grade." },
  { tab: "Users", desc: "Akun login web: NIK, nama, peran (operator, leader, manajemen, admin), PIN, status." },
  { tab: "Antrian Validasi", desc: "Semua kiriman beserta status Menunggu / Disetujui / Ditolak." },
  { tab: "Input - Production", desc: "Baris produksi yang sudah disetujui. Sumber semua report." },
  { tab: "Input - Lost Time", desc: "Baris lost time dan another job yang sudah disetujui." },
];

export default async function AdminPage() {
  const session = await requirePageRole(["admin"]);
  const sheetUrl = process.env.SHEET_URL;
  return (
    <AppShell session={session} active="admin">
      <div className="mx-auto max-w-5xl px-3 py-4">
        <h1 className="mb-1 text-2xl font-bold">Master data</h1>
        <p className="mb-4 text-slate-600">
          Database aplikasi ini adalah Google Sheet. Ubah master data dan akun langsung di sheet; perubahan terbaca di web paling lambat sekitar 1 menit.
        </p>
        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn-primary mb-4 inline-block px-4 py-2">
            Buka Google Sheet
          </a>
        ) : (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Isi SHEET_URL di environment Vercel untuk menampilkan tombol buka sheet.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TABS.map((t) => (
            <div key={t.tab} className="card p-4">
              <div className="font-bold">Tab “{t.tab}”</div>
              <div className="text-sm text-slate-600">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
