"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ALL, ALL_PARTS, addMonths, diffStatus, fyLabel, fyOf, ymLabel, type ForecastReport, type MonthPoint, type PartPoint } from "@/lib/forecast";
import DownloadMenu from "@/components/report/DownloadMenu";
import ForecastUpload from "./ForecastUpload";
import ForecastManual from "./ForecastManual";

// Forecast vs Actual PO (mengikuti mockup Anton 6 Nov 2026):
// filter FY / customer / part · 5 KPI · tren FY + achievement · gauge · per customer · rekap bulanan · insight,
// lalu detail per part dan PO harian untuk bulan terpilih.

const MAROON = "#9b1b1f";
const RED = "#d62a32";
const GREY = "#b9c3d1";
const SLATE = "#475569";
const UP = "#047857";
const DOWN = "#b91c1c";
const TIP = { borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12, padding: "8px 12px" };
const AX = { fontSize: 11, fill: "#64748b" };

const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));
const big = (v: number | null | undefined) =>
  v == null ? "-" : Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt` : Math.abs(v) >= 1e4 ? `${Math.round(v / 1e3).toLocaleString("id-ID")} rb` : n0(v);
const pc = (v: number | null | undefined, d = 1) => (v == null ? "-" : v > 9.99 ? ">+999%" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(d).replace(".", ",")}%`);
const pct = (v: number | null | undefined, d = 1) => (v == null ? "-" : `${(v * 100).toFixed(d).replace(".", ",")}%`);
const axisBig = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}rb` : String(v));
const tone = (v: number | null | undefined) => (v == null ? "text-slate-500" : v > 0.0005 ? "text-emerald-700" : v < -0.0005 ? "text-red-700" : "text-slate-600");
/** Achievement: >=95% hijau, 85-95% kuning, <85% merah. */
const achTone = (v: number | null | undefined) => (v == null ? "text-slate-500" : v >= 0.95 ? "text-emerald-700" : v >= 0.85 ? "text-amber-600" : "text-red-700");
const achColor = (v: number | null | undefined) => (v == null ? "#94a3b8" : v >= 0.95 ? "#16a34a" : v >= 0.85 ? "#d97706" : "#dc2626");

function Ico({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01M21 3l-9 9",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14L7 22l5-3 5 3-1.5-8",
  scale: "M12 3v18M7 21h10M3 7h18M6 7l-3 7a3 3 0 0 0 6 0L6 7zM18 7l-3 7a3 3 0 0 0 6 0l-3-7",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  warn: "M12 3l10 18H2L12 3zM12 10v4M12 18h.01",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  check: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  down: "M12 3v12M7 10l5 5 5-5M5 21h14",
};

export default function ForecastView({ r, canEdit, isAdmin, customers }: { r: ForecastReport; canEdit: boolean; isAdmin: boolean; customers: string[] }) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [manual, setManual] = useState(false);
  const go = (q: { c?: string; m?: string; fy?: number; p?: string }) => {
    const p = new URLSearchParams();
    p.set("fy", String(q.fy ?? (q.m ? fyOf(q.m) : r.fy)));
    p.set("c", q.c ?? r.customer);
    const part = q.p ?? r.part;
    if (part !== ALL_PARTS) p.set("p", part);
    if (q.m) p.set("m", q.m);
    router.push(`/forecast?${p}`, { scroll: false });
  };
  const sel = r.sel;
  const allCustomers = [...new Set([...r.customers, ...customers])].sort();
  const lastVer = r.versions[r.versions.length - 1];
  const custQ = encodeURIComponent(r.customer);

  const Filter = ({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) => (
    <label className="relative flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
      {icon && <Ico d={icon} className="h-5 w-5 shrink-0 text-slate-500" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
        {children}
      </span>
    </label>
  );
  const selCls = "w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-5 text-sm font-semibold text-slate-900 outline-none";
  const chevron = <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">▾</span>;

  const header = (
    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Ico d={I.chart} className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold sm:whitespace-nowrap sm:text-3xl">Forecast vs Actual PO</h1>
          <p className="text-sm text-slate-500">Perbandingan rencana (Forecast) dan realisasi PO customer</p>
        </div>
      </div>
      <div className="no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {r.fys.length > 0 && (
          <Filter label="Fiscal Year" icon={I.cal}>
            <select className={selCls} value={r.fy} onChange={(e) => go({ fy: Number(e.target.value) })} aria-label="Fiscal year">
              {r.fys.map((f) => (
                <option key={f} value={f}>
                  {fyLabel(f)}
                </option>
              ))}
            </select>
            {chevron}
          </Filter>
        )}
        {r.customers.length > 0 && (
          <Filter label="Customer">
            <select className={selCls} value={r.customer} onChange={(e) => go({ c: e.target.value, p: ALL_PARTS })} aria-label="Customer">
              {r.customers.length > 1 && <option value={ALL}>{ALL}</option>}
              {r.customers.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {chevron}
          </Filter>
        )}
        {r.partsList.length > 0 && (
          <Filter label="Part No.">
            <select className={selCls} value={r.part} onChange={(e) => go({ p: e.target.value, m: r.selected ?? undefined })} aria-label="Part">
              <option value={ALL_PARTS}>{ALL_PARTS}</option>
              {r.partsList.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {chevron}
          </Filter>
        )}
        <div className="col-span-2 flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button className="btn-secondary h-12 flex-1 rounded-xl px-3 sm:flex-none" onClick={() => setManual(true)}>
                ✎ Input
              </button>
              <button className="btn-primary h-12 flex-1 rounded-xl px-4 sm:flex-none" onClick={() => setUpload(true)}>
                <Ico d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                Upload
              </button>
            </>
          )}
          <DownloadMenu
            compact
            className="[&>button]:h-12 [&>button]:rounded-xl"
            links={[
              ...(sel ? [{ label: "Excel laporan (.xlsx)", hint: "Ringkasan FY, rekap bulanan, per part, PO harian", href: `/api/forecast/forecast-vs-po.xlsx?c=${custQ}&fy=${r.fy}&m=${sel.bulan}${r.part !== ALL_PARTS ? `&p=${encodeURIComponent(r.part)}` : ""}` }] : []),
              { label: "Template upload (.xlsx)", hint: "Format sama dengan file forecast customer", href: `/api/forecast/template.xlsx?c=${custQ}&versi=${lastVer ? addMonths(lastVer.versi, 1) : ""}` },
            ]}
          />
        </div>
      </div>
    </div>
  );

  const modals = (
    <>
      {upload && <ForecastUpload customers={allCustomers} defaultCustomer={r.customer === ALL ? "" : r.customer} versions={r.versions.map((v) => `${v.versi}|${v.customer}`)} onClose={() => setUpload(false)} onSaved={(c) => (setUpload(false), go({ c }), router.refresh())} />}
      {manual && (
        <ForecastManual
          customers={allCustomers}
          defaultCustomer={r.customer === ALL ? "" : r.customer}
          month={sel?.bulan ?? new Date().toISOString().slice(0, 7)}
          parts={r.customer === ALL ? [] : r.parts}
          onClose={() => setManual(false)}
          onSaved={(c, m) => (setManual(false), go({ c, m }), router.refresh())}
        />
      )}
    </>
  );

  if (!sel) {
    return (
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        {header}
        <section className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Ico d={I.chart} className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Belum ada data forecast</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Upload file forecast dari customer (format seperti &quot;11. TKI Nov 2026.xlsx&quot;: sheet bulanan + sheet harian). Riwayat forecast vs aktual sejak 2022 di file itu langsung terbaca.</p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => setUpload(true)}>
                Upload file forecast
              </button>
              <button className="btn-secondary" onClick={() => setManual(true)}>
                Input manual
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Minta leader atau admin meng-upload file forecast.</p>
          )}
        </section>
        {modals}
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
      {header}
      <Kpis r={r} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,0.85fr)_minmax(0,1fr)]">
        <TrendCard r={r} onPick={(m) => go({ m })} />
        <GaugeCard r={r} />
        <CustomerCard r={r} onPick={(c) => go({ c, p: ALL_PARTS })} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <RekapCard r={r} onPick={(m) => go({ m })} />
        <InsightCard r={r} onPart={(p) => go({ p, m: r.selected ?? undefined })} />
      </div>
      <PartsCard r={r} />
      {r.daily.length > 0 && <DailyCard r={r} />}
      <p className="text-xs text-slate-400">
        {lastVer ? `File terakhir: ${lastVer.customer} versi ${ymLabel(lastVer.versi, true)} · ${lastVer.sumber} oleh ${lastVer.by}, ${lastVer.at.slice(0, 16)}. ` : ""}
        Achievement = PO ÷ forecast, hanya bulan yang punya forecast dan PO. Hijau ≥95%, kuning 85–95%, merah &lt;85%.
      </p>
      {isAdmin && <VersionsCard r={r} />}
      {modals}
    </main>
  );
}

// ---------- 1. KPI ----------
function Kpis({ r }: { r: ForecastReport }) {
  const s = r.fySum;
  const last = s.last;
  const prevFy = `FY${r.fy - 1}`;
  const fyMonthsDone = r.fyPoints.filter((m) => m.actual !== null);
  const noFc = fyMonthsDone.filter((m) => m.forecast === null).map((m) => ymLabel(m.bulan));
  const range = fyMonthsDone.length ? `${ymLabel(fyMonthsDone[0].bulan)} – ${ymLabel(fyMonthsDone[fyMonthsDone.length - 1].bulan)}` : "";
  const card = "card relative flex flex-col items-start gap-2 overflow-hidden p-3 sm:flex-row sm:gap-3 sm:p-4 lg:px-3.5";
  const tile = (bg: string, fg: string, d: string) => (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${fg}`}>
      <Ico d={d} />
    </span>
  );
  const vs = (v: number | null) =>
    v == null ? (
      <span className="text-slate-400">belum ada pembanding</span>
    ) : (
      <span className={`font-semibold ${tone(v)}`}>
        {v >= 0 ? "▲" : "▼"} {pc(v)} <span className="font-normal text-slate-500">vs {prevFy}</span>
      </span>
    );
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className={`${card} bg-gradient-to-br from-sky-50 to-white`}>
          {tile("bg-sky-100", "text-sky-700", I.target)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Total Forecast <span className="font-normal text-slate-500">(pcs)</span></div>
            <div className="whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem]">
              {n0(s.forecast)}
            </div>
            <div className="text-xs">{vs(s.forecastGrowth)}</div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-rose-50 to-white`}>
          {tile("bg-rose-100", "text-rose-700", I.box)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Total Actual PO <span className="font-normal text-slate-500">(pcs)</span></div>
            <div className="whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem]">
              {n0(s.actual)}
            </div>
            <div className="text-xs">{vs(s.actualGrowth)}</div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-emerald-50 to-white`}>
          {tile("bg-emerald-100", "text-emerald-700", I.award)}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-700">Achievement</div>
            <div className={`text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem] ${achTone(s.achievement)}`}>{pct(s.achievement)}</div>
            <div className="text-xs text-slate-500">vs Forecast</div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
              <div className="anim-bar h-full rounded-full" style={{ width: `${Math.min(100, (s.achievement ?? 0) * 100)}%`, background: achColor(s.achievement) }} />
            </div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-indigo-50 to-white`}>
          {tile("bg-indigo-100", "text-indigo-700", I.scale)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Gap <span className="font-normal text-slate-500">(pcs)</span></div>
            <div className={`whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem] ${tone(s.gap)}`}>
              {s.gap != null && s.gap > 0 ? "+" : ""}
              {n0(s.gap)}
            </div>
            <div className="text-xs">
              <span className={`font-semibold ${tone(s.gapPct)}`}>{pc(s.gapPct)}</span> <span className="text-slate-500">dari Forecast</span>
            </div>
          </div>
        </div>
        <div className={`${card.replace("flex-col items-start", "flex-row items-start")} col-span-2 bg-gradient-to-br from-violet-50 to-white lg:col-span-1`}>
          {tile("bg-violet-100", "text-violet-700", I.trend)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Tren vs Bulan Lalu</div>
            <div className={`text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem] ${tone(last?.mom)}`}>
              {last?.mom == null ? "-" : `${last.mom >= 0 ? "▲" : "▼"} ${pc(last.mom)}`}
            </div>
            <div className="text-xs text-slate-500">{last ? `PO ${ymLabel(last.bulan)} vs ${ymLabel(addMonths(last.bulan, -1))}` : "-"}</div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {fyLabel(r.fy)} · PO {range}
        {s.matched === 0 && s.months > 0 && <> · Forecast untuk FY ini belum tercatat, hanya PO yang ditampilkan</>}
        {s.matched > 0 && s.matched < s.months && <> · Forecast &amp; Achievement dihitung {s.matched} bulan yang ada forecast{noFc.length <= 3 ? ` (tanpa ${noFc.join(", ")})` : ""}</>}
        {r.part !== ALL_PARTS && <> · Forecast per part hanya ada untuk bulan yang file forecast-nya di-upload</>}
      </p>
    </section>
  );
}

// ---------- 2. tren FY ----------
const RANGES = [
  { k: 0, label: "FY" },
  { k: 24, label: "24 bln" },
  { k: -1, label: "Semua" },
];

function TrendCard({ r, onPick }: { r: ForecastReport; onPick: (m: string) => void }) {
  const [range, setRange] = useState(0);
  const [view, setView] = useState<"chart" | "table">("chart");
  const data = useMemo(() => {
    const sel = r.sel!.bulan;
    let pts: MonthPoint[];
    if (range === 0) pts = r.fyPoints;
    else {
      const fut = r.months.filter((m) => m.bulan > sel);
      const upto = r.months.filter((m) => m.bulan <= sel);
      pts = [...(range > 0 ? upto.slice(-range) : upto), ...fut];
    }
    return pts.map((m) => ({ ...m, label: ymLabel(m.bulan), short: ymLabel(m.bulan).split(" ")[0], top: Math.max(m.actual ?? 0, m.forecast ?? 0) || null }));
  }, [r, range]);
  const many = data.length > 14;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(window.innerWidth < 640), []);
  const chips = data.length <= 14 && !narrow;
  type D = (typeof data)[number];
  const Chip = (props: { x?: number; y?: number; index?: number }) => {
    const d = data[props.index ?? 0];
    if (!d || d.ach == null || props.x == null || props.y == null) return null;
    const txt = pct(d.ach);
    const w = txt.length * 6.2 + 10;
    return (
      <g transform={`translate(${props.x - w / 2},${props.y - 26})`}>
        <rect width={w} height={18} rx={9} fill="#fffbeb" stroke="#facc15" />
        <text x={w / 2} y={12.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={achColor(d.ach)}>
          {txt}
        </text>
      </g>
    );
  };
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Ico d={I.chart} className="h-5 w-5 text-brand-600" />
          Tren Forecast vs Actual PO {range === 0 ? `(FY${r.fy})` : ""}
        </h2>
        <div className="flex gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {RANGES.map((x) => (
              <button key={x.k} onClick={() => setRange(x.k)} className={`rounded-md px-2.5 py-1 font-medium ${range === x.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {(["chart", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 font-medium ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {v === "chart" ? "Grafik" : "Tabel"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "chart" ? (
        <>
          <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm" style={{ background: GREY }} /> Forecast
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm" style={{ background: RED }} /> Actual PO
            </span>
            {chips && (
              <span className="flex items-center gap-1.5">
                <i className="h-3 w-5 rounded-full border border-yellow-400 bg-amber-50" /> Achievement
              </span>
            )}
          </div>
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 30, right: 6, left: 0, bottom: 0 }} barGap={2} barCategoryGap={many ? "14%" : "22%"}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey={range === 0 ? "short" : "label"} tick={AX} interval={many ? "preserveStartEnd" : 0} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={TIP}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#cbd5e1" }}
                  cursor={{ fill: "rgba(155,27,31,0.06)" }}
                  labelFormatter={(_, p) => {
                    const d = p?.[0]?.payload as D | undefined;
                    return d ? `${ymLabel(d.bulan, true)}${d.ach != null ? ` · Achievement ${pct(d.ach)}` : d.kind === "forecast" ? " · baru forecast" : ""}` : "";
                  }}
                  formatter={(v: unknown, n: unknown) => (n === "top" ? [null, null] : [`${n0(v as number)} pcs`, String(n)])}
                />
                <Bar dataKey="forecast" name="Forecast" fill={GREY} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(d) => (d as unknown as D).actual != null && onPick((d as unknown as D).bulan)} className="cursor-pointer" />
                <Bar dataKey="actual" name="Actual PO" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(d) => onPick((d as unknown as D).bulan)} className="cursor-pointer">
                  {data.map((d) => (
                    <Cell key={d.bulan} fill={RED} fillOpacity={d.bulan === r.sel!.bulan ? 1 : 0.85} stroke={d.bulan === r.sel!.bulan ? "#7f1519" : undefined} strokeWidth={d.bulan === r.sel!.bulan ? 2 : 0} />
                  ))}
                </Bar>
                {chips && <Line dataKey="top" name="top" stroke="transparent" dot={false} activeDot={false} isAnimationActive={false} label={<Chip />} legendType="none" />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">Klik batang untuk melihat detail bulan itu. Bulan tanpa batang merah = baru forecast.</p>
        </>
      ) : (
        <div className="max-h-[22rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Bulan</th>
                <th className="px-3 py-2 text-right">Forecast</th>
                <th className="px-3 py-2 text-right">PO</th>
                <th className="px-3 py-2 text-right">Ach.</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">vs thn lalu</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((m) => (
                <tr key={m.bulan} onClick={() => m.actual != null && onPick(m.bulan)} className={`cursor-pointer border-t border-slate-100 tabular-nums hover:bg-slate-50 ${m.bulan === r.sel!.bulan ? "bg-brand-50" : ""}`}>
                  <td className="px-3 py-1.5 font-medium">{ymLabel(m.bulan, true)}</td>
                  <td className="px-3 py-1.5 text-right">{n0(m.forecast)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{n0(m.actual)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${achTone(m.ach)}`}>{pct(m.ach)}</td>
                  <td className={`hidden px-3 py-1.5 text-right sm:table-cell ${tone(m.yoy)}`}>{pc(m.yoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- 3. gauge ----------
function Gauge({ v }: { v: number | null }) {
  // Setengah lingkaran 0–120%; jarum di 100% = forecast.
  const max = 1.2;
  const f = Math.max(0, Math.min(max, v ?? 0)) / max;
  const R = 80,
    cx = 100,
    cy = 96;
  const pt = (t: number) => [cx - R * Math.cos(Math.PI * t), cy - R * Math.sin(Math.PI * t)];
  const [x1, y1] = pt(f);
  const [mx, my] = pt(1 / max);
  const [mx2, my2] = [cx - (R + 12) * Math.cos(Math.PI / max), cy - (R + 12) * Math.sin(Math.PI / max)];
  return (
    <svg viewBox="0 0 200 112" className="mx-auto w-full max-w-[15rem]" role="img" aria-label={`Achievement ${pct(v)}`}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth={16} strokeLinecap="round" />
      {v != null && f > 0 && <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x1} ${y1}`} fill="none" stroke={achColor(v)} strokeWidth={16} strokeLinecap="round" />}
      <line x1={mx} y1={my} x2={mx2} y2={my2} stroke="#334155" strokeWidth={2} />
      <text x={mx2} y={my2 - 3} textAnchor="middle" fontSize={8} fill="#64748b">
        100%
      </text>
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={26} fontWeight={800} fill="#0f172a">
        {pct(v)}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={10} fill="#64748b">
        vs Forecast
      </text>
    </svg>
  );
}

function GaugeCard({ r }: { r: ForecastReport }) {
  const s = r.fySum;
  const row = (icon: string, k: string, v: React.ReactNode, cls = "") => (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 py-2 text-sm first:border-t-0">
      <span className="flex items-center gap-2 text-slate-600">
        <Ico d={icon} className="h-4 w-4 text-slate-400" />
        {k}
      </span>
      <span className={`font-semibold tabular-nums ${cls}`}>{v}</span>
    </div>
  );
  return (
    <section className="card flex flex-col p-4 sm:p-5">
      <h2 className="text-center font-bold">Achievement FY{r.fy}</h2>
      <div className="flex flex-1 items-center py-2">
        <Gauge v={s.achievement} />
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-1">
        {row(I.target, "Forecast", `${n0(s.forecast)} pcs`)}
        {row(I.box, "Actual PO", `${n0(s.actual)} pcs`)}
        {row(I.warn, "Gap", `${s.gap != null && s.gap > 0 ? "+" : ""}${n0(s.gap)} pcs`, tone(s.gap))}
        {s.remaining != null && row(I.cal, `Sisa forecast (${s.remainingMonths} bln)`, `${n0(s.remaining)} pcs`, "text-slate-700")}
      </div>
    </section>
  );
}

// ---------- 4. per customer ----------
function CustomerCard({ r, onPick }: { r: ForecastReport; onPick: (c: string) => void }) {
  const max = Math.max(1, ...r.perCustomer.map((c) => c.actual));
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Ico d={I.trend} className="h-5 w-5 text-brand-600" />
        Actual PO per Customer
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-2 py-1.5 text-left font-semibold">Customer</th>
            <th className="px-2 py-1.5 text-right font-semibold">Actual (pcs)</th>
            <th className="rounded-r-lg px-2 py-1.5 text-right font-semibold">Ach. (%)</th>
          </tr>
        </thead>
        <tbody>
          {r.perCustomer.map((c) => (
            <tr key={c.customer} className={`cursor-pointer hover:bg-slate-50 ${r.customer === c.customer ? "bg-brand-50" : ""}`} onClick={() => onPick(c.customer)} title="Lihat customer ini saja">
              <td className="px-2 py-2">
                <div className="truncate font-medium">{c.customer}</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="anim-bar h-full rounded-full" style={{ width: `${(c.actual / max) * 100}%`, background: RED }} />
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{n0(c.actual)}</td>
              <td className={`px-2 py-2 text-right font-semibold tabular-nums ${achTone(c.ach)}`}>{pct(c.ach)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.perCustomer.length === 1 && <p className="mt-3 text-xs text-slate-500">Customer lain muncul di sini setelah file forecast-nya di-upload.</p>}
    </section>
  );
}

// ---------- 5. rekap bulanan ----------
function RekapCard({ r, onPick }: { r: ForecastReport; onPick: (m: string) => void }) {
  const [future, setFuture] = useState(false);
  const rows = r.fyPoints.filter((m) => m.actual !== null || (future && m.forecast !== null));
  const s = r.fySum;
  const hasFuture = r.fyPoints.some((m) => m.actual === null && m.forecast !== null);
  const TH = "px-3 py-2 text-xs font-semibold";
  const TD = "px-3 py-2 tabular-nums";
  return (
    <section className="card overflow-hidden p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Ico d={I.cal} className="h-5 w-5 text-brand-600" />
          Rekap Bulanan Forecast vs Actual
        </h2>
        {hasFuture && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={future} onChange={(e) => setFuture(e.target.checked)} className="accent-brand-600" /> Tampilkan forecast bulan depan
          </label>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className={`${TH} rounded-l-lg text-left`}>Bulan</th>
              <th className={`${TH} text-right`}>Forecast (pcs)</th>
              <th className={`${TH} text-right`}>Actual PO (pcs)</th>
              <th className={`${TH} text-right`}>Gap (pcs)</th>
              <th className={`${TH} text-right`}>Achievement</th>
              <th className={`${TH} rounded-r-lg text-right`}>Tren vs Bulan Lalu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const on = m.bulan === r.selected;
              const fut = m.actual === null;
              return (
                <tr
                  key={m.bulan}
                  onClick={() => !fut && onPick(m.bulan)}
                  className={`border-t border-slate-100 ${fut ? "text-slate-400" : "cursor-pointer hover:bg-slate-50"} ${on ? "bg-rose-50 font-semibold [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg" : ""}`}
                >
                  <td className={`${TD} font-medium`}>
                    {ymLabel(m.bulan)}
                    {fut && <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase">forecast</span>}
                  </td>
                  <td className={`${TD} text-right`}>{n0(m.forecast)}</td>
                  <td className={`${TD} text-right`}>{n0(m.actual)}</td>
                  <td className={`${TD} text-right ${tone(m.diff)}`}>{m.diff != null && m.diff > 0 ? "+" : ""}{n0(m.diff)}</td>
                  <td className={`${TD} text-right font-semibold ${achTone(m.ach)}`}>{pct(m.ach)}</td>
                  <td className={`${TD} text-right ${tone(m.mom)}`}>{m.mom == null || fut ? "–" : `${m.mom >= 0 ? "▲" : "▼"} ${pc(m.mom)}`}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 font-bold text-white">
              <td className={`${TD} rounded-l-lg`}>
                Total (YTD)
                {s.matched < s.months && <sup>*</sup>}
              </td>
              <td className={`${TD} text-right`}>{n0(s.forecast)}</td>
              <td className={`${TD} text-right`}>{n0(s.actual)}</td>
              <td className={`${TD} text-right`}>{s.gap != null && s.gap > 0 ? "+" : ""}{n0(s.gap)}</td>
              <td className={`${TD} text-right`}>{pct(s.achievement)}</td>
              <td className={`${TD} rounded-r-lg text-right`}>–</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {s.matched < s.months && (
        <p className="mt-2 text-xs text-slate-500">
          * Total hanya bulan yang punya forecast. PO semua bulan FY ini: <b>{n0(s.actualAll)}</b> pcs.
        </p>
      )}
    </section>
  );
}

// ---------- 6. insight & tindak lanjut ----------
function InsightCard({ r, onPart }: { r: ForecastReport; onPart: (p: string) => void }) {
  const s = r.fySum;
  const worst = r.fyPoints.filter((m) => m.diff != null).sort((a, b) => a.diff! - b.diff!)[0];
  const best = r.fyPoints.filter((m) => m.diff != null).sort((a, b) => b.diff! - a.diff!)[0];
  const multi = r.perCustomer.length > 1 && r.customer === ALL;
  const weakCust = r.perCustomer.filter((c) => c.ach != null && c.ach < 0.95).sort((a, b) => a.ach! - b.ach!);
  const weakParts = r.parts.filter((p) => p.pct != null && p.pct < -0.1 && (p.forecast ?? 0) > 0).sort((a, b) => a.diff! - b.diff!).slice(0, 3);
  const ahead = r.months.filter((m) => m.kind === "forecast").slice(0, 3);
  const avgAhead = ahead.length ? ahead.reduce((a, m) => a + (m.forecast ?? 0), 0) / ahead.length : null;
  const bias = r.stats.bias;
  const Item = ({ icon, color, title, children, onClick }: { icon: string; color: string; title: string; children: React.ReactNode; onClick?: () => void }) => (
    <div className={`flex items-start gap-3 rounded-xl border border-slate-200 p-3 ${onClick ? "cursor-pointer hover:bg-slate-50" : ""}`} onClick={onClick}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Ico d={icon} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold">{title}</div>
        <div className="text-slate-700">{children}</div>
      </div>
      {onClick && <span className="self-center text-slate-400">›</span>}
    </div>
  );
  return (
    <section className="card flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Ico d={I.bulb} className="h-5 w-5 text-brand-600" />
        Insight &amp; Tindak Lanjut
      </h2>
      {worst && worst.diff! < 0 && (
        <Item icon={I.warn} color="bg-red-50 text-red-600" title="Gap Terbesar">
          {ymLabel(worst.bulan, true)} : <b className="text-red-700">{n0(worst.diff)} pcs</b> ({pc(worst.pct)})
          {best && best.diff! > 0 && (
            <div className="text-xs text-slate-500">
              Terbaik {ymLabel(best.bulan)}: +{n0(best.diff)} pcs ({pc(best.pct)})
            </div>
          )}
        </Item>
      )}
      {multi ? (
        <Item icon={I.users} color="bg-sky-50 text-sky-700" title="Customer Perlu Konfirmasi">
          {weakCust.length ? weakCust.slice(0, 3).map((c, i) => <span key={c.customer}>{i ? " dan " : ""}{c.customer} (Ach. {pct(c.ach)})</span>) : "Semua customer ≥95% dari forecast."}
        </Item>
      ) : (
        <Item icon={I.users} color="bg-sky-50 text-sky-700" title={`Part Perlu Konfirmasi (${ymLabel(r.selected!)})`}>
          {weakParts.length ? (
            <ul className="mt-0.5 flex flex-col gap-0.5">
              {weakParts.map((p) => (
                <li key={p.part}>
                  <button className="text-left hover:underline" onClick={() => onPart(p.part)}>
                    {p.part}: <b className="text-red-700">{big(p.diff)}</b> ({pc(p.pct, 0)})
                  </button>
                </li>
              ))}
            </ul>
          ) : r.parts.some((p) => p.forecast !== null) ? (
            "Tidak ada part yang turun >10% dari forecast."
          ) : (
            "Forecast per part untuk bulan ini tidak tercatat (file lama hanya punya total)."
          )}
        </Item>
      )}
      <Item icon={I.check} color="bg-emerald-50 text-emerald-700" title="Tindak Lanjut">
        <ul className="mt-0.5 list-disc pl-4">
          {ahead.length > 0 && (
            <li>
              Follow up revisi PO {ymLabel(ahead[0].bulan)}–{ymLabel(ahead[ahead.length - 1].bulan)} ke customer
              {r.sel?.actual && avgAhead ? <> (forecast rata-rata {big(avgAhead)}/bln, <span className={tone(avgAhead / r.sel.actual - 1)}>{pc(avgAhead / r.sel.actual - 1)}</span> vs PO {ymLabel(r.sel.bulan)}).</> : "."}
            </li>
          )}
          {avgAhead && bias != null && r.stats.n >= 3 && (
            <li>
              Review kapasitas pakai angka realistis ±{big(avgAhead * (1 + bias))}/bln: {r.stats.n} bulan terakhir PO rata-rata <span className={tone(bias)}>{pc(bias)}</span> dari forecast.
            </li>
          )}
          {s.achievement != null && s.achievement < 0.95 && <li>Achievement FY {pct(s.achievement)}: jangan langsung jadikan forecast dasar lembur.</li>}
          {!ahead.length && <li>Upload file forecast terbaru supaya bulan ke depan terlihat.</li>}
        </ul>
      </Item>
    </section>
  );
}

// ---------- 5. per part ----------
function Spark({ v }: { v: (number | null)[] }) {
  const data = v.map((y, i) => ({ i, y }));
  if (!v.some((x) => x)) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="h-7 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
          <Line dataKey="y" stroke={MAROON} strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type Filter = "all" | "naik" | "turun" | "sesuai" | "baru";
function PartsCard({ r }: { r: ForecastReport }) {
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"diff" | "actual" | "pct" | "part">("diff");
  const [all, setAll] = useState(false);
  const active = r.parts.filter((p) => (p.actual ?? 0) > 0 || (p.forecast ?? 0) > 0 || (p.next ?? 0) > 0);
  const count = (k: Filter) => active.filter((p) => match(p, k)).length;
  function match(p: PartPoint, k: Filter) {
    if (k === "all") return true;
    if (k === "baru") return (p.forecast ?? 0) === 0 && (p.actual ?? 0) > 0;
    return diffStatus(p.pct) === k;
  }
  const list = active
    .filter((p) => match(p, f) && (!q || p.part.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) =>
      sort === "part" ? a.part.localeCompare(b.part) : sort === "actual" ? (b.actual ?? 0) - (a.actual ?? 0) : sort === "pct" ? (a.pct ?? 0) - (b.pct ?? 0) : Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0),
    );
  const maxAbs = Math.max(1, ...active.map((p) => Math.abs(p.diff ?? 0)));
  const tabs: { k: Filter; label: string }[] = [
    { k: "all", label: "Semua" },
    { k: "turun", label: "Di bawah" },
    { k: "naik", label: "Di atas" },
    { k: "sesuai", label: "Sesuai" },
    { k: "baru", label: "Tanpa forecast" },
  ];
  const Th = ({ k, children, className = "" }: { k?: typeof sort; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 font-semibold ${className}`}>
      {k ? (
        <button className={`inline-flex items-center gap-1 ${sort === k ? "text-slate-900" : ""}`} onClick={() => setSort(k)}>
          {children}
          {sort === k && <span aria-hidden>↓</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="font-bold">Per part · {ymLabel(r.sel!.bulan, true)}</h2>
          <p className="text-xs text-slate-500">{active.length} part aktif. Grafik kecil = PO 12 bulan terakhir.</p>
        </div>
        <input className="input h-10 w-full py-1 sm:w-64" placeholder="Cari part…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pb-3 sm:px-5">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setF(t.k)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${f === t.k ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>
            {t.label} <span className={f === t.k ? "text-white/80" : "text-slate-400"}>{count(t.k)}</span>
          </button>
        ))}
      </div>
      {/* Laptop: tabel */}
      <div className="hidden max-h-[36rem] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
            <tr>
              <Th k="part" className="text-left">
                Part
              </Th>
              <Th className="text-right">Forecast</Th>
              <Th k="actual" className="text-right">
                PO aktual
              </Th>
              <Th k="diff" className="w-56 text-center">
                Selisih pcs
              </Th>
              <Th k="pct" className="text-right">
                %
              </Th>
              <Th className="text-right">Selisih box</Th>
              <Th className="text-right">vs bln lalu</Th>
              <Th className="text-right">{r.nextMonth ? ymLabel(r.nextMonth.bulan) : "Bln depan"}</Th>
              <Th className="text-center">12 bln</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.part} className="border-t border-slate-100 tabular-nums hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{p.part}</td>
                <td className="px-3 py-2 text-right text-slate-600">{n0(p.forecast)}</td>
                <td className="px-3 py-2 text-right font-semibold">{n0(p.actual)}</td>
                <td className="px-3 py-2">
                  <DivBar v={p.diff} max={maxAbs} />
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${tone(p.pct)}`}>{pc(p.pct, 0)}</td>
                <td className={`px-3 py-2 text-right ${tone(p.diff)}`}>{p.box && p.diff != null ? (p.diff / p.box).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "-"}</td>
                <td className={`px-3 py-2 text-right ${tone(p.mom)}`}>{pc(p.mom, 0)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{n0(p.next)}</td>
                <td className="px-3 py-1">
                  <div className="flex justify-center">
                    <Spark v={p.spark} />
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Tidak ada part.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* HP: kartu */}
      <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100 md:hidden">
        {(all ? list : list.slice(0, 10)).map((p) => (
          <li key={p.part} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{p.part}</span>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${tone(p.pct)}`}>{pc(p.pct, 0)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">Forecast</div>
                <div>{big(p.forecast)}</div>
              </div>
              <div>
                <div className="text-slate-500">PO</div>
                <div className="font-semibold">{big(p.actual)}</div>
              </div>
              <div>
                <div className="text-slate-500">Selisih</div>
                <div className={tone(p.diff)}>
                  {p.diff != null && p.diff > 0 ? "+" : ""}
                  {big(p.diff)}
                </div>
              </div>
            </div>
            <DivBar v={p.diff} max={maxAbs} />
          </li>
        ))}
        {!all && list.length > 10 && (
          <li className="px-4 py-3">
            <button className="btn-secondary w-full" onClick={() => setAll(true)}>
              Tampilkan semua {list.length} part
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Batang selisih dua arah: kiri merah (di bawah forecast), kanan hijau (di atas). */
function DivBar({ v, max }: { v: number | null; max: number }) {
  if (v == null) return <div className="text-center text-xs text-slate-300">—</div>;
  const w = (Math.abs(v) / max) * 50;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 flex-1 rounded-full bg-slate-100">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-300" />
        <div className="absolute inset-y-0 rounded-full" style={{ background: v >= 0 ? UP : DOWN, left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%` }} />
      </div>
      <span className={`w-16 text-right text-xs tabular-nums ${tone(v)}`}>
        {v > 0 ? "+" : ""}
        {big(v)}
      </span>
    </div>
  );
}

// ---------- 6. harian ----------
function DailyCard({ r }: { r: ForecastReport }) {
  const [view, setView] = useState<"chart" | "heat">("chart");
  const data = r.daily.map((d) => {
    const wd = new Date(d.tanggal + "T00:00:00Z").getUTCDay();
    return { ...d, label: String(Number(d.tanggal.slice(8))), off: wd === 0 || wd === 6 };
  });
  const total = r.daily.reduce((a, d) => a + d.qty, 0);
  const poDays = r.daily.filter((d) => d.qty > 0).length;
  const peak = r.daily.reduce((a, d) => (d.qty > a.qty ? d : a), r.daily[0]);
  const maxCell = Math.max(1, ...r.dailyParts.flatMap((p) => Object.values(p.days)));
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">PO harian · {ymLabel(r.sel!.bulan, true)}</h2>
          <p className="text-xs text-slate-500">
            {poDays} hari kirim · rata-rata {big(poDays ? total / poDays : 0)}/hari · tertinggi {big(peak?.qty)} ({Number(peak?.tanggal.slice(8))} {ymLabel(r.sel!.bulan).split(" ")[0]})
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {(["chart", "heat"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 font-medium ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {v === "chart" ? "Grafik" : "Per part"}
            </button>
          ))}
        </div>
      </div>
      {view === "chart" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">PO per hari</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={1} />
                  <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} labelFormatter={(l) => `Tanggal ${l}`} formatter={(v: unknown) => [`${n0(v as number)} pcs`, "PO"]} cursor={{ fill: "rgba(155,27,31,0.06)" }} />
                  <Bar dataKey="qty" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {data.map((d) => (
                      <Cell key={d.tanggal} fill={d.off ? "#cbd5e1" : MAROON} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Kumulatif PO vs laju forecast</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f3" vertical={false} />
                  <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={1} />
                  <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} labelFormatter={(l) => `s/d tanggal ${l}`} formatter={(v: unknown, n: unknown) => [`${n0(v as number)} pcs`, String(n)]} />
                  <Line dataKey="pace" name="Laju forecast" stroke={SLATE} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line dataKey="cum" name="PO kumulatif" stroke={MAROON} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500">Laju forecast = forecast bulan ini dibagi rata ke hari kirim.</p>
          </div>
        </div>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-100">
          <table className="text-xs tabular-nums">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 text-left">Part</th>
                <th className="px-2 py-1.5 text-right">Total</th>
                {data.map((d) => (
                  <th key={d.tanggal} className={`min-w-11 px-1 py-1.5 text-center ${d.off ? "text-slate-300" : ""}`}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.dailyParts.map((p) => (
                <tr key={p.part} className="border-t border-slate-100">
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 font-medium">{p.part}</td>
                  <td className="px-2 py-1 text-right font-semibold">{big(p.total)}</td>
                  {data.map((d) => {
                    const v = p.days[d.tanggal] ?? 0;
                    const a = v ? 0.12 + 0.78 * (v / maxCell) : 0;
                    return (
                      <td key={d.tanggal} className="px-0.5 py-0.5 text-center" title={v ? `${p.part} · ${d.label}: ${n0(v)} pcs` : undefined}>
                        {v ? (
                          <div className="rounded px-0.5 py-1" style={{ background: `rgba(155,27,31,${a})`, color: a > 0.5 ? "#fff" : "#4a0b0d" }}>
                            {axisBig(v)}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- versi tersimpan (admin) ----------
function VersionsCard({ r }: { r: ForecastReport }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function del(v: string, c: string) {
    if (!confirm(`Hapus data forecast versi ${ymLabel(v, true)} untuk ${c}? Data di Sheet dikosongkan.`)) return;
    setBusy(`${v}|${c}`);
    const res = await fetch(`/api/forecast?versi=${v}&customer=${encodeURIComponent(c)}`, { method: "DELETE" });
    setBusy("");
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Gagal menghapus.");
    router.refresh();
  }
  return (
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer font-bold">File forecast tersimpan ({r.versions.length})</summary>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {[...r.versions].reverse().map((v) => (
          <li key={`${v.versi}|${v.customer}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b>{v.customer} · versi {ymLabel(v.versi, true)}</b> <span className="text-slate-500">· {v.sumber} oleh {v.by} · {v.at.slice(0, 16)}</span>
            </span>
            <button className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50" disabled={!!busy} onClick={() => del(v.versi, v.customer)}>
              {busy === `${v.versi}|${v.customer}` ? "Menghapus…" : "Hapus"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Data ada di tab &quot;Forecast PO&quot; dan &quot;Forecast Harian&quot; di Google Sheet. <Link href="/forecast" className="underline">Muat ulang</Link>
      </p>
    </details>
  );
}
