import Link from "next/link";

/** Report yang satu tema digabung dalam tab, filter periode/kategori ikut terbawa. */
export const REPORT_GROUPS: {
  key: string;
  name: string;
  tabs: { kind: string; label: string }[];
}[] = [
  {
    key: "report:ng-type",
    name: "Kualitas",
    tabs: [
      { kind: "ng-type", label: "Per jenis NG" },
      { kind: "ng-lot", label: "Per lot" },
    ],
  },
  {
    key: "report:member",
    name: "Produksi",
    tabs: [
      { kind: "member", label: "Member" },
      { kind: "category", label: "Kategori & Part" },
      { kind: "daily", label: "Harian" },
      { kind: "monthly", label: "Bulanan" },
    ],
  },
];

/** Nama kelompok untuk breadcrumb (Pusat Laporan / Produksi). */
export const groupNameOf = (kind: string) => REPORT_GROUPS.find((g) => g.tabs.some((t) => t.kind === kind))?.name;

export const navKeyOf = (kind: string) => REPORT_GROUPS.find((g) => g.tabs.some((t) => t.kind === kind))?.key ?? `report:${kind}`;

export default function ReportTabs({ kind, query }: { kind: string; query: Record<string, string> }) {
  const g = REPORT_GROUPS.find((x) => x.tabs.some((t) => t.kind === kind));
  if (!g) return null;
  const keep = new URLSearchParams(Object.entries(query).filter(([k]) => ["from", "to", "category"].includes(k))).toString();
  return (
    <div className="no-print relative flex items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-slate-500">Lihat per</span>
      <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pr-6 [scrollbar-width:none]" aria-label="Jenis report">
        {g.tabs.map((t) => {
          const on = t.kind === kind;
          return (
            <Link
              key={t.kind}
              href={`/reports/${t.kind}${keep ? `?${keep}` : ""}`}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${on ? "bg-white text-brand-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {/* Tanda masih ada tab di kanan saat layar sempit. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#f4f6f8] sm:hidden" />
    </div>
  );
}
