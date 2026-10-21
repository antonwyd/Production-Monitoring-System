import Link from "next/link";
import type { Report, ReportKind, ReportParams } from "@/lib/reports";
import { REPORT_TITLES } from "@/lib/reports";
import { formatCell } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import { partLabel } from "@/lib/rules";
import Charts from "./Charts";
import PrintButton from "./PrintButton";

const NAV: ReportKind[] = ["dashboard", "daily", "member", "category", "machine", "ng-type", "ng-lot", "monthly"];
const href = (k: ReportKind) => (k === "dashboard" ? "/dashboard" : `/reports/${k}`);

const GRADE_CLS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-sky-100 text-sky-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-red-100 text-red-800",
};

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
    <div className="mx-auto max-w-7xl px-3 pb-10 pt-4">
      <nav className="no-print mb-4 flex gap-1 overflow-x-auto">
        {NAV.map((n) => (
          <Link
            key={n}
            href={href(n)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${n === k ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            {REPORT_TITLES[n].replace("Report ", "")}
          </Link>
        ))}
      </nav>

      <form className="no-print card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        {usesRange && (
          <>
            <label>
              <span className="label">Dari</span>
              <input type="date" name="from" className="input" defaultValue={params.from ?? defaults.from} />
            </label>
            <label>
              <span className="label">Sampai</span>
              <input type="date" name="to" className="input" defaultValue={params.to ?? defaults.to} />
            </label>
          </>
        )}
        {k === "daily" && (
          <label>
            <span className="label">Tanggal</span>
            <input type="date" name="date" className="input" defaultValue={params.date ?? defaults.date} />
          </label>
        )}
        {k === "monthly" && (
          <label>
            <span className="label">Bulan</span>
            <input type="month" name="month" className="input" defaultValue={params.month ?? defaults.month} />
          </label>
        )}
        {usesCategory && (
          <label>
            <span className="label">Kategori</span>
            <select name="category" className="input" defaultValue={params.categoryId ?? ""}>
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
          <label>
            <span className="label">Member</span>
            <select name="member" className="input" defaultValue={params.memberId ?? master.members[0]?.id}>
              {master.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.nik})
                </option>
              ))}
            </select>
          </label>
        )}
        {k === "ng-lot" && (
          <label>
            <span className="label">Part</span>
            <select name="part" className="input" defaultValue={params.partId ?? ""}>
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
        <button className="btn-primary">Tampilkan</button>
        <div className="ml-auto flex gap-2">
          <a className="btn-secondary" href={`/api/export/${k}.xlsx${query ? `?${query}` : ""}`}>
            Export Excel
          </a>
          <PrintButton />
        </div>
      </form>

      <header className="mb-4">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <p className="text-slate-600">{report.subtitle} · hanya data yang sudah disetujui leader</p>
      </header>

      {report.kpis.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {report.kpis.map((kpi) => (
            <div key={kpi.label} className="card p-3">
              <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
              <div className="text-2xl font-bold">{formatCell(kpi.value, kpi.format)}</div>
              {kpi.hint && <div className="text-xs text-slate-500">{kpi.hint}</div>}
            </div>
          ))}
        </div>
      )}

      <Charts charts={report.charts} />

      {report.tables.map((t) => (
        <section key={t.title} className="card mb-4 overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-bold">{t.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  {t.columns.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.format && c.format !== "text" && c.format !== "grade" ? "text-right" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.length === 0 && (
                  <tr>
                    <td colSpan={t.columns.length} className="px-3 py-8 text-center text-slate-400">
                      Belum ada data di periode ini.
                    </td>
                  </tr>
                )}
                {[...t.rows, ...(t.total && t.rows.length ? [t.total] : [])].map((r, i) => {
                  const isTotal = t.total && i === t.rows.length;
                  return (
                    <tr key={i} className={`border-t border-slate-100 ${isTotal ? "bg-slate-50 font-bold" : ""} ${r.status === "Belum lapor" ? "text-red-700" : ""}`}>
                      {t.columns.map((c) => (
                        <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.format && c.format !== "text" && c.format !== "grade" ? "text-right tabular-nums" : ""}`}>
                          {c.format === "grade" && r[c.key] && r[c.key] !== "-" ? (
                            <span className={`rounded px-2 py-0.5 text-xs font-bold ${GRADE_CLS[String(r[c.key])] ?? ""}`}>{r[c.key]}</span>
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
        </section>
      ))}
    </div>
  );
}
