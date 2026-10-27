import { renderReportPage } from "@/lib/reportPage";

export const metadata = { title: "Rekap bulanan · Production Report" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Tab "Rekap bulanan" di Production Report (dulu di menu Laporan, /reports/monthly). */
export default async function ProductionRekapPage({ searchParams }: Props) {
  return renderReportPage("monthly", await searchParams);
}
