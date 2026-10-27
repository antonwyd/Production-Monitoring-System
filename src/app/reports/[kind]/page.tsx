import { notFound, redirect } from "next/navigation";
import { renderReportPage } from "@/lib/reportPage";
import { REPORT_KINDS, REPORT_TITLES, type ReportKind } from "@/lib/reports";

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { kind } = await params;
  return { title: `${REPORT_TITLES[kind as ReportKind] ?? "Report"} · QA Production` };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { kind } = await params;
  // Menu Produksi sudah digabung ke Production Report.
  if (kind === "category") {
    const q = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`/production-report/detail${q ? `?${q}` : ""}`);
  }
  if (!REPORT_KINDS.includes(kind as ReportKind) || kind === "dashboard") notFound();
  return renderReportPage(kind as ReportKind, await searchParams);
}
