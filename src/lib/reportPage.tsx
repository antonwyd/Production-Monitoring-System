import AppShell from "@/components/AppShell";
import ReportView from "@/components/report/ReportView";
import { requirePageRole } from "@/lib/auth";
import { monthStart, todayJakarta } from "@/lib/dates";
import { buildReport, parseReportParams, type ReportKind } from "@/lib/reports";
import { loadMaster } from "@/lib/service";

export async function renderReportPage(kind: ReportKind, searchParams: Record<string, string | string[] | undefined>) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) flat[k] = v;
  const params = parseReportParams(flat);
  const today = todayJakarta();
  const [report, master] = await Promise.all([buildReport(kind, params, today), loadMaster()]);
  return (
    <AppShell session={session} active={kind === "dashboard" ? "dashboard" : "reports"}>
      <ReportView
        report={report}
        params={params}
        master={master}
        query={new URLSearchParams(flat).toString()}
        defaults={{ from: monthStart(today), to: today, date: today, month: today.slice(0, 7) }}
      />
    </AppShell>
  );
}
