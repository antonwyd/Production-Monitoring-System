import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import PoDashboard, { PoInput } from "@/components/po/PoTracker";
import { getSession } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { PROCESSES, type Process } from "@/lib/po";
import { readPoState } from "@/lib/sheets/po";

export const metadata = { title: "Monitoring PO Customer · QA Production" };
export const dynamic = "force-dynamic";

/** /po = dashboard; /po?p=Seiretsu|Senbetsu|Washing = input progress box per proses. Operator langsung ke input. */
export default async function PoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  if (!FEATURES.po) redirect("/hari-ini");
  const session = await getSession();
  if (!session) redirect("/login?next=po");
  const q = (await searchParams).p;
  const operator = session.role === "operator";
  const process = PROCESSES.find((p) => p.toLowerCase() === String(q ?? "").toLowerCase()) ?? (operator ? ("Seiretsu" as Process) : null);
  const manage = session.role === "leader" || session.role === "admin";
  let initial;
  try {
    initial = await readPoState();
  } catch (e) {
    return (
      <main className="p-6">
        <div className="card p-6 text-red-700">Data PO tidak bisa dibaca: {(e as Error).message}</div>
      </main>
    );
  }
  const today = todayJakarta();
  const body = process ? <PoInput initial={initial} today={today} process={process} operator={operator} /> : <PoDashboard initial={initial} today={today} manage={manage} />;
  // Operator tidak memakai menu dashboard: cukup kepala sederhana + tombol kembali ke form.
  if (operator)
    return (
      <div className="min-h-screen">
        <header className="flex items-center gap-3 bg-gradient-to-r from-brand-900 to-brand-600 px-4 py-3 text-white">
          <a href="/" className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-white/10">
            ← Form laporan
          </a>
          <img src="/logo-tki-dark.png" alt="PT. Takai Seiki Indonesia" className="ml-auto h-7 w-auto" />
        </header>
        {body}
      </div>
    );
  return (
    <AppShell session={session} active={process ? `po:${process}` : "po"}>
      {body}
    </AppShell>
  );
}
