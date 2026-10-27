import { redirect } from "next/navigation";

// Menu Laporan dihapus: isinya ringkasan halaman lain, Rekap bulanan pindah ke Production Report.
export default async function LaporanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  redirect(q.month ? `/production-report/rekap?month=${encodeURIComponent(q.month)}` : "/production-report");
}
