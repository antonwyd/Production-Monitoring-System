import AppShell from "@/components/AppShell";
import ReportView from "@/components/report/ReportView";
import { navKeyOf } from "@/components/report/ReportTabs";
import { requirePageRole } from "@/lib/auth";
import { addDays, monthStart, todayJakarta } from "@/lib/dates";
import { buildReport, parseReportParams, withDataAge, type ReportKind } from "@/lib/reports";
import { loadMaster } from "@/lib/service";

export async function renderReportPage(kind: ReportKind, searchParams: Record<string, string | string[] | undefined>) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) flat[k] = v;
  const params = parseReportParams(flat);
  const today = todayJakarta();
  // Laporan hari ini baru diinput sore, jadi tanpa pilihan tanggal laporan dibuka sampai kemarin.
  const base = addDays(today, -1);
  const [{ value: report, asOf }, master] = await Promise.all([withDataAge(() => buildReport(kind, params, base)), loadMaster()]);
  return (
    <AppShell session={session} active={navKeyOf(kind)}>
      <ReportView
        report={report}
        params={params}
        master={master}
        query={flat}
        today={today}
        asOf={asOf}
        defaults={{ from: monthStart(base), to: base, date: base, month: base.slice(0, 7) }}
      />
    </AppShell>
  );
}
