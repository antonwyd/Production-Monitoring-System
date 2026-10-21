import { renderReportPage } from "@/lib/reportPage";

export const metadata = { title: "Dashboard · Produksi QA" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderReportPage("dashboard", await searchParams);
}
