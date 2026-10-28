"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { MonthlyReport, Progress, SectionReport } from "@/lib/monthly";
import MonthlyChart from "./MonthlyChart";

// Plan vs Actual: 1) posisi semua section dibanding plan s/d hari ini, 2) kartu per section,
// 3) detail satu section (grafik, angka kunci, Plan & Result, part, data harian).

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const dm = (d: string) => `${Number(d.slice(8))} ${BLN[Number(d.slice(5, 7)) - 1]}`;
const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));
const d1 = (v: number | null | undefined) => (v == null ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pc = (v: number | null | undefined, digits = 1) => (v == null ? "-" : `${(v * 100).toFixed(digits).replace(".", ",")}%`);
/** 31.778.200 -> "31,8 jt", 845.000 -> "845 rb". */
const big = (v: number | null | undefined) =>
  v == null ? "-" : Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : Math.abs(v) >= 1e4 ? `${Math.round(v / 1e3).toLocaleString("id-ID")} rb` : n0(v);

const STATUS: Record<Progress["status"], { label: string; chip: string; bar: string; text: string }> = {
  ahead: { label: "Sesuai plan", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", text: "text-emerald-700" },
  near: { label: "Sedikit di bawah", chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-500", text: "text-amber-700" },
  behind: { label: "Di bawah plan", chip: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-600", text: "text-red-700" },
  noplan: { label: "Plan belum diisi", chip: "bg-slate-100 text-slate-600 ring-slate-200", bar: "bg-slate-400", text: "text-slate-700" },
  nodata: { label: "Belum mulai", chip: "bg-slate-100 text-slate-600 ring-slate-200", bar: "bg-slate-400", text: "text-slate-700" },
};

function Chip({ status }: { status: Progress["status"] }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${s.chip}`}>{s.label}</span>;
}

/** Batang progres: isi = result / plan sebulan, garis tegak = posisi plan s/d hari ini. */
function Meter({ p, tall }: { p: Progress; tall?: boolean }) {
  const fill = Math.min(1, p.pctMonth ?? 0);
  const mark = p.planMonth && p.planToDate != null ? Math.min(1, p.planToDate / p.planMonth) : null;
  return (
    <div className={`relative w-full rounded-full bg-slate-100 ${tall ? "h-3" : "h-2"}`}>
      <div className={`h-full rounded-full ${STATUS[p.status].bar}`} style={{ width: `${fill * 100}%` }} />
      {mark != null && mark < 1 && <div className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-slate-700" style={{ left: `calc(${mark * 100}% - 1px)` }} title="Plan s/d kemarin" />}
    </div>
  );
}

function Spark({ s }: { s: SectionReport }) {
  const asOf = s.progress?.asOf ?? "";
  const data = s.daily.map((d) => ({ p: s.hasPlan ? d.cumPlan : null, r: d.date <= asOf ? d.cumResult : null }));
  return (
    <div className="h-12">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          {s.hasPlan && <Line dataKey="p" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
          <Line dataKey="r" stroke="#9b1b1f" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Overview({ r, live }: { r: MonthlyReport; live: boolean }) {
  const ps = r.sections.map((s) => s.progress!).filter(Boolean);
  const withPlan = ps.filter((p) => p.planMonth != null);
  const sum = (f: (p: Progress) => number | null) => withPlan.reduce((a, p) => a + (f(p) ?? 0), 0);
  const result = sum((p) => p.result);
  const toDate = sum((p) => p.planToDate);
  const month = sum((p) => p.planMonth);
  const forecast = withPlan.every((p) => p.forecast != null) ? sum((p) => p.forecast) : null;
  const pct = toDate ? result / toDate : null;
  const status: Progress["status"] = !withPlan.length ? "noplan" : pct == null ? "nodata" : pct >= 1 ? "ahead" : pct >= 0.95 ? "near" : "behind";
  const first = ps[0];
  const count = (st: Progress["status"][]) => ps.filter((p) => st.includes(p.status)).length;
  const total: Progress = { ...first, result, planToDate: toDate, planMonth: month || null, pctToDate: pct, pctMonth: month ? result / month : null, forecast, status, needPerDay: null };
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{live ? `Pencapaian s/d ${dm(r.asOf)}` : `Pencapaian ${r.label}`}</span>
            <Chip status={status} />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className={`text-5xl font-bold tabular-nums tracking-tight ${STATUS[status].text}`}>{pc(pct)}</div>
            <div className="pb-1.5 text-sm text-slate-600">
              <b className="text-slate-900">{n0(result)}</b> pcs dari plan {n0(toDate)} {live ? "s/d kemarin" : ""}
            </div>
          </div>
          <div>
            <Meter p={total} tall />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500">
              <span>
                Hari kerja {first?.workDone ?? 0} dari {first?.workTotal ?? 0}
              </span>
              <span>Plan bulan ini {n0(month)}</span>
            </div>
          </div>
          {withPlan.length < ps.length && <p className="text-xs text-slate-500">Total hanya menghitung section yang plannya sudah diisi.</p>}
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 lg:border-l lg:border-t-0">
          {[
            ["Result bulan ini", big(result), "semua section ber-plan"],
            ["Proyeksi akhir bulan", big(forecast), forecast != null && month ? `${pc(forecast / month, 0)} dari plan` : "-"],
            ["Section sesuai plan", `${count(["ahead"])} / ${ps.length}`, `${count(["near", "behind"])} di bawah plan`],
            ["Plan belum diisi", String(count(["noplan"])), count(["noplan"]) ? "minta leader isi plan" : "semua lengkap"],
          ].map(([k, v, h]) => (
            <div key={k} className="bg-white px-5 py-4">
              <div className="text-xs text-slate-500">{k}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{v}</div>
              <div className="mt-0.5 text-xs text-slate-500">{h}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Scorecard({ s, on, pick, live }: { s: SectionReport; on: boolean; pick: () => void; live: boolean }) {
  const p = s.progress!;
  return (
    <button
      type="button"
      onClick={pick}
      aria-pressed={on}
      className={`card flex flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${on ? "ring-2 ring-brand-600" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold leading-tight">{s.def.name}</div>
          <div className="text-xs text-slate-500">{s.def.unit === "machine" ? "per mesin" : "per member"}</div>
        </div>
        <Chip status={p.status} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={`text-3xl font-bold tabular-nums ${STATUS[p.status].text}`}>{s.hasPlan ? pc(p.pctToDate, 0) : big(p.result)}</div>
        <div className="pb-1 text-right text-xs text-slate-500">
          {s.hasPlan ? (
            <>
              {big(p.result)} / {big(p.planToDate)}
              <br />
              {live ? "s/d kemarin" : "bulan ini"}
            </>
          ) : (
            "pcs bulan ini"
          )}
        </div>
      </div>
      {s.hasPlan && <Meter p={p} />}
      <Spark s={s} />
      <div className="flex justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span>
          Proyeksi <b className="text-slate-800">{big(p.forecast)}</b>
          {p.forecast != null && p.planMonth ? ` (${pc(p.forecast / p.planMonth, 0)})` : ""}
        </span>
        {p.needPerDay != null && live && (
          <span>
            Perlu <b className="text-slate-800">{big(p.needPerDay)}</b>/hari
          </span>
        )}
      </div>
    </button>
  );
}

const TH = "px-2 sm:px-3 py-2 text-xs font-semibold text-slate-500";
const TD = "border-t border-slate-100 px-2 sm:px-3 py-2 tabular-nums";

function PlanResult({ s, r, live }: { s: SectionReport; r: MonthlyReport; live: boolean }) {
  const short = (m: string) => `${BLN[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className={`${TH} text-left`}>Indikator</th>
            <th className={`${TH} text-right`}>Plan {short(r.month)}</th>
            <th className={`${TH} text-right`}>Result</th>
            <th className={`${TH} text-right`}>%</th>
            <th className={`${TH} hidden text-right sm:table-cell`}>Plan {short(r.nextMonth)}</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l, i) => {
            const f = l.format === "dec1" ? d1 : n0;
            // Hijau/merah hanya untuk Production (bulan selesai) dan Productivity; jam & jumlah orang bukan target "lebih besar lebih baik".
            const judged = i === 5 || (i === 0 && !live);
            const color = l.pct == null || !judged ? "" : l.pct >= 1 ? "text-emerald-700" : "text-red-700";
            return (
              <tr key={l.label}>
                <td className={`${TD} font-medium text-slate-700`}>{l.label}</td>
                <td className={`${TD} text-right`}>{f(l.plan)}</td>
                <td className={`${TD} text-right font-semibold`}>{f(l.result)}</td>
                <td className={`${TD} text-right font-semibold ${color}`}>{pc(l.pct)}</td>
                <td className={`${TD} hidden text-right text-slate-500 sm:table-cell`}>{f(l.next)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {live && <p className="mt-2 text-xs text-slate-500">Bulan masih berjalan: Result = s/d kemarin, % dibanding plan sebulan penuh.</p>}
    </div>
  );
}

function Parts({ s }: { s: SectionReport }) {
  if (!s.parts.length) return <p className="text-sm text-slate-400">Belum ada data part.</p>;
  const top = s.parts.slice(0, 6);
  const q = s.quality;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {top.map((p) => (
          <li key={`${p.category}|${p.part}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{p.part}</span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {big(p.qty)} <span className="text-xs text-slate-400">· {pc(p.share, 0)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600/80" style={{ width: `${Math.max(2, (p.qty / top[0].qty) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {s.parts.length > top.length && <p className="text-xs text-slate-500">+ {s.parts.length - top.length} part lainnya (lengkap di Excel/PDF dan tab Detail per part).</p>}
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        NG rate <b className="text-slate-900">{pc(q.rate, 2)}</b> ({n0(q.ng)} pcs)
        {q.top.length > 0 && ` · terbanyak ${q.top.slice(0, 3).map((t) => t.name).join(", ")}`}
      </div>
    </div>
  );
}

function Daily({ s }: { s: SectionReport }) {
  return (
    <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {["Tanggal", "Plan", ...s.columns, "Total", "Selisih"].map((h) => (
              <th key={h} className={`${TH} whitespace-nowrap text-right first:text-left`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.daily.map((d) => (
            <tr key={d.date} className={d.work ? "" : "bg-slate-50 text-slate-400"}>
              <td className={`${TD} whitespace-nowrap ${d.work ? "" : "text-red-600"}`}>{dm(d.date)}</td>
              <td className={`${TD} text-right`}>{d.plan ? n0(d.plan) : "-"}</td>
              {d.cols.map((v, i) => (
                <td key={i} className={`${TD} text-right`}>
                  {v ? n0(v) : ""}
                </td>
              ))}
              <td className={`${TD} text-right font-semibold text-slate-800`}>{d.total ? n0(d.total) : "-"}</td>
              <td className={`${TD} text-right ${d.balance < 0 ? "text-red-700" : d.balance > 0 ? "text-emerald-700" : ""}`}>{d.plan || d.total ? `${d.balance > 0 ? "+" : ""}${n0(d.balance)}` : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-brand-50 font-bold">
          <tr>
            <td className={TD}>Total</td>
            <td className={`${TD} text-right`}>{n0(s.total.plan)}</td>
            {s.total.cols.map((v, i) => (
              <td key={i} className={`${TD} text-right`}>
                {n0(v)}
              </td>
            ))}
            <td className={`${TD} text-right`}>{n0(s.total.total)}</td>
            <td className={`${TD} text-right ${s.total.balance < 0 ? "text-red-700" : "text-emerald-700"}`}>{s.hasPlan ? n0(s.total.balance) : "-"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Detail({ s, r, live, canPlan }: { s: SectionReport; r: MonthlyReport; live: boolean; canPlan: boolean }) {
  const p = s.progress!;
  const prod = s.lines[5];
  const ot = s.lines[3];
  const tiles: [string, string, string, string?][] = [
    [live ? `Pencapaian s/d ${dm(p.asOf)}` : "Pencapaian", s.hasPlan ? pc(p.pctToDate) : "-", s.hasPlan ? `${n0(p.result)} dari ${n0(p.planToDate)}` : "plan belum diisi", STATUS[p.status].text],
    ["Proyeksi akhir bulan", big(p.forecast), p.forecast != null && p.planMonth ? `${pc(p.forecast / p.planMonth, 0)} dari plan ${big(p.planMonth)}` : "kecepatan rata-rata per hari kerja"],
    [live ? "Perlu per hari kerja" : "Selisih vs plan", live ? big(p.needPerDay) : s.hasPlan ? n0(s.total.balance) : "-", live ? `${p.workTotal - p.workDone} hari kerja tersisa` : "result - plan"],
    ["Productivity", n0(prod.result), prod.plan ? `plan ${n0(prod.plan)} · ${pc(prod.pct, 0)}` : s.def.unit === "machine" ? "pcs/mesin/jam" : "pcs/orang/jam"],
    ["Lembur rata-rata", ot.result == null ? "-" : `${d1(ot.result)} jam`, `per ${s.def.unit === "machine" ? "mesin" : "member"}, ${n0(s.lines[4].result)} ${s.def.unit === "machine" ? "mesin" : "member"}`],
  ];
  return (
    <section id="detail" className="card scroll-mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{s.def.name}</h2>
            <Chip status={p.status} />
          </div>
          <p className="text-xs text-slate-500">
            {s.def.categories.join(" + ")} · PIC {s.pic || "-"}
            {s.missing.length > 0 && <span className="text-amber-700"> · tidak ada di Master Data: {s.missing.join(", ")}</span>}
          </p>
        </div>
        {canPlan && (
          <Link href={`/production-report/plan?month=${r.month}#${s.def.key}`} className="btn-secondary h-9 px-3 text-sm">
            {s.hasPlan ? "Ubah plan" : "Isi plan"}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([k, v, h, c], i) => (
          <div key={k} className={`bg-white px-5 py-3 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
            <div className="text-xs text-slate-500">{k}</div>
            <div className={`mt-0.5 text-xl font-bold tabular-nums ${c ?? ""}`}>{v}</div>
            <div className="text-xs text-slate-500">{h}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MonthlyChart daily={s.daily} hasPlan={s.hasPlan} asOf={live ? p.asOf : undefined} />
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Part terbesar</h3>
            <Parts s={s} />
          </div>
          {s.note && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-semibold">Catatan leader: </span>
              {s.note}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-100 p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Plan & Result</h3>
          <div className="-mx-2 sm:mx-0"><PlanResult s={s} r={r} live={live} /></div>
        </div>
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-brand-600">
            <span className="transition group-open:rotate-90">›</span> Data harian ({s.daily.filter((d) => d.total).length} hari produksi)
          </summary>
          <div className="mt-3">
            <Daily s={s} />
          </div>
        </details>
      </div>
    </section>
  );
}

export default function PresdirView({ report, canPlan, live }: { report: MonthlyReport; canPlan: boolean; live: boolean }) {
  const keys = report.sections.map((s) => s.def.key);
  const [sel, setSel] = useState(keys[0]);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (keys.includes(h)) setSel(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (k: string, scroll = false) => {
    setSel(k);
    history.replaceState(null, "", `#${k}`);
    if (scroll) document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const s = report.sections.find((x) => x.def.key === sel) ?? report.sections[0];
  return (
    <div className="flex flex-col gap-5">
      <Overview r={report} live={live} />
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Per section</h2>
          <span className="hidden text-xs text-slate-500 sm:inline">
            Garis tegak di batang = posisi plan {live ? "s/d kemarin" : ""} · klik kartu untuk detail
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.sections.map((x) => (
            <Scorecard key={x.def.key} s={x} on={x.def.key === s.def.key} pick={() => pick(x.def.key, true)} live={live} />
          ))}
        </div>
      </div>
      <nav className="no-print sticky top-0 z-20 -mx-4 overflow-x-auto bg-[#f4f6f8]/95 px-4 py-2 backdrop-blur lg:-mx-8 lg:px-8" aria-label="Pilih section">
        <div className="flex w-max gap-1.5">
          {report.sections.map((x) => (
            <button
              key={x.def.key}
              type="button"
              onClick={() => pick(x.def.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${x.def.key === s.def.key ? "bg-brand-600 text-white shadow" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}
            >
              {x.def.name}
            </button>
          ))}
        </div>
      </nav>
      <Detail s={s} r={report} live={live} canPlan={canPlan} />
    </div>
  );
}
