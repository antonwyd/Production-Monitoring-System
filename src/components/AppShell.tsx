import Link from "next/link";
import type { Session } from "@/lib/auth";
import Icon, { type IconName } from "./Icon";
import LogoutButton from "./LogoutButton";

const LINKS: { href: string; label: string; icon: IconName; roles: Session["role"][] }[] = [
  { href: "/form", label: "Form", icon: "form", roles: ["operator", "leader", "admin"] },
  { href: "/leader", label: "Validasi", icon: "validate", roles: ["leader", "admin"] },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["leader", "manager", "admin"] },
  { href: "/reports/daily", label: "Report", icon: "report", roles: ["leader", "manager", "admin"] },
  { href: "/admin", label: "Admin", icon: "admin", roles: ["admin"] },
];

const ROLE_LABEL: Record<Session["role"], string> = {
  operator: "Operator",
  leader: "Leader",
  manager: "Manajemen",
  admin: "Admin",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function AppShell({ session, active, children }: { session: Session; active: string; children: React.ReactNode }) {
  const links = LINKS.filter((l) => l.roles.includes(session.role));
  const showNav = links.length > 1;
  const role = `${ROLE_LABEL[session.role]}${session.area ? ` · ${session.area}` : ""}`;

  const tab = (l: (typeof LINKS)[number], mobile: boolean) => {
    const on = active === l.href.split("/")[1];
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={on ? "page" : undefined}
        className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors ${
          mobile ? "h-11 px-3" : "h-14 px-3"
        } ${on ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
      >
        <Icon name={l.icon} size={16} className={on ? "text-brand-600" : ""} />
        {l.label}
        <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${on ? "bg-brand-600" : "bg-transparent"}`} />
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-slate-900">Produksi QA</span>
              <span className="block text-[11px] text-slate-500">Takai Seiki Indonesia</span>
            </span>
          </Link>
          {showNav && (
            <>
              <span className="hidden h-6 w-px bg-slate-200 md:block" />
              <nav className="hidden flex-1 items-center md:flex">{links.map((l) => tab(l, false))}</nav>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2.5">
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm font-medium text-slate-900">{session.name}</span>
                <span className="block text-xs text-slate-500">{role}</span>
              </span>
              <span
                title={`${session.name} · ${role}`}
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {initials(session.name)}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
        {showNav && (
          <nav className="-mb-px flex overflow-x-auto border-t border-slate-100 px-2 [scrollbar-width:none] md:hidden">
            {links.map((l) => tab(l, true))}
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
