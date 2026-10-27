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
  // Produksi dan Rekap bulanan sudah dipindah ke Production Report. Disiplin Lapor dihapus (siapa yang belum lapor ada di Dashboard).
  if (kind === "disiplin") redirect("/hari-ini");
  const moved: Record<string, string> = { category: "/production-report/detail", monthly: "/production-report/rekap" };
  if (moved[kind]) {
    const q = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`${moved[kind]}${q ? `?${q}` : ""}`);
  }
  if (!REPORT_KINDS.includes(kind as ReportKind) || kind === "dashboard") notFound();
  return renderReportPage(kind as ReportKind, await searchParams);
}
