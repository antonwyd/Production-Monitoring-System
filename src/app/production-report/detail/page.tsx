import { renderReportPage } from "@/lib/reportPage";

export const metadata = { title: "Detail per part · Production Report" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Tab "Detail per part" di Production Report (dulu menu Produksi, /reports/category). */
export default async function ProductionDetailPage({ searchParams }: Props) {
  return renderReportPage("category", await searchParams);
}
