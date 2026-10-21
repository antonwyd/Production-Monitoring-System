import { notFound } from "next/navigation";
import { renderReportPage } from "@/lib/reportPage";
import { REPORT_KINDS, REPORT_TITLES, type ReportKind } from "@/lib/reports";

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { kind } = await params;
  return { title: `${REPORT_TITLES[kind as ReportKind] ?? "Report"} · Produksi QA` };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { kind } = await params;
  if (!REPORT_KINDS.includes(kind as ReportKind) || kind === "dashboard") notFound();
  return renderReportPage(kind as ReportKind, await searchParams);
}
