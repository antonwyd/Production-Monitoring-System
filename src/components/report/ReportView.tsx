import Link from "next/link";
import type { Report, ReportKind, ReportParams } from "@/lib/reports";
import { REPORT_TITLES } from "@/lib/reports";
import { formatCell } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import { partLabel } from "@/lib/rules";
import Charts from "./Charts";
import PrintButton from "./PrintButton";
import Icon from "@/components/Icon";

const NAV: ReportKind[] = ["dashboard", "daily", "member", "category", "machine", "ng-type", "ng-lot", "monthly"];
const href = (k: ReportKind) => (k === "dashboard" ? "/dashboard" : `/reports/${k}`);

const GRADE_CLS: Record<string, string> = {
  A: "badge-success",
  B: "badge-brand",
  C: "badge-warning",
  D: "badge-danger",
};
const STATUS_CLS: Record<string, string> = {
  Disetujui: "badge-success",
  Menunggu: "badge-warning",
  Ditolak: "badge-danger",
  "Belum lapor": "badge-danger",
};
const isNum = (f?: string) => !!f && f !== "text" && f !== "grade";

export default function ReportView({
  report,
  params,
  master,
  query,
  defaults,
}: {
  report: Report;
  params: ReportParams;
  master: MasterData;
  query: string;
  defaults: { from: string; to: string; date: string; month: string };
}) {
  const k = report.kind;
  const usesRange = !["daily", "monthly"].includes(k);
  const usesCategory = k !== "member";
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{report.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span className="num">{report.subtitle}</span>
            <span className="badge-neutral">
              <Icon name="checkCircle" size={12} className="text-emerald-600" />
              Hanya data yang sudah disetujui leader
            </span>
          </p>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          <a className="btn-secondary btn-sm min-h-10 flex-1 sm:flex-none" href={`/api/export/${k}.xlsx${query ? `?${query}` : ""}`}>
            <Icon name="download" size={16} />
            Export Excel
          </a>
          <PrintButton />
        </div>
      </header>

      <nav className="no-print -mx-4 mb-5 flex overflow-x-auto border-b border-slate-200 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Jenis report">
        {NAV.map((n) => {
          const on = n === k;
          return (
            <Link
              key={n}
              href={href(n)}
              aria-current={on ? "page" : undefined}
              className={`relative shrink-0 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors first:pl-0 sm:first:pl-3 ${
                on ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {REPORT_TITLES[n].replace("Report ", "")}
              <span className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full first:left-0 ${on ? "bg-brand-600" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </nav>

      <form className="no-print mb-6 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" method="get">
        {usesRange && (
          <>
            <label className="sm:w-44">
              <span className="label">Dari</span>
              <input type="date" name="from" className="input py-2" defaultValue={params.from ?? defaults.from} />
            </label>
            <label className="sm:w-44">
              <span className="label">Sampai</span>
              <input type="date" name="to" className="input py-2" defaultValue={params.to ?? defaults.to} />
            </label>
          </>
        )}
        {k === "daily" && (
          <label className="sm:w-44">
            <span className="label">Tanggal</span>
            <input type="date" name="date" className="input py-2" defaultValue={params.date ?? defaults.date} />
          </label>
        )}
        {k === "monthly" && (
          <label className="sm:w-44">
            <span className="label">Bulan</span>
            <input type="month" name="month" className="input py-2" defaultValue={params.month ?? defaults.month} />
          </label>
        )}
        {usesCategory && (
          <label className="sm:w-52">
            <span className="label">Kategori</span>
            <select name="category" className="select py-2" defaultValue={params.categoryId ?? ""}>
              <option value="">Semua kategori</option>
              {master.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {k === "member" && (
          <label className="col-span-2 sm:w-64">
            <span className="label">Member</span>
            <select name="member" className="select py-2" defaultValue={params.memberId ?? master.members[0]?.id}>
              {master.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.nik})
                </option>
              ))}
            </select>
          </label>
        )}
        {k === "ng-lot" && (
          <label className="col-span-2 sm:w-64">
            <span className="label">Part</span>
            <select name="part" className="select py-2" defaultValue={params.partId ?? ""}>
              <option value="">Semua part</option>
              {master.parts
                .filter((p) => !params.categoryId || p.categoryId === params.categoryId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {partLabel(p)}
                  </option>
                ))}
            </select>
          </label>
        )}
        <button className="btn-primary col-span-2 min-h-11 sm:col-span-1 sm:px-5">
          <Icon name="filter" size={15} />
          Tampilkan
        </button>
      </form>

      {report.kpis.length > 0 && (
        <div className="card mb-6 grid grid-cols-2 overflow-hidden sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {report.kpis.map((kpi) => (
            <div key={kpi.label} className="-mr-px -mb-px border-r border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="text-[13px] leading-snug font-medium text-slate-500">{kpi.label}</div>
              <div className="num mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{formatCell(kpi.value, kpi.format)}</div>
              {kpi.hint && <div className="mt-0.5 text-xs text-slate-500">{kpi.hint}</div>}
            </div>
          ))}
        </div>
      )}

      <Charts charts={report.charts} />

      {report.tables.map((t) => (
        <section key={t.title} className="card mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5">
            <h2 className="section-title">{t.title}</h2>
            <span className="num text-xs text-slate-500">{t.rows.length} baris</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="text-left">
                <tr>
                  {t.columns.map((c) => (
                    <th key={c.key} className={isNum(c.format) ? "text-right" : ""}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.length === 0 && (
                  <tr>
                    <td colSpan={t.columns.length} className="py-12 text-center text-slate-400">
                      Belum ada data di periode ini.
                    </td>
                  </tr>
                )}
                {[...t.rows, ...(t.total && t.rows.length ? [t.total] : [])].map((r, i) => {
                  const isTotal = t.total && i === t.rows.length;
                  return (
                    <tr key={i} className={isTotal ? "[&>td]:border-t [&>td]:border-slate-200 [&>td]:bg-slate-50 [&>td]:font-semibold [&>td]:text-slate-900" : ""}>
                      {t.columns.map((c, ci) => {
                        const v = r[c.key];
                        return (
                          <td key={c.key} className={`${isNum(c.format) ? "text-right" : ""} ${ci === 0 && !isTotal ? "text-slate-900" : ""}`}>
                            {c.format === "grade" && v && v !== "-" ? (
                              <span className={`${GRADE_CLS[String(v)] ?? "badge-neutral"} w-6 justify-center font-semibold`}>{v}</span>
                            ) : c.key === "status" && typeof v === "string" && STATUS_CLS[v] ? (
                              <span className={STATUS_CLS[v]}>{v}</span>
                            ) : (
                              formatCell(v, c.format)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
