import Link from "next/link";

type Tab = { kind: string; label: string; desc: string; color: keyof typeof COLORS; icon: keyof typeof ICONS; href?: string };

/** Report yang satu tema digabung dalam tab, filter periode/kategori ikut terbawa. */
export const REPORT_GROUPS: { key: string; tabs: Tab[] }[] = [
  {
    key: "report:ng-type",
    tabs: [
      { kind: "ng-type", label: "Per jenis NG", desc: "Jenis cacat terbanyak", color: "rose", icon: "alert" },
      { kind: "ng-part", label: "Per part", desc: "NG per part & proses", color: "red", icon: "layers" },
      { kind: "ng-lot", label: "Per lot", desc: "NG per lot & oiban", color: "amber", icon: "box" },
    ],
  },
  {
    // Produktivitas = khusus orang.
    key: "report:member",
    tabs: [
      { kind: "member", label: "Per periode", desc: "Semua atau satu member", color: "red", icon: "user" },
      { kind: "daily", label: "Per tanggal", desc: "Status & hasil semua member", color: "emerald", icon: "day" },
    ],
  },
  // Produksi digabung ke Production Report: laporan bulanan Presdir + detail pcs per kategori/part dengan periode bebas.
  {
    key: "production-report",
    tabs: [
      { kind: "production-report", label: "Laporan Presdir", desc: "Plan vs result per section", color: "red", icon: "month", href: "/production-report" },
      { kind: "monthly", label: "Rekap bulanan", desc: "Total sebulan per kategori & member", color: "violet", icon: "day", href: "/production-report/rekap" },
      { kind: "category", label: "Detail per part", desc: "Pcs per kategori & part, periode bebas", color: "blue", icon: "layers", href: "/production-report/detail" },
    ],
  },
];

// Kelas Tailwind ditulis utuh supaya ikut ter-build.
const COLORS = {
  red: { on: "bg-brand-600 text-white ring-brand-600 shadow-brand-600/25", bubble: "bg-brand-50 text-brand-600", hover: "hover:ring-brand-100" },
  blue: { on: "bg-blue-600 text-white ring-blue-600 shadow-blue-600/25", bubble: "bg-blue-50 text-blue-600", hover: "hover:ring-blue-300" },
  emerald: { on: "bg-emerald-600 text-white ring-emerald-600 shadow-emerald-600/25", bubble: "bg-emerald-50 text-emerald-600", hover: "hover:ring-emerald-300" },
  violet: { on: "bg-violet-600 text-white ring-violet-600 shadow-violet-600/25", bubble: "bg-violet-50 text-violet-600", hover: "hover:ring-violet-300" },
  rose: { on: "bg-rose-600 text-white ring-rose-600 shadow-rose-600/25", bubble: "bg-rose-50 text-rose-600", hover: "hover:ring-rose-300" },
  amber: { on: "bg-amber-500 text-white ring-amber-500 shadow-amber-500/25", bubble: "bg-amber-50 text-amber-600", hover: "hover:ring-amber-300" },
};

const ICONS = {
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  layers: "M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5",
  day: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M12 14v3",
  month: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h2M14 14h2M8 17h2M14 17h2",
  alert: "M12 3 2 20h20L12 3zM12 10v4M12 17h.01",
  box: "M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10",
};

export const navKeyOf = (kind: string) => REPORT_GROUPS.find((g) => g.tabs.some((t) => t.kind === kind))?.key ?? `report:${kind}`;

export default function ReportTabs({ kind, query }: { kind: string; query: Record<string, string> }) {
  const g = REPORT_GROUPS.find((x) => x.tabs.some((t) => t.kind === kind));
  // Satu tab saja tidak perlu ditampilkan sebagai pilihan.
  if (!g || g.tabs.length < 2) return null;
  const keep = new URLSearchParams(Object.entries(query).filter(([k]) => ["from", "to", "category", "proc", "mc", "part"].includes(k))).toString();
  return (
    <nav className={`no-print grid grid-cols-2 gap-2 sm:gap-3 ${g.tabs.length > 3 ? "lg:grid-cols-4" : g.tabs.length > 2 ? "sm:grid-cols-3 lg:max-w-4xl" : "sm:max-w-xl"}`} aria-label="Jenis report">
      {g.tabs.map((t) => {
        const on = t.kind === kind;
        const c = COLORS[t.color];
        return (
          <Link
            key={t.kind}
            href={`${t.href ?? `/reports/${t.kind}`}${keep && !t.href?.endsWith("/production-report") ? `?${keep}` : ""}`}
            aria-current={on ? "page" : undefined}
            className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition sm:px-4 sm:py-3 ${on ? `${c.on} shadow-md` : `bg-white text-slate-800 ring-slate-200 ${c.hover} hover:shadow-sm`}`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 ${on ? "bg-white/20 text-white" : c.bubble}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS[t.icon]} />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight sm:truncate sm:text-[15px]">{t.label}</span>
              <span className={`mt-0.5 block text-xs leading-tight sm:truncate ${on ? "text-white/80" : "text-slate-500"}`}>{t.desc}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
