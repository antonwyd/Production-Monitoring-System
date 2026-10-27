import Link from "next/link";
import AppShell from "@/components/AppShell";
import DataStatus from "@/components/DataStatus";
import DownloadMenu from "@/components/report/DownloadMenu";
import MonthlyChart from "@/components/monthly/MonthlyChart";
import { requirePageRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { buildMonthly, defaultMonth, isValidMonth, monthLabel, monthShort, nextMonthOf, prevMonthOf, type SectionReport } from "@/lib/monthly";
import { withDataAge } from "@/lib/reports";

export const metadata = { title: "Production Report · QA Production" };

const n0 = (v: number | null) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));
const d1 = (v: number | null) => (v == null ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pc = (v: number | null, digits = 1) => (v == null ? "-" : `${(v * 100).toFixed(digits).replace(".", ",")}%`);
const bal = (v: number) => (v < 0 ? <span className="text-red-700">({n0(-v)})</span> : n0(v));
const TH = "px-2.5 py-2 text-xs font-semibold text-white bg-brand-600 border border-brand-700/40";
const TD = "border border-slate-200 px-2.5 py-1.5 tabular-nums";

function PlanResult({ s, month }: { s: SectionReport; month: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            <th rowSpan={2} className={`${TH} text-left`}>
              Description
            </th>
            <th colSpan={3} className={TH}>
              {monthShort(month)}
            </th>
            <th colSpan={2} className={TH}>
              {monthShort(nextMonthOf(month))}
            </th>
          </tr>
          <tr>
            {["Plan", "Result", "%", "Plan", "Result"].map((h, i) => (
              <th key={i} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l, i) => {
            const f = l.format === "dec1" ? d1 : n0;
            return (
              <tr key={l.label}>
                <td className={`${TD} font-semibold`}>{l.label}</td>
                <td className={`${TD} text-right`}>{f(l.plan)}</td>
                <td className={`${TD} text-right`}>{f(l.result)}</td>
                <td className={`${TD} text-right font-semibold ${i === 0 && l.pct != null ? (l.pct >= 1 ? "text-emerald-700" : "text-red-700") : ""}`}>{pc(l.pct)}</td>
                <td className={`${TD} text-right`}>{f(l.next)}</td>
                <td className={`${TD} text-right text-slate-400`}>-</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Daily({ s }: { s: SectionReport }) {
  return (
    <div className="max-h-[640px] overflow-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th rowSpan={2} className={TH}>
              Date
            </th>
            <th rowSpan={2} className={TH}>
              Daily Plan
            </th>
            <th colSpan={s.columns.length + 1} className={TH}>
              Daily Result
            </th>
            <th rowSpan={2} className={TH}>
              Balance
            </th>
          </tr>
          <tr>
            {[...s.columns, "Total"].map((c) => (
              <th key={c} className={`${TH} whitespace-nowrap`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.daily.map((d) => (
            <tr key={d.date} className={d.work ? "" : "bg-slate-50"}>
              <td className={`${TD} text-center whitespace-nowrap ${d.work ? "" : "text-red-700"}`}>{`${d.day}-${monthShort(d.date.slice(0, 7)).slice(0, 3)}`}</td>
              <td className={`${TD} text-right`}>{n0(d.plan)}</td>
              {d.cols.map((v, i) => (
                <td key={i} className={`${TD} text-right`}>
                  {v ? n0(v) : ""}
                </td>
              ))}
              <td className={`${TD} text-right font-semibold`}>{d.total ? n0(d.total) : "-"}</td>
              <td className={`${TD} text-right`}>{bal(d.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0">
          <tr className="bg-brand-50 font-bold">
            <td className={`${TD} text-center`}>Total</td>
            <td className={`${TD} text-right`}>{n0(s.total.plan)}</td>
            {s.total.cols.map((v, i) => (
              <td key={i} className={`${TD} text-right`}>
                {n0(v)}
              </td>
            ))}
            <td className={`${TD} text-right`}>{n0(s.total.total)}</td>
            <td className={`${TD} text-right`}>{bal(s.total.balance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Parts({ s }: { s: SectionReport }) {
  if (!s.parts.length) return null;
  const q = s.quality;
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer select-none text-sm font-semibold text-brand-600 hover:underline">
        4. Per part & kualitas ({s.parts.length} part · NG rate {pc(q.rate, 2)})
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Total OK {n0(q.qty)} pcs · NG {n0(q.ng)} pcs
        {q.top.length > 0 && ` · NG terbanyak: ${q.top.slice(0, 3).map((t) => `${t.name} ${n0(t.qty)} (${pc(t.share, 0)})`).join(", ")}`}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              {["Part", "Kategori", "Result (pcs)", "Porsi", "OT (pcs)", "NG (pcs)", "NG rate", "NG terbanyak"].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.parts.map((p) => (
              <tr key={`${p.category}|${p.part}`}>
                <td className={`${TD} font-semibold whitespace-nowrap`}>{p.part}</td>
                <td className={TD}>{p.category}</td>
                <td className={`${TD} text-right`}>{n0(p.qty)}</td>
                <td className={`${TD} text-right`}>{pc(p.share)}</td>
                <td className={`${TD} text-right`}>{p.qtyOt ? n0(p.qtyOt) : "-"}</td>
                <td className={`${TD} text-right`}>{p.ng ? n0(p.ng) : "-"}</td>
                <td className={`${TD} text-right`}>{pc(p.rate, 2)}</td>
                <td className={TD}>{p.topNg || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default async function ProductionReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const today = todayJakarta();
  const month = isValidMonth(q.month) ? q.month : defaultMonth(today);
  const { value: r, asOf } = await withDataAge(() => buildMonthly(month));
  const canPlan = session.role === "leader" || session.role === "admin";
  const noPlan = r.sections.filter((s) => !s.hasPlan);
  const nav = "btn-secondary h-10 px-3";

  return (
    <AppShell session={session} active="production-report">
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Production Report</h1>
            <p className="text-sm text-slate-500">Laporan akhir bulan untuk Presdir · Plan diisi leader, Result dari laporan yang sudah disetujui.</p>
            <DataStatus asOf={asOf} className="mt-1" />
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Link href={`?month=${prevMonthOf(month)}`} className={nav} aria-label="Bulan sebelumnya">
              ‹
            </Link>
            <span className="min-w-36 text-center font-semibold">{monthLabel(month)}</span>
            <Link href={`?month=${nextMonthOf(month)}`} className={nav} aria-label="Bulan berikutnya">
              ›
            </Link>
            {canPlan && (
              <Link href={`/production-report/plan?month=${month}`} className="btn-secondary h-10 px-4">
                Isi Plan
              </Link>
            )}
            <DownloadMenu
              links={[
                { label: "Excel (.xlsx)", hint: "Ringkasan + 1 sheet per section, dengan grafik", href: `/api/production-report/production-report.xlsx?month=${month}` },
                { label: "PDF", hint: "Siap kirim ke Presdir, 1 halaman per section", href: `/api/production-report/production-report.pdf?month=${month}` },
              ]}
            />
          </div>
        </div>

        {noPlan.length > 0 && (
          <div className="card border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            Plan {monthLabel(month)} belum diisi untuk: <b>{noPlan.map((s) => s.def.name).join(", ")}</b>.{" "}
            {canPlan ? (
              <Link href={`/production-report/plan?month=${month}`} className="font-semibold underline">
                Isi sekarang
              </Link>
            ) : (
              "Minta leader mengisi di menu Production Report."
            )}
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="px-5 pt-4 font-bold">Ringkasan Plan vs Result · {r.label}</div>
          <div className="overflow-x-auto p-5 pt-3">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  {["Section", "Plan", "Result", "%", "Balance", "Member/MC", "Productivity Plan", "Productivity Result", `Plan ${monthShort(r.nextMonth)}`, "PIC"].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.sections.map((s) => (
                  <tr key={s.def.key}>
                    <td className={`${TD} font-semibold`}>
                      <a href={`#${s.def.key}`} className="hover:underline">
                        {s.def.name}
                      </a>
                    </td>
                    <td className={`${TD} text-right`}>{n0(s.lines[0].plan)}</td>
                    <td className={`${TD} text-right`}>{n0(s.lines[0].result)}</td>
                    <td className={`${TD} text-right font-semibold ${s.lines[0].pct == null ? "" : s.lines[0].pct >= 1 ? "text-emerald-700" : "text-red-700"}`}>{pc(s.lines[0].pct)}</td>
                    <td className={`${TD} text-right`}>{s.hasPlan ? bal(s.total.balance) : "-"}</td>
                    <td className={`${TD} text-right`}>
                      {n0(s.lines[4].result)} / {n0(s.lines[4].plan)}
                    </td>
                    <td className={`${TD} text-right`}>{n0(s.lines[5].plan)}</td>
                    <td className={`${TD} text-right`}>{n0(s.lines[5].result)}</td>
                    <td className={`${TD} text-right`}>{n0(s.lines[0].next)}</td>
                    <td className={TD}>{s.pic || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Member/MC = result / plan. Productivity = pcs per jam per member (Senbetsu/Seiretsu) atau per mesin (PF). Time Required = Production ÷ (Productivity × Member/MC). Need Over Time = Time Required − Time Normal.
            </p>
          </div>
        </section>

        {r.sections.map((s) => (
          <section key={s.def.key} id={s.def.key} className="card scroll-mt-4 p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{s.def.name}</h2>
              <span className="text-xs text-slate-500">
                PIC: {s.pic || "-"} · {s.def.categories.join(" + ")}
                {s.missing.length > 0 && <span className="text-amber-700"> · kategori tidak ada di Master Data: {s.missing.join(", ")}</span>}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-brand-600">1. Chart</h3>
                  <MonthlyChart daily={s.daily} hasPlan={s.hasPlan} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-brand-600">3. Plan & Result</h3>
                  <PlanResult s={s} month={month} />
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Notes: </span>
                  {s.note || <span className="text-slate-400">{s.hasPlan ? "-" : "Plan bulan ini belum diisi."}</span>}
                </div>
                <Parts s={s} />
              </div>
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-semibold text-brand-600">2. Daily Production</h3>
                <Daily s={s} />
              </div>
            </div>
          </section>
        ))}
      </main>
    </AppShell>
  );
}
