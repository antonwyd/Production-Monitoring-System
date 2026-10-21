import Link from "next/link";
import type { Session } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

const LINKS: { href: string; label: string; roles: Session["role"][] }[] = [
  { href: "/form", label: "Form", roles: ["operator", "leader", "admin"] },
  { href: "/leader", label: "Validasi", roles: ["leader", "admin"] },
  { href: "/dashboard", label: "Dashboard", roles: ["leader", "manager", "admin"] },
  { href: "/reports/daily", label: "Report", roles: ["leader", "manager", "admin"] },
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

const ROLE_LABEL: Record<Session["role"], string> = {
  operator: "Operator",
  leader: "Leader",
  manager: "Manajemen",
  admin: "Admin",
};

export default function AppShell({ session, active, children }: { session: Session; active: string; children: React.ReactNode }) {
  const links = LINKS.filter((l) => l.roles.includes(session.role));
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">Produksi QA</span>
          </Link>
          {links.length > 1 && (
            <nav className="flex flex-1 gap-1 overflow-x-auto">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active === l.href.split("/")[1] ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
          {links.length <= 1 && <div className="flex-1" />}
          <div className="text-right text-xs leading-tight">
            <div className="font-semibold">{session.name}</div>
            <div className="text-slate-500">
              {ROLE_LABEL[session.role]}
              {session.area ? ` · ${session.area}` : ""}
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
