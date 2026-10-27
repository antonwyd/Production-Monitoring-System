import Link from "next/link";
import AppShell from "@/components/AppShell";
import PlanForm from "@/components/monthly/PlanForm";
import { requirePageRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { daysOf, defaultMonth, defaultWorkDays, isValidMonth, monthLabel, nextMonthOf, prevMonthOf, SECTIONS, unitLabel } from "@/lib/monthly";
import { loadMaster } from "@/lib/service";
import { readPlans } from "@/lib/sheets/plan";

export const metadata = { title: "Isi Plan · Production Report" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePageRole(["leader", "admin"]);
  const q = await searchParams;
  const month = isValidMonth(q.month) ? q.month : defaultMonth(todayJakarta());
  const prev = prevMonthOf(month);
  const [plans, master] = await Promise.all([readPlans([month, prev]), loadMaster()]);
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const nav = "btn-secondary h-10 px-3";
  return (
    <AppShell session={session} active="production-report">
      <main className="flex w-full max-w-5xl flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href={`/production-report?month=${month}`} className="text-sm font-semibold text-brand-600 hover:underline">
              ← Production Report
            </Link>
            <h1 className="text-2xl font-bold sm:text-3xl">Isi Plan {monthLabel(month)}</h1>
            <p className="text-sm text-slate-500">Plan per section. Plan harian = Plan Produksi ÷ jumlah hari kerja yang dicentang. Kolom yang kosong diambil dari plan bulan lalu.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`?month=${prev}`} className={nav} aria-label="Bulan sebelumnya">
              ‹
            </Link>
            <span className="min-w-36 text-center font-semibold">{monthLabel(month)}</span>
            <Link href={`?month=${nextMonthOf(month)}`} className={nav} aria-label="Bulan berikutnya">
              ›
            </Link>
          </div>
        </div>
        {SECTIONS.map((d) => {
          const cur = plans.find((p) => p.month === month && p.section === d.key) ?? null;
          const last = plans.find((p) => p.month === prev && p.section === d.key) ?? null;
          return (
            <PlanForm
              key={`${d.key}-${month}`}
              month={month}
              section={{ key: d.key, name: d.name, unit: unitLabel(d), categories: d.categories.join(" + ") }}
              days={daysOf(month).length}
              firstWeekday={firstWeekday}
              defaultDays={defaultWorkDays(month)}
              normalMin={master.settings.normalMin}
              current={cur}
              previous={last}
            />
          );
        })}
      </main>
    </AppShell>
  );
}
