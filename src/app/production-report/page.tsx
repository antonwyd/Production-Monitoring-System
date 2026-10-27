import Link from "next/link";
import AppShell from "@/components/AppShell";
import DataStatus from "@/components/DataStatus";
import DownloadMenu from "@/components/report/DownloadMenu";
import PresdirView from "@/components/monthly/PresdirView";
import ReportTabs from "@/components/report/ReportTabs";
import { requirePageRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { buildMonthly, defaultMonth, isValidMonth, monthLabel, nextMonthOf, prevMonthOf } from "@/lib/monthly";
import { withDataAge } from "@/lib/reports";

export const metadata = { title: "Plan vs Actual · QA Production" };

export default async function ProductionReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const today = todayJakarta();
  const month = isValidMonth(q.month) ? q.month : defaultMonth(today);
  const { value: r, asOf } = await withDataAge(() => buildMonthly(month));
  const canPlan = session.role === "leader" || session.role === "admin";
  const noPlan = r.sections.filter((s) => !s.hasPlan);
  const nav = "btn-secondary h-10 px-3";
  // Bulan berjalan: pencapaian dibandingkan dengan plan s/d hari ini.
  const live = month === today.slice(0, 7);

  return (
    <AppShell session={session} active="production-report">
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Plan vs Actual</h1>
            <p className="text-sm text-slate-500">Laporan bulanan untuk Presdir · Plan diisi leader, Actual dari laporan yang sudah disetujui.</p>
            <DataStatus asOf={asOf} className="mt-1" />
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Link href={`?month=${prevMonthOf(month)}`} className={nav} aria-label="Bulan sebelumnya">
              ‹
            </Link>
            <span className="min-w-36 text-center font-semibold">{monthLabel(month)}</span>
            <Link href={`?month=${nextMonthOf(month)}`} className={nav} aria-label="Bulan berikutnya">
              ›
            </Link>
            {canPlan && (
              <Link href={`/production-report/plan?month=${month}`} className="btn-secondary h-10 px-4">
                Isi Plan
              </Link>
            )}
            <DownloadMenu
              links={[
                { label: "Excel (.xlsx)", hint: "Ringkasan + 1 sheet per section, dengan grafik", href: `/api/production-report/production-report.xlsx?month=${month}` },
                { label: "PDF", hint: "Siap kirim ke Presdir, 1 halaman per section", href: `/api/production-report/production-report.pdf?month=${month}` },
              ]}
            />
          </div>
        </div>

        <ReportTabs kind="production-report" query={{}} />

        {noPlan.length > 0 && (
          <div className="card border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            Plan {monthLabel(month)} belum diisi untuk: <b>{noPlan.map((s) => s.def.name).join(", ")}</b>.{" "}
            {canPlan ? (
              <Link href={`/production-report/plan?month=${month}`} className="font-semibold underline">
                Isi sekarang
              </Link>
            ) : (
              "Minta leader mengisi di menu Production Report."
            )}
          </div>
        )}

        <PresdirView report={r} canPlan={canPlan} live={live} />
      </main>
    </AppShell>
  );
}
