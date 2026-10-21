import Link from "next/link";
import AppShell from "@/components/AppShell";
import Icon, { type IconName } from "@/components/Icon";
import { requirePageRole } from "@/lib/auth";
import { MASTER_DEFS } from "@/lib/adminConfig";

export const metadata = { title: "Admin · Produksi QA" };

const ICONS: Record<string, IconName> = {
  members: "users",
  users: "user",
  categories: "layers",
  parts: "box",
  machines: "cpu",
  "lost-time-types": "clock",
  "ng-codes": "tag",
  "ng-groups": "tag",
  settings: "admin",
};

export default async function AdminPage() {
  const session = await requirePageRole(["admin"]);
  return (
    <AppShell session={session} active="admin">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Master data</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Semua pilihan di form berasal dari sini. Data tidak pernah dihapus, cukup dijadikan tidak aktif.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MASTER_DEFS.map((d) => (
            <Link
              key={d.key}
              href={`/admin/${d.key}`}
              className="card group flex gap-3.5 p-4 transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-xs sm:p-5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600 group-hover:ring-brand-200">
                <Icon name={ICONS[d.key] ?? "admin"} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-medium text-slate-900">
                  {d.title}
                  <Icon name="chevronRight" size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </span>
                <span className="mt-1 block text-sm leading-snug text-slate-500">{d.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
