import type { Report, ReportParams } from "@/lib/reports";
import type { MasterData } from "@/lib/types";
import { partLabel } from "@/lib/rules";
import Charts from "./Charts";
import FilterBar, { type FilterSelect } from "./FilterBar";
import KpiCards from "./KpiCards";
import ReportTabs, { groupNameOf } from "./ReportTabs";
import Link from "next/link";
import ReportTable from "./ReportTable";
import DataStatus from "@/components/DataStatus";

export default function ReportView({
  report,
  params,
  master,
  query,
  today,
  defaults,
  asOf,
}: {
  report: Report;
  params: ReportParams;
  master: MasterData;
  query: Record<string, string>;
  today: string;
  defaults: { from: string; to: string; date: string; month: string };
  asOf?: number;
}) {
  const k = report.kind;
  const mode = k === "daily" ? "date" : k === "monthly" ? "month" : "range";
  const usesCategory = k !== "member" && k !== "disiplin";
  const qs = new URLSearchParams(query).toString();
  const selects: FilterSelect[] = [];
  if (usesCategory)
    selects.push({
      name: "category",
      label: "Kategori",
      value: String(params.categoryId ?? ""),
      options: [{ value: "", label: "Semua kategori" }, ...master.categories.map((c) => ({ value: String(c.id), label: c.name }))],
    });
  if (k === "member")
    selects.push({
      name: "member",
      label: "Member",
      value: String(params.memberId ?? master.members[0]?.id ?? ""),
      options: master.members.map((m) => ({ value: String(m.id), label: `${m.name} (${m.nik})` })),
    });
  if (k === "ng-lot" || k === "ng-type")
    selects.push({
      name: "part",
      label: "Part",
      value: String(params.partId ?? ""),
      options: [
        { value: "", label: "Semua part" },
        ...master.parts.filter((p) => !params.categoryId || p.categoryId === params.categoryId).map((p) => ({ value: String(p.id), label: partLabel(p) })),
      ],
    });
  const approvedOnly = k !== "disiplin";

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-12 pt-5 sm:gap-5 lg:px-8 lg:pt-6">
      <div className="flex flex-col gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="no-print mb-1 text-xs text-slate-500">
            <Link href="/laporan" className="hover:text-brand-600">
              Pusat Laporan
            </Link>
            {groupNameOf(k) && <span> / {groupNameOf(k)}</span>}
          </nav>
          <h1 className="text-2xl font-bold sm:text-3xl">{report.title}</h1>
          <p className="text-sm text-slate-500">
            {report.subtitle}
            {approvedOnly && " · hanya laporan yang sudah disetujui"}
          </p>
          {asOf && <DataStatus asOf={asOf} className="mt-1" />}
        </div>
        <ReportTabs kind={k} query={query} />
      </div>

      <FilterBar
        mode={mode}
        from={params.from ?? defaults.from}
        to={params.to ?? defaults.to}
        date={params.date ?? defaults.date}
        month={params.month ?? defaults.month}
        today={today}
        selects={selects}
        search={
          k === "ng-type"
            ? { name: "q", label: "Cari lot / oiban", placeholder: "Cari lot atau oiban, mis. 0123", value: params.q ?? "" }
            : k === "category"
              ? { name: "q", label: "Cari part", placeholder: "Cari part, mis. 627D1", value: params.q ?? "" }
              : undefined
        }
        downloads={[
          { label: "Excel (.xlsx)", hint: "Kop + angka vs target + semua tabel, siap cetak A4", href: `/api/export/${k}.xlsx${qs ? `?${qs}` : ""}` },
          { label: "PDF", hint: "Untuk dikirim atau dicetak, dengan kotak tanda tangan", href: `/api/export/${k}.pdf${qs ? `?${qs}` : ""}` },
        ]}
      />

      <KpiCards kpis={report.kpis} />

      <Charts charts={report.charts} />

      {report.tables.map((t) => (
        <ReportTable key={t.title} t={t} />
      ))}
    </main>
  );
}
