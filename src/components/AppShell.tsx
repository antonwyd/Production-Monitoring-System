import Link from "next/link";
import type { Session } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

// Menu sengaja hanya tiga supaya mudah dipakai di lantai produksi.
const LINKS: { href: string; label: string; key: string }[] = [
  { href: "/hari-ini", label: "Hari Ini", key: "hari-ini" },
  { href: "/laporan", label: "Laporan", key: "laporan" },
];

const ROLE_LABEL: Record<Session["role"], string> = {
  operator: "Operator",
  leader: "Leader",
  manager: "Manajemen",
  admin: "Admin",
};

export default function AppShell({ session, active, children }: { session: Session; active: string; children: React.ReactNode }) {
  const sheetUrl = process.env.SHEET_URL;
  const cls = (on: boolean) =>
    `whitespace-nowrap rounded-lg px-4 py-2.5 text-[15px] ${on ? "bg-brand-50 font-semibold text-brand-600" : "font-medium text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
          <Link href="/hari-ini" className="flex items-center gap-3">
            <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-9 w-auto" />
            <span className="border-l border-slate-200 pl-3 font-bold text-brand-600">Produksi QA</span>
          </Link>
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {LINKS.map((l) => (
              <Link key={l.key} href={l.href} className={cls(active === l.key)}>
                {l.label}
              </Link>
            ))}
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noreferrer" className={cls(false)}>
                Sheet
              </a>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-right text-xs leading-tight">
              <div className="font-semibold">{session.name}</div>
              <div className="text-slate-500">{ROLE_LABEL[session.role]}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
