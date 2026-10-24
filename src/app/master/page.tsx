import Link from "next/link";
import AppShell from "@/components/AppShell";
import MasterEditor from "@/components/MasterEditor";
import { requirePageRole } from "@/lib/auth";
import { MASTER_TABLES } from "@/lib/sheets/masterEdit";

export const metadata = { title: "Master Data · QA Production" };

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Produksi", ids: ["member", "part", "category", "machine", "stdmc"] },
  { title: "Isian form", ids: ["lost", "ng", "nggroup", "setting"] },
  { title: "Akses", ids: ["users", "leader"] },
];

export default async function MasterPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const session = await requirePageRole(["admin"]);
  const { t } = await searchParams;
  const table = MASTER_TABLES.find((x) => x.id === t) ?? MASTER_TABLES[0];
  const spec = { id: table.id, title: table.title, desc: table.desc, fields: table.fields, fixed: table.fixed };
  return (
    <AppShell session={session} active={table.id === "users" || table.id === "leader" ? "akses" : "master"}>
      <main className="flex flex-col gap-5 px-4 pb-12 pt-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{table.id === "users" || table.id === "leader" ? "Akun & Hak Akses" : "Master Data"}</h1>
          <p className="text-sm text-slate-500">Khusus admin. Perubahan langsung tersimpan ke Google Sheet, jadi tidak perlu membuka Sheet.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">{g.title}</span>
              {g.ids.map((id) => {
                const x = MASTER_TABLES.find((m) => m.id === id)!;
                return (
                  <Link
                    key={id}
                    href={`/master?t=${id}`}
                    className={`rounded-lg px-3 py-2 text-sm ${id === table.id ? "bg-brand-600 font-semibold text-white" : "bg-white font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-600"}`}
                  >
                    {x.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        {table.id === "users" && <AccessTable />}
        <MasterEditor key={table.id} table={spec} />
      </main>
    </AppShell>
  );
}

function AccessTable() {
  const rows: [string, string, string, string, string][] = [
    ["Form member (QR)", "✓", "✓", "✓", "✓"],
    ["Hari Ini: lihat", "", "✓", "✓", "✓"],
    ["Hari Ini: setujui / tolak", "", "✓", "", "✓"],
    ["Laporan + semua report + Excel", "", "✓", "✓", "✓"],
    ["Master Data, Akun & Hak Akses, buka Sheet", "", "", "", "✓"],
  ];
  return (
    <section className="card overflow-x-auto px-2 py-3">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="px-3 py-2 font-medium">Hak akses per peran</th>
            <th className="px-3 py-2 text-center font-medium">operator</th>
            <th className="px-3 py-2 text-center font-medium">leader</th>
            <th className="px-3 py-2 text-center font-medium">manajemen</th>
            <th className="px-3 py-2 text-center font-medium">admin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, ...v]) => (
            <tr key={a} className="border-t border-slate-100">
              <td className="px-3 py-2">{a}</td>
              {v.map((x, i) => (
                <td key={i} className="px-3 py-2 text-center font-bold text-emerald-700">
                  {x}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
