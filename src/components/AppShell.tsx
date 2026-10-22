import type { Session } from "@/lib/auth";
import Sidebar, { type NavGroup } from "./Sidebar";

const ROLE_LABEL: Record<Session["role"], string> = {
  operator: "Operator",
  leader: "Leader",
  manager: "Manajemen",
  admin: "Admin",
};

/** Menu samping per peran: admin semua, leader & manajemen tanpa Master Data / Sheet. */
function navFor(role: Session["role"]): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [
        { key: "hari-ini", href: "/hari-ini", label: "Dashboard", icon: "dash" },
        { key: "laporan", href: "/laporan", label: "Laporan Produksi", icon: "report" },
        { key: "report:member", href: "/reports/member", label: "Per Member", icon: "user" },
        { key: "report:ng-type", href: "/reports/ng-type", label: "Kualitas (NG)", icon: "quality" },
        { key: "report:waktu", href: "/reports/waktu", label: "Waktu & Lost Time", icon: "clock" },
        { key: "report:machine", href: "/reports/machine", label: "Mesin PF", icon: "machine" },
        { key: "report:disiplin", href: "/reports/disiplin", label: "Disiplin Lapor", icon: "check" },
      ],
    },
  ];
  if (role === "admin")
    groups.push({
      title: "Master Data",
      items: [
        { key: "master", href: "/master", label: "Master Data", icon: "data" },
        { key: "akses", href: "/master?t=users", label: "Akun & Hak Akses", icon: "lock" },
        ...(process.env.SHEET_URL ? [{ key: "sheet", href: process.env.SHEET_URL, label: "Google Sheet", icon: "sheet", external: true }] : []),
      ],
    });
  groups.push({
    title: "Tools",
    items: [
      { key: "form", href: "/", label: "Form Member", icon: "form", external: true },
      ...(role === "leader" || role === "admin" ? [{ key: "validasi", href: "/?page=leader", label: "Validasi Leader", icon: "check", external: true }] : []),
    ],
  });
  return groups;
}

export default function AppShell({ session, active, children }: { session: Session; active: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 transition-[padding] duration-200 ease-out lg:pb-0 lg:pl-[var(--sb-w)]">
      <Sidebar groups={navFor(session.role)} active={active} user={{ name: session.name, role: ROLE_LABEL[session.role] }} />
      <div className="anim-page w-full">{children}</div>
    </div>
  );
}
