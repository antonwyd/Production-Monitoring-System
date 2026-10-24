import Link from "next/link";

/** Report yang satu tema digabung dalam tab, filter periode/kategori ikut terbawa. */
export const REPORT_GROUPS: { key: string; tabs: { kind: string; label: string }[] }[] = [
  { key: "report:ng-type", tabs: [{ kind: "ng-type", label: "Per jenis NG" }, { kind: "ng-lot", label: "Per lot" }] },
  {
    key: "report:member",
    tabs: [
      { kind: "member", label: "Per member" },
      { kind: "category", label: "Per kategori & part" },
      { kind: "daily", label: "Harian" },
      { kind: "monthly", label: "Rekap bulanan" },
    ],
  },
];

export const navKeyOf = (kind: string) => REPORT_GROUPS.find((g) => g.tabs.some((t) => t.kind === kind))?.key ?? `report:${kind}`;

export default function ReportTabs({ kind, query }: { kind: string; query: Record<string, string> }) {
  const g = REPORT_GROUPS.find((x) => x.tabs.some((t) => t.kind === kind));
  if (!g) return null;
  const keep = new URLSearchParams(Object.entries(query).filter(([k]) => ["from", "to", "category"].includes(k))).toString();
  return (
    <nav className="no-print -mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Jenis report">
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
  );
}
