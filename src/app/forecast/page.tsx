import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ForecastView from "@/components/forecast/ForecastView";
import { requirePageRole } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { buildForecastReport } from "@/lib/forecast";
import { customerList, readForecast } from "@/lib/sheets/forecast";

export const metadata = { title: "Forecast vs PO · QA Production" };
export const dynamic = "force-dynamic";

export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!FEATURES.forecast) redirect("/hari-ini");
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const [{ rows, daily }, customers] = await Promise.all([readForecast(), customerList()]);
  const r = buildForecastReport(rows, daily, q.c, q.m);
  return (
    <AppShell session={session} active="forecast">
      <ForecastView r={r} canEdit={session.role === "leader" || session.role === "admin"} isAdmin={session.role === "admin"} customers={customers} />
    </AppShell>
  );
}
