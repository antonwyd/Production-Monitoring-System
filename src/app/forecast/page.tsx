import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ForecastView from "@/components/forecast/ForecastView";
import { requirePageRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { buildForecastReport } from "@/lib/forecast";
import { masterCustomers, readForecast } from "@/lib/sheets/forecast";

export const metadata = { title: "Forecast vs PO · QA Production" };
export const dynamic = "force-dynamic";

export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!FEATURES.forecast) redirect("/hari-ini");
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const [{ fc, po }, master] = await Promise.all([readForecast(), masterCustomers()]);
  const r = buildForecastReport(fc, po, { customer: q.c, month: q.m, part: q.p, today: todayJakarta() });
  return (
    <AppShell session={session} active="forecast">
      <ForecastView r={r} canEdit={session.role === "leader" || session.role === "admin"} isAdmin={session.role === "admin"} customers={master.customers} />
    </AppShell>
  );
}
