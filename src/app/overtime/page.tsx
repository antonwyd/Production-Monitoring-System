import AppShell from "@/components/AppShell";
import OvertimePlanner from "@/components/overtime/OvertimePlanner";
import { requirePageRole } from "@/lib/auth";
import { addDays, todayJakarta } from "@/lib/dates";
import type { PlanMaster } from "@/lib/overtime";
import { loadFacts } from "@/lib/reports";
import { loadMaster } from "@/lib/service";
import { readOtPlans } from "@/lib/sheets/overtime";
import { planMaster } from "@/lib/sheets/qa";

export const metadata = { title: "Rencana Lembur · QA Production" };
export const dynamic = "force-dynamic";

/** Rata-rata orang & mesin per hari kerja 2 minggu terakhir per kategori, sebagai saran awal. */
async function recentUnits(today: string): Promise<Record<string, number>> {
  try {
    const master = await loadMaster();
    const { facts } = await loadFacts(master, addDays(today, -14), addDays(today, -1));
    const days = new Set(facts.map((f) => f.workDate)).size || 1;
    const sets = new Map<string, Set<string>>();
    const put = (k: string, v: string) => (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(v);
    for (const f of facts) {
      put(`${f.categoryName}#members`, `${f.workDate}|${f.memberId}`);
      if (f.mcNo !== "-") put(`${f.categoryName}#machines`, `${f.workDate}|${f.mcNo}`);
      put("#pool", `${f.workDate}|${f.memberId}`);
    }
    return Object.fromEntries([...sets].map(([k, v]) => [k, Math.round((v.size / days) * 10) / 10]));
  } catch {
    return {};
  }
}

export default async function OvertimePage() {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const today = todayJakarta();
  const [pm, recent, saved] = await Promise.all([planMaster(), recentUnits(today), readOtPlans()]);
  const master: PlanMaster = { ...pm, recent };
  return (
    <AppShell session={session} active="overtime">
      <OvertimePlanner master={master} saved={saved} today={today} canSave={session.role === "leader" || session.role === "admin"} />
    </AppShell>
  );
}
