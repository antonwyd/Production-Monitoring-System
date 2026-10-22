import Link from "next/link";
import type { Report, ReportKind, ReportParams } from "@/lib/reports";
import { formatCell } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import { partLabel } from "@/lib/rules";
import Charts from "./Charts";
import { Grade } from "@/components/ui";
import PrintButton from "./PrintButton";

// Nama tab singkat, bahasa lantai produksi.
const NAV: { k: ReportKind; label: string }[] = [
  { k: "daily", label: "Harian" },
  { k: "member", label: "Per Member" },
  { k: "category", label: "Per Kategori" },
  { k: "machine", label: "Mesin PF" },
  { k: "ng-type", label: "Jenis NG" },
  { k: "ng-lot", label: "NG per Lot" },
  { k: "monthly", label: "Rekap Bulanan" },
];
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
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-12 pt-6">
      <div>
        <Link href="/laporan" className="no-print text-sm text-slate-500 hover:text-brand-600">
          ← Kembali ke Laporan
        </Link>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{report.title}</h1>
        <p className="text-sm text-slate-500">{report.subtitle} · hanya laporan yang sudah disetujui</p>
      </div>

      <nav className="no-print -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {NAV.map((n) => (
            <Link
              key={n.k}
              href={`/reports/${n.k}`}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${n.k === k ? "bg-brand-600 font-semibold text-white shadow-sm" : "font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-600"}`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </nav>

      <form className="no-print card flex flex-wrap items-end gap-3 px-5 py-4" method="get">
        {usesRange && (
          <>
            <label>
              <span className="block text-sm text-slate-500">Dari</span>
              <input type="date" name="from" className="input mt-1 h-11" defaultValue={params.from ?? defaults.from} />
            </label>
            <label>
              <span className="block text-sm text-slate-500">Sampai</span>
              <input type="date" name="to" className="input mt-1 h-11" defaultValue={params.to ?? defaults.to} />
            </label>
          </>
        )}
        {k === "daily" && (
          <label>
            <span className="block text-sm text-slate-500">Tanggal</span>
            <input type="date" name="date" className="input mt-1 h-11" defaultValue={params.date ?? defaults.date} />
          </label>
        )}
        {k === "monthly" && (
          <label>
            <span className="block text-sm text-slate-500">Bulan</span>
            <input type="month" name="month" className="input mt-1 h-11" defaultValue={params.month ?? defaults.month} />
          </label>
        )}
        {usesCategory && (
          <label>
            <span className="block text-sm text-slate-500">Kategori</span>
            <select name="category" className="input mt-1 h-11" defaultValue={params.categoryId ?? ""}>
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
            <span className="block text-sm text-slate-500">Member</span>
            <select name="member" className="input mt-1 h-11" defaultValue={params.memberId ?? master.members[0]?.id}>
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
            <span className="block text-sm text-slate-500">Part</span>
            <select name="part" className="input mt-1 h-11" defaultValue={params.partId ?? ""}>
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
        <button className="btn-secondary h-11">Tampilkan</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-primary h-11" href={`/api/export/${k}.xlsx${query ? `?${query}` : ""}`}>
            Download Excel
          </a>
          <PrintButton label="Download PDF" />
        </div>
      </form>

      {report.kpis.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {report.kpis.map((kpi) => (
            <div key={kpi.label} className="card flex flex-col gap-1 px-5 py-4">
              <div className="text-sm text-slate-500">{kpi.label}</div>
              <div className="text-2xl font-bold tabular-nums sm:text-3xl">{formatCell(kpi.value, kpi.format)}</div>
              {kpi.hint && <div className="text-xs text-slate-500">{kpi.hint}</div>}
            </div>
          ))}
        </section>
      )}

      <Charts charts={report.charts} />

      {report.tables.map((t) => (
        <section key={t.title} className="card overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
            <h2 className="text-lg font-bold">{t.title}</h2>
            {t.rows.length > 0 && <span className="text-xs text-slate-500">{t.rows.length} baris</span>}
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
                  return (
                    <tr
                      key={i}
                      className={`border-t border-slate-100 ${isTotal ? "border-t-2 border-slate-300 bg-brand-50/60 font-bold" : "hover:bg-slate-50"} ${missing ? "bg-orange-50/60 text-orange-900" : ""}`}
                    >
                      {t.columns.map((c, j) => (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5 ${isNum(c.format) ? "text-right tabular-nums" : ""} ${c.format === "grade" ? "text-center" : ""} ${j === 0 && !isTotal ? "font-medium" : ""}`}
                        >
                          {c.format === "grade" ? <Grade g={String(r[c.key] ?? "")} /> : formatCell(r[c.key], c.format)}
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
    </main>
  );
}
