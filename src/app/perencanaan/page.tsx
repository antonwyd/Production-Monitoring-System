import AppShell from "@/components/AppShell";
import PlanBoard from "@/components/planning/PlanBoard";
import { requirePageRole } from "@/lib/auth";
import { isValidDate, todayJakarta } from "@/lib/dates";
import { loadPlanPage } from "@/lib/sheets/planning";

export const metadata = { title: "Rencana Hari Ini · QA Production" };
export const dynamic = "force-dynamic";

export default async function PerencanaanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const today = todayJakarta();
  const q = (await searchParams).date;
  const date = q && isValidDate(q) ? q : today;
  const page = await loadPlanPage(date);
  const t = new Date(Date.now() + 7 * 3600_000);
  const nowMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  return (
    <AppShell session={session} active="perencanaan">
      <PlanBoard key={date} page={page} today={today} nowMin={nowMin} canSave={session.role === "leader" || session.role === "admin"} />
    </AppShell>
  );
}
