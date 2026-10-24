import type { Report, ReportParams } from "@/lib/reports";
import { formatCell } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import { partLabel } from "@/lib/rules";
import Charts from "./Charts";
import { Grade } from "@/components/ui";
import FilterBar, { type FilterSelect } from "./FilterBar";
import KpiCards from "./KpiCards";
import ReportTabs, { groupNameOf } from "./ReportTabs";
import Link from "next/link";
import ShowAll from "./ShowAll";
import DataStatus from "@/components/DataStatus";

const isNum = (f?: string) => !!f && f !== "text" && f !== "grade" && f !== "date";
/** Tabel rincian dilipat setelah baris ini. */
const FOLD = 10;

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

      {report.tables.map((t) => {
        const fold = t.detail && t.rows.length > FOLD + 2;
        return (
          <section key={t.title} className="group card overflow-hidden" data-open="false">
            <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
              <div>
                <h2 className="text-lg font-bold">{t.title}</h2>
                {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
              </div>
              {t.rows.length > 0 && <span className="shrink-0 text-xs text-slate-500">{t.rows.length} baris</span>}
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white text-left">
                  <tr>
                    {t.columns.map((c) => (
                      <th key={c.key} className={`whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500 first:pl-5 last:pr-5 ${isNum(c.format) ? "text-right" : ""} ${c.format === "grade" ? "text-center" : ""}`}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.length === 0 && (
                    <tr>
                      <td colSpan={t.columns.length} className="px-3 py-10 text-center text-slate-400">
                        Belum ada data di periode ini.
                      </td>
                    </tr>
                  )}
                  {[...t.rows, ...(t.total && t.rows.length ? [t.total] : [])].map((r, i) => {
                    const isTotal = t.total && i === t.rows.length;
                    const missing = r.status === "Belum lapor";
                    const idle = r.status === "Tidak jalan";
                    return (
                      <tr
                        key={i}
                        className={`border-t border-slate-100 ${isTotal ? "border-t-2 border-slate-300 bg-brand-50/60 font-bold" : "hover:bg-slate-50"} ${missing ? "bg-orange-50/60 text-orange-900" : ""} ${idle ? "text-slate-400" : ""} ${fold && i >= FOLD && !isTotal ? "group-data-[open=false]:hidden" : ""}`}
                      >
                        {t.columns.map((c, j) => (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5 ${isNum(c.format) ? "text-right tabular-nums" : ""} ${c.format === "grade" ? "text-center" : ""} ${j === 0 && !isTotal ? "font-medium" : ""}`}
                          >
                            {c.format === "grade" ? (
                              <Grade g={String(r[c.key] ?? "")} />
                            ) : c.key === "status" && (r[c.key] === "OK" || r[c.key] === "Di bawah target") ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r[c.key] === "OK" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{r[c.key]}</span>
                            ) : (
                              formatCell(r[c.key], c.format)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {fold && <ShowAll total={t.rows.length} shown={FOLD} />}
          </section>
        );
      })}
    </main>
  );
}
