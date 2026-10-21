import Link from "next/link";
import AppShell from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { MASTER_DEFS } from "@/lib/adminConfig";

export const metadata = { title: "Admin · Produksi QA" };

export default async function AdminPage() {
  const session = await requirePageRole(["admin"]);
  return (
    <AppShell session={session} active="admin">
      <div className="mx-auto max-w-5xl px-3 py-4">
        <h1 className="mb-1 text-2xl font-bold">Master data</h1>
        <p className="mb-4 text-slate-600">Semua pilihan di form berasal dari sini. Data tidak pernah dihapus, cukup dijadikan tidak aktif.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MASTER_DEFS.map((d) => (
            <Link key={d.key} href={`/admin/${d.key}`} className="card p-4 hover:border-brand-600">
              <div className="font-bold">{d.title}</div>
              <div className="text-sm text-slate-600">{d.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
