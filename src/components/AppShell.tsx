import type { Session } from "@/lib/auth";
import Sidebar, { type NavGroup } from "./Sidebar";

const ROLE_LABEL: Record<Session["role"], string> = {
  operator: "Operator",
  leader: "Leader",
  manager: "Manajemen",
  admin: "Admin",
};

/**
 * Menu utama: Home, Input, Laporan, Kualitas, Lainnya. Semua laporan lain dibuka dari Pusat Laporan,
 * jadi tidak ada lagi satu menu per report. Hak akses tetap dicek di server per halaman.
 */
function navFor(role: Session["role"]): NavGroup[] {
  const groups: NavGroup[] = [
    { items: [{ key: "hari-ini", href: "/hari-ini", label: "Home", icon: "dash" }] },
    {
      title: "Input",
      items: [
        { key: "form", href: "/", label: "Kirim laporan", icon: "form", external: true },
        ...(role === "leader" || role === "admin" ? [{ key: "validasi", href: "/?page=leader", label: "Validasi laporan", icon: "check", external: true }] : []),
      ],
    },
    {
      title: "Laporan",
      items: [
        { key: "laporan", href: "/laporan", label: "Pusat Laporan", icon: "report" },
        { key: "report:ng-type", href: "/reports/ng-type", label: "Kualitas", icon: "quality" },
      ],
    },
  ];
  if (role === "admin")
    groups.push({
      title: "Lainnya",
      items: [
        { key: "master", href: "/master", label: "Master Data", icon: "data" },
        { key: "akses", href: "/master?t=users", label: "Akun & Hak Akses", icon: "lock" },
        ...(process.env.SHEET_URL ? [{ key: "sheet", href: process.env.SHEET_URL, label: "Google Sheet", icon: "sheet", external: true }] : []),
      ],
    });
  return groups;
}

/** Halaman report selain Kualitas menyalakan menu Pusat Laporan. */
const menuKey = (active: string) => (active.startsWith("report:") && active !== "report:ng-type" ? "laporan" : active);

export default function AppShell({ session, active, children }: { session: Session; active: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 transition-[padding] duration-200 ease-out lg:pb-0 lg:pl-[var(--sb-w)]">
      <Sidebar groups={navFor(session.role)} active={menuKey(active)} user={{ name: session.name, role: ROLE_LABEL[session.role] }} />
      <div className="anim-page w-full">{children}</div>
    </div>
  );
}
