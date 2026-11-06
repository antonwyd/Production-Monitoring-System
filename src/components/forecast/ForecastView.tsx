"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ALL, ALL_PARTS, dayLabel, diffStatus, isOff, ymLabel, type DayPoint, type ForecastReport, type PartRow } from "@/lib/forecast";
import DownloadMenu from "@/components/report/DownloadMenu";
import ForecastUpload from "./ForecastUpload";
import { ForecastInput, PoInput } from "./ForecastInput";

// Forecast harian vs Actual PO harian (per tanggal kirim), satu bulan:
// filter bulan / customer / part · 5 KPI s/d batas · grafik harian & kumulatif · gauge · per customer ·
// rekap harian · insight · per part · matriks per part per hari · tren bulanan.

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
const pts = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")} poin`;
const axisBig = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}rb` : String(v));
const tone = (v: number | null | undefined) => (v == null ? "text-slate-500" : v > 0.0005 ? "text-emerald-700" : v < -0.0005 ? "text-red-700" : "text-slate-600");
/** Achievement: >=95% hijau, 85-95% kuning, <85% merah. */
const achTone = (v: number | null | undefined) => (v == null ? "text-slate-500" : v >= 0.95 ? "text-emerald-700" : v >= 0.85 ? "text-amber-600" : "text-red-700");
const achColor = (v: number | null | undefined) => (v == null ? "#94a3b8" : v >= 0.95 ? "#16a34a" : v >= 0.85 ? "#d97706" : "#dc2626");
const addDay = (t: string, n: number) => {
  const d = new Date(`${t}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

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
  plus: "M12 5v14M5 12h14",
  up: "M12 16V4M7 9l5-5 5 5M5 20h14",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
};

export default function ForecastView({ r, canEdit, isAdmin, customers }: { r: ForecastReport; canEdit: boolean; isAdmin: boolean; customers: string[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<"" | "upload" | "fcInput" | "po">("");
  const [fcMenu, setFcMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fcMenu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setFcMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [fcMenu]);
  const go = (q: { c?: string; m?: string; p?: string }) => {
    const p = new URLSearchParams();
    const m = q.m ?? r.month;
    if (m) p.set("m", m);
    p.set("c", q.c ?? r.customer);
    const part = q.p ?? r.part;
    if (part !== ALL_PARTS) p.set("p", part);
    router.push(`/forecast?${p}`, { scroll: false });
  };
  const allCustomers = [...new Set([...customers, ...r.customers])].sort();
  const custQ = encodeURIComponent(r.customer);
  const defCust = r.customer === ALL ? "" : r.customer;
  const tomorrow = addDay(r.today, 1);
  // Default tanggal kirim: hari berikutnya yang ada forecast (PO Jumat biasanya untuk Senin), maks 7 hari.
  const nextFc = r.days.find((d) => d.tanggal >= tomorrow && d.tanggal <= addDay(r.today, 7) && d.fc > 0)?.tanggal ?? tomorrow;
  const saved = (c: string, m: string) => {
    setModal("");
    go({ c, m: m.slice(0, 7), p: ALL_PARTS });
    router.refresh();
  };

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

  const editButtons = canEdit && (
    <>
      <div ref={menuRef} className="relative flex-1 sm:flex-none">
        <button className="btn-secondary h-12 w-full whitespace-nowrap rounded-xl px-3" onClick={() => setFcMenu((v) => !v)} aria-expanded={fcMenu} aria-haspopup="menu">
          <Ico d={I.grid} />
          Forecast ▾
        </button>
        {fcMenu && (
          <div role="menu" className="anim-fade absolute left-0 top-14 z-30 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl sm:left-auto sm:right-0">
            {[
              { k: "upload" as const, label: "Upload file forecast harian", hint: "Template atau sheet harian dari customer (.xlsx)" },
              { k: "fcInput" as const, label: "Input forecast sekaligus", hint: "Isi / tempel tabel Part × tanggal 1–31 dari Excel" },
            ].map((x) => (
              <button key={x.k} role="menuitem" className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50" onClick={() => (setFcMenu(false), setModal(x.k))}>
                <span className="text-sm font-semibold">{x.label}</span>
                <span className="text-xs text-slate-500">{x.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn-primary h-12 flex-1 rounded-xl px-4 sm:flex-none" onClick={() => setModal("po")}>
        <Ico d={I.plus} />
        Input PO
      </button>
    </>
  );

  const header = (
    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Ico d={I.chart} className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold sm:whitespace-nowrap sm:text-3xl">Forecast vs Actual PO</h1>
          <p className="text-sm text-slate-500">Forecast harian customer vs PO per tanggal kirim</p>
        </div>
      </div>
      <div className="no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {r.months.length > 0 && (
          <Filter label="Bulan" icon={I.cal}>
            <select className={selCls} value={r.month ?? ""} onChange={(e) => go({ m: e.target.value })} aria-label="Bulan">
              {r.months.map((m) => (
                <option key={m} value={m}>
                  {ymLabel(m, true)}
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
            <select className={selCls} value={r.part} onChange={(e) => go({ p: e.target.value })} aria-label="Part">
              <option value={ALL_PARTS}>{ALL_PARTS}</option>
              {r.partsList.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {chevron}
          </Filter>
        )}
        <div className="col-span-2 flex flex-wrap items-center gap-2">
          {editButtons}
          <DownloadMenu
            compact
            className="[&>button]:h-12 [&>button]:rounded-xl"
            links={[
              ...(r.month ? [{ label: "Excel laporan (.xlsx)", hint: "Ringkasan, per hari, per part, per part per hari, tren bulanan", href: `/api/forecast/forecast-vs-po.xlsx?c=${custQ}&m=${r.month}${r.part !== ALL_PARTS ? `&p=${encodeURIComponent(r.part)}` : ""}` }] : []),
              { label: "Template forecast harian (.xlsx)", hint: "Part × tanggal 1–31, untuk diisi lalu di-upload", href: `/api/forecast/template.xlsx?c=${custQ}&versi=${r.month && r.month > r.today.slice(0, 7) ? r.month : tomorrow.slice(0, 7)}` },
            ]}
          />
        </div>
      </div>
    </div>
  );

  const modals = (
    <>
      {modal === "upload" && <ForecastUpload customers={allCustomers} defaultCustomer={defCust} versions={r.versions.map((v) => `${v.versi}|${v.customer}`)} onClose={() => setModal("")} onSaved={saved} />}
      {modal === "fcInput" && <ForecastInput customers={allCustomers} defaultCustomer={defCust} defaultMonth={r.month ?? r.today.slice(0, 7)} onClose={() => setModal("")} onSaved={saved} />}
      {modal === "po" && <PoInput customers={allCustomers} defaultCustomer={defCust} defaultDate={nextFc} onClose={() => setModal("")} onSaved={saved} />}
    </>
  );

  if (!r.month) {
    return (
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        {header}
        <section className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Ico d={I.chart} className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Belum ada forecast</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Awal bulan: masukkan forecast harian customer (upload template atau tempel dari Excel). Lalu setiap hari input PO yang turun ke tanggal kirimnya. Dashboard langsung membandingkan per hari.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => setModal("upload")}>
                <Ico d={I.up} /> Upload forecast harian
              </button>
              <button className="btn-secondary" onClick={() => setModal("fcInput")}>
                Input forecast sekaligus
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Minta leader atau admin memasukkan forecast.</p>
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
        <DailyChart r={r} />
        <GaugeCard r={r} />
        <CustomerCard r={r} onPick={(c) => go({ c, p: ALL_PARTS })} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <RekapCard r={r} />
        <InsightCard r={r} onPart={(p) => go({ p })} canEdit={canEdit} onPo={() => setModal("po")} />
      </div>
      <PartsCard r={r} onPart={(p) => go({ p })} />
      {r.heat.length > 0 && <HeatCard r={r} />}
      {r.monthly.length > 1 && <MonthlyCard r={r} onPick={(m) => go({ m })} />}
      <p className="text-xs text-slate-400">
        Achievement = PO ÷ forecast s/d batas (tanggal PO terakhir atau hari ini). Hijau ≥95%, kuning 85–95%, merah &lt;85%. PO dicatat per tanggal kirim.
      </p>
      {isAdmin && <DataCard r={r} />}
      {modals}
    </main>
  );
}

// ---------- 1. KPI ----------
function Kpis({ r }: { r: ForecastReport }) {
  const k = r.kpi;
  const upto = r.upto ? dayLabel(r.upto) : "-";
  const card = "card relative flex flex-col items-start gap-2 overflow-hidden p-3 sm:flex-row sm:gap-3 sm:p-4 lg:px-3.5";
  const big1 = "whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem]";
  const tile = (bg: string, fg: string, d: string) => (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${fg}`}>
      <Ico d={d} />
    </span>
  );
  const prevGrowth = k.poPrevMonth ? k.poUpto / k.poPrevMonth - 1 : null;
  const d7 = k.ach7 != null && k.ach7prev != null ? k.ach7 - k.ach7prev : null;
  const noFc = k.fcMonth === 0;
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className={`${card} bg-gradient-to-br from-sky-50 to-white`}>
          {tile("bg-sky-100", "text-sky-700", I.target)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">
              Forecast s/d {upto} <span className="font-normal text-slate-500">(pcs)</span>
            </div>
            <div className={big1}>{n0(k.fcUpto)}</div>
            <div className="text-xs text-slate-500">
              Sebulan <b className="text-slate-700">{n0(k.fcMonth)}</b>
            </div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-rose-50 to-white`}>
          {tile("bg-rose-100", "text-rose-700", I.box)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">
              Actual PO s/d {upto} <span className="font-normal text-slate-500">(pcs)</span>
            </div>
            <div className={big1}>{n0(k.poUpto)}</div>
            <div className="text-xs">
              {prevGrowth != null ? (
                <span className={`font-semibold ${tone(prevGrowth)}`}>
                  {prevGrowth >= 0 ? "▲" : "▼"} {pc(prevGrowth)} <span className="font-normal text-slate-500">vs bln lalu</span>
                </span>
              ) : (
                <span className="text-slate-500">{k.poDays} hari ada PO</span>
              )}
            </div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-emerald-50 to-white`}>
          {tile("bg-emerald-100", "text-emerald-700", I.award)}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-700">Achievement</div>
            <div className={`text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem] ${achTone(k.ach)}`}>{pct(k.ach)}</div>
            <div className="text-xs text-slate-500">PO ÷ forecast s/d {upto}</div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
              <div className="anim-bar h-full rounded-full" style={{ width: `${Math.min(100, (k.ach ?? 0) * 100)}%`, background: achColor(k.ach) }} />
            </div>
          </div>
        </div>
        <div className={`${card} bg-gradient-to-br from-indigo-50 to-white`}>
          {tile("bg-indigo-100", "text-indigo-700", I.scale)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">
              Gap <span className="font-normal text-slate-500">(pcs)</span>
            </div>
            <div className={`${big1} ${tone(k.gap)}`}>
              {k.gap > 0 ? "+" : ""}
              {n0(k.gap)}
            </div>
            <div className="text-xs">
              <span className={`font-semibold ${tone(k.gapPct)}`}>{pc(k.gapPct)}</span> <span className="text-slate-500">dari forecast</span>
            </div>
          </div>
        </div>
        <div className={`${card.replace("flex-col items-start", "flex-row items-start")} col-span-2 bg-gradient-to-br from-violet-50 to-white lg:col-span-1`}>
          {tile("bg-violet-100", "text-violet-700", I.trend)}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">Tren 7 Hari</div>
            <div className={`text-lg font-bold tabular-nums sm:text-xl xl:text-[1.45rem] ${achTone(k.ach7)}`}>
              {pct(k.ach7)}
              {d7 != null && <span className={`ml-1.5 text-sm ${tone(d7)}`}>{d7 >= 0 ? "▲" : "▼"}</span>}
            </div>
            <div className="text-xs text-slate-500">{d7 != null ? <>{pts(d7)} vs 7 hari sebelumnya ({pct(k.ach7prev)})</> : "Achievement 7 hari terakhir"}</div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {ymLabel(r.month!, true)} · dibandingkan s/d <b>{r.upto ? dayLabel(r.upto, true) : "-"}</b>
        {k.lastDay ? <> · PO terakhir tanggal kirim {dayLabel(k.lastDay.tanggal)}</> : " · belum ada PO"}
        {noFc && <> · Forecast bulan ini belum dimasukkan</>}
      </p>
    </section>
  );
}

// ---------- 2. grafik harian ----------
function DailyChart({ r }: { r: ForecastReport }) {
  const [view, setView] = useState<"day" | "cum" | "table">("day");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(window.innerWidth < 640), []);
  const data = useMemo(() => r.days.map((d) => ({ ...d, label: String(Number(d.tanggal.slice(8))), poShow: d.future ? null : d.po, poAhead: d.future ? d.po : null })), [r.days]);
  type D = (typeof data)[number];
  const tick = (d: DayPoint) => d.tanggal === r.upto;
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Ico d={I.chart} className="h-5 w-5 text-brand-600" />
          Forecast vs Actual PO per Hari
        </h2>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {(
            [
              ["day", "Harian"],
              ["cum", "Kumulatif"],
              ["table", "Tabel"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 font-medium ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {view !== "table" && (
        <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <i className={view === "day" ? "h-3 w-3 rounded-sm" : "h-0.5 w-4 border-t-2 border-dashed border-slate-500"} style={view === "day" ? { background: GREY } : undefined} /> Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <i className={view === "day" ? "h-3 w-3 rounded-sm" : "h-1 w-4 rounded"} style={{ background: view === "day" ? RED : MAROON }} /> Actual PO
          </span>
        </div>
      )}
      {view === "day" ? (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="label" tick={AX} interval={narrow ? 2 : 0} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TIP}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#cbd5e1" }}
                cursor={{ fill: "rgba(155,27,31,0.06)" }}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload as D | undefined;
                  if (!d) return "";
                  const a = d.po != null && d.fc ? ` · ${pct(d.po / d.fc)}` : "";
                  return `${dayLabel(d.tanggal, true)}${d.future ? " · belum ada PO" : a}`;
                }}
                formatter={(v: unknown, n: unknown) => [`${n0(v as number)} pcs`, String(n)]}
              />
              {r.upto && <ReferenceLine x={String(Number(r.upto.slice(8)))} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "batas", position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />}
              <Bar dataKey="fc" name="Forecast" fill={GREY} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.tanggal} fillOpacity={d.future ? 0.55 : 1} />
                ))}
              </Bar>
              <Bar dataKey="poShow" name="Actual PO" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.tanggal} fill={d.po != null && d.fc && d.po < d.fc * 0.9 ? RED : d.po != null && d.po > d.fc * 1.1 ? UP : RED} stroke={tick(d) ? "#7f1519" : undefined} strokeWidth={tick(d) ? 2 : 0} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : view === "cum" ? (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="label" tick={AX} interval={narrow ? 2 : 0} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TIP}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#cbd5e1" }}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload as D | undefined;
                  return d ? `s/d ${dayLabel(d.tanggal, true)}${d.ach != null ? ` · ${pct(d.ach)}` : ""}` : "";
                }}
                formatter={(v: unknown, n: unknown) => [`${n0(v as number)} pcs`, String(n)]}
              />
              <Line dataKey="cumFc" name="Forecast kumulatif" stroke={SLATE} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="cumPo" name="PO kumulatif" stroke={MAROON} strokeWidth={2.6} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[22rem] overflow-auto">
          <DayTable r={r} rows={[...r.days].reverse()} compact />
        </div>
      )}
      <p className="text-xs text-slate-500">
        {view === "cum" ? "Garis merah di bawah garis putus-putus = PO tertinggal dari forecast." : "Batang PO hijau = di atas forecast >10%. Garis \"batas\" = tanggal pembanding terakhir."}
      </p>
    </section>
  );
}

function DayTable({ r, rows, compact, foot }: { r: ForecastReport; rows: DayPoint[]; compact?: boolean; foot?: React.ReactNode }) {
  const TH = "px-3 py-2 text-xs font-semibold";
  const TD = compact ? "px-3 py-1.5 tabular-nums" : "px-3 py-2 tabular-nums";
  return (
    <table className="w-full min-w-[30rem] text-sm">
      <thead className="sticky top-0 bg-slate-50 text-slate-600">
        <tr>
          <th className={`${TH} text-left`}>Tanggal</th>
          <th className={`${TH} text-right`}>Forecast</th>
          <th className={`${TH} text-right`}>Actual PO</th>
          <th className={`${TH} text-right`}>Gap</th>
          <th className={`${TH} text-right`}>Ach. kumulatif</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const gap = d.po != null && !d.future ? d.po - d.fc : null;
          return (
            <tr key={d.tanggal} className={`border-t border-slate-100 ${d.future ? "text-slate-400" : ""} ${d.tanggal === r.upto ? "bg-rose-50 font-semibold" : isOff(d.tanggal) ? "bg-slate-50/60" : ""}`}>
              <td className={`${TD} whitespace-nowrap font-medium`}>{dayLabel(d.tanggal, true)}</td>
              <td className={`${TD} text-right`}>{d.fc ? n0(d.fc) : "–"}</td>
              <td className={`${TD} text-right`}>{d.po == null ? "–" : n0(d.po)}</td>
              <td className={`${TD} text-right ${tone(gap)}`}>{gap == null ? "–" : `${gap > 0 ? "+" : ""}${n0(gap)}`}</td>
              <td className={`${TD} text-right font-semibold ${achTone(d.ach)}`}>{pct(d.ach)}</td>
            </tr>
          );
        })}
      </tbody>
      {foot}
    </table>
  );
}

// ---------- 3. gauge ----------
function Gauge({ v }: { v: number | null }) {
  // Setengah lingkaran 0–120%; penanda di 100% = forecast.
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
  const k = r.kpi;
  const ahead = r.days.filter((d) => d.future && (d.po ?? 0) > 0).reduce((a, d) => a + (d.po ?? 0), 0);
  const row = (icon: string, label: string, v: React.ReactNode, cls = "") => (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 py-2 text-sm first:border-t-0">
      <span className="flex items-center gap-2 text-slate-600">
        <Ico d={icon} className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <span className={`whitespace-nowrap font-semibold tabular-nums ${cls}`}>{v}</span>
    </div>
  );
  return (
    <section className="card flex flex-col p-4 sm:p-5">
      <h2 className="text-center font-bold">Achievement s/d {r.upto ? dayLabel(r.upto) : "-"}</h2>
      <div className="flex flex-1 items-center py-2">
        <Gauge v={k.ach} />
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-1">
        {row(I.target, "Forecast", `${n0(k.fcUpto)} pcs`)}
        {row(I.box, "Actual PO", `${n0(k.poUpto)} pcs`)}
        {row(I.warn, "Gap", `${k.gap > 0 ? "+" : ""}${n0(k.gap)} pcs`, tone(k.gap))}
        {row(I.cal, "Sisa forecast bulan ini", `${n0(k.fcRest)} pcs`, "text-slate-700")}
        {ahead > 0 && row(I.check, "PO sudah masuk sesudahnya", `${n0(ahead)} pcs`, "text-slate-700")}
      </div>
    </section>
  );
}

// ---------- 4. per customer ----------
function CustomerCard({ r, onPick }: { r: ForecastReport; onPick: (c: string) => void }) {
  const max = Math.max(1, ...r.perCustomer.map((c) => Math.max(c.poUpto, c.fcUpto)));
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Ico d={I.users} className="h-5 w-5 text-brand-600" />
        Per Customer
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-2 py-1.5 text-left font-semibold">Customer</th>
            <th className="px-2 py-1.5 text-right font-semibold">PO (pcs)</th>
            <th className="rounded-r-lg px-2 py-1.5 text-right font-semibold">Ach.</th>
          </tr>
        </thead>
        <tbody>
          {r.perCustomer.map((c) => (
            <tr key={c.customer} className={`cursor-pointer hover:bg-slate-50 ${r.customer === c.customer ? "bg-brand-50" : ""}`} onClick={() => onPick(c.customer)} title="Lihat customer ini saja">
              <td className="px-2 py-2">
                <div className="truncate font-medium">{c.customer}</div>
                <div className="relative mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.fcUpto / max) * 100}%`, background: GREY }} />
                  <div className="anim-bar absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.poUpto / max) * 100}%`, background: RED }} />
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{n0(c.poUpto)}</td>
              <td className={`px-2 py-2 text-right font-semibold tabular-nums ${achTone(c.ach)}`}>{pct(c.ach)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">{r.perCustomer.length === 1 ? "Customer lain muncul setelah forecast / PO-nya dimasukkan." : "Batang abu-abu = forecast, merah = PO (s/d batas)."}</p>
    </section>
  );
}

// ---------- 5. rekap harian ----------
function RekapCard({ r }: { r: ForecastReport }) {
  const [all, setAll] = useState(false);
  const rows = r.days.filter((d) => all || !d.future);
  const k = r.kpi;
  const TD = "px-3 py-2 tabular-nums";
  return (
    <section className="card overflow-hidden p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Ico d={I.cal} className="h-5 w-5 text-brand-600" />
          Rekap Harian {ymLabel(r.month!)}
        </h2>
        {r.days.some((d) => d.future) && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-brand-600" /> Tampilkan sampai akhir bulan
          </label>
        )}
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <DayTable
          r={r}
          rows={rows}
          foot={
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-800 font-bold text-white">
                <td className={`${TD} whitespace-nowrap rounded-l-lg`}>Total s/d {r.upto ? dayLabel(r.upto) : "-"}</td>
                <td className={`${TD} text-right`}>{n0(k.fcUpto)}</td>
                <td className={`${TD} text-right`}>{n0(k.poUpto)}</td>
                <td className={`${TD} text-right`}>
                  {k.gap > 0 ? "+" : ""}
                  {n0(k.gap)}
                </td>
                <td className={`${TD} rounded-r-lg text-right`}>{pct(k.ach)}</td>
              </tr>
            </tfoot>
          }
        />
      </div>
    </section>
  );
}

// ---------- 6. insight & tindak lanjut ----------
function InsightCard({ r, onPart, canEdit, onPo }: { r: ForecastReport; onPart: (p: string) => void; canEdit: boolean; onPo: () => void }) {
  const k = r.kpi;
  const done = r.days.filter((d) => !d.future && d.fc > 0);
  const worst = [...done].filter((d) => d.po != null).sort((a, b) => (a.po! - a.fc) - (b.po! - b.fc))[0];
  const weak = r.parts.filter((p) => p.pct != null && p.pct < -0.1 && p.fcUpto > 0).sort((a, b) => a.diff - b.diff).slice(0, 3);
  const strong = r.parts.filter((p) => p.pct != null && p.pct > 0.1 && p.fcUpto > 0).sort((a, b) => b.diff - a.diff).slice(0, 2);
  // Tanggal kirim berikutnya yang ada forecast (maks 7 hari ke depan).
  const nxt = r.days.find((d) => d.tanggal > r.today && d.tanggal <= addDay(r.today, 7) && d.fc > 0);
  const tomorrow = nxt?.tanggal ?? addDay(r.today, 1);
  const hasTomorrow = (nxt?.po ?? 0) > 0;
  const tomorrowFc = nxt?.fc ?? 0;
  // Proyeksi akhir bulan bila laju achievement s/d batas berlanjut.
  const proj = k.ach != null && k.fcMonth ? k.poUpto + k.fcRest * k.ach : null;
  const Item = ({ icon, color, title, children }: { icon: string; color: string; title: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Ico d={icon} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold">{title}</div>
        <div className="text-slate-700">{children}</div>
      </div>
    </div>
  );
  return (
    <section className="card flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Ico d={I.bulb} className="h-5 w-5 text-brand-600" />
        Insight &amp; Tindak Lanjut
      </h2>
      {worst && worst.po! - worst.fc < 0 && (
        <Item icon={I.warn} color="bg-red-50 text-red-600" title="Hari dengan Gap Terbesar">
          {dayLabel(worst.tanggal, true)}: <b className="text-red-700">{n0(worst.po! - worst.fc)} pcs</b> (PO {n0(worst.po)} vs forecast {n0(worst.fc)})
        </Item>
      )}
      <Item icon={I.users} color="bg-sky-50 text-sky-700" title="Part Perlu Konfirmasi">
        {weak.length ? (
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {weak.map((p) => (
              <li key={p.part}>
                <button className="text-left hover:underline" onClick={() => onPart(p.part)}>
                  {p.part}: <b className="text-red-700">{big(p.diff)}</b> ({pc(p.pct, 0)})
                </button>
              </li>
            ))}
          </ul>
        ) : r.parts.some((p) => p.fcUpto > 0) ? (
          "Tidak ada part yang PO-nya turun >10% dari forecast."
        ) : (
          "Belum ada forecast s/d batas."
        )}
        {strong.length > 0 && <div className="mt-1 text-xs text-slate-500">Naik: {strong.map((p) => `${p.part} (${pc(p.pct, 0)})`).join(", ")}</div>}
      </Item>
      <Item icon={I.check} color="bg-emerald-50 text-emerald-700" title="Tindak Lanjut">
        <ul className="mt-0.5 list-disc pl-4">
          {!hasTomorrow && tomorrowFc > 0 && (
            <li>
              PO kirim {dayLabel(tomorrow)} belum diinput{tomorrowFc ? ` (forecast ${big(tomorrowFc)})` : ""}.{" "}
              {canEdit && (
                <button className="font-semibold text-brand-600 hover:underline" onClick={onPo}>
                  Input sekarang
                </button>
              )}
            </li>
          )}
          {proj != null && (
            <li>
              Bila laju sama, PO sebulan ±<b>{big(proj)}</b> vs forecast {big(k.fcMonth)} (<span className={tone(proj / k.fcMonth - 1)}>{pc(proj / k.fcMonth - 1)}</span>).
            </li>
          )}
          {k.ach != null && k.ach < 0.95 && <li>Achievement {pct(k.ach)}: sesuaikan rencana produksi dan lembur dengan PO, bukan forecast.</li>}
          {k.ach != null && k.ach > 1.05 && <li>PO di atas forecast {pc(k.ach - 1)}: cek stok dan kapasitas untuk sisa bulan.</li>}
          {k.fcMonth === 0 && <li>Masukkan forecast harian bulan ini supaya PO bisa dibandingkan.</li>}
        </ul>
      </Item>
    </section>
  );
}

// ---------- 7. per part ----------
function Spark({ v }: { v: (number | null)[] }) {
  const data = v.map((y, i) => ({ i, y }));
  if (!v.some((x) => x)) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="h-7 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
          <Line dataKey="y" stroke={MAROON} strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type Filter = "all" | "naik" | "turun" | "sesuai" | "baru";
function PartsCard({ r, onPart }: { r: ForecastReport; onPart: (p: string) => void }) {
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"diff" | "po" | "pct" | "part">("diff");
  const [all, setAll] = useState(false);
  const active = r.parts.filter((p) => p.poUpto > 0 || p.fcMonth > 0);
  const match = (p: PartRow, k: Filter) => (k === "all" ? true : k === "baru" ? p.fcUpto === 0 && p.poUpto > 0 : diffStatus(p.pct) === k);
  const count = (k: Filter) => active.filter((p) => match(p, k)).length;
  const list = active
    .filter((p) => match(p, f) && (!q || p.part.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (sort === "part" ? a.part.localeCompare(b.part) : sort === "po" ? b.poUpto - a.poUpto : sort === "pct" ? (a.pct ?? 0) - (b.pct ?? 0) : Math.abs(b.diff) - Math.abs(a.diff)));
  const maxAbs = Math.max(1, ...active.map((p) => Math.abs(p.diff)));
  const upto = r.upto ? dayLabel(r.upto) : "-";
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
          <h2 className="font-bold">Per part · s/d {upto}</h2>
          <p className="text-xs text-slate-500">{active.length} part. Grafik kecil = PO harian bulan ini. Klik nama part untuk filter.</p>
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
      <div className="hidden max-h-[36rem] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
            <tr>
              <Th k="part" className="text-left">
                Part
              </Th>
              <Th className="text-right">Forecast</Th>
              <Th k="po" className="text-right">
                Actual PO
              </Th>
              <Th k="diff" className="w-56 text-center">
                Gap pcs
              </Th>
              <Th k="pct" className="text-right">
                %
              </Th>
              <Th className="text-right">Gap box</Th>
              <Th className="text-right">PO {upto}</Th>
              <Th className="text-right">Fc sebulan</Th>
              <Th className="text-center">Harian</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.part} className="border-t border-slate-100 tabular-nums hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <button className="text-left hover:underline" onClick={() => onPart(p.part)}>
                    {p.part}
                  </button>
                </td>
                <td className="px-3 py-2 text-right text-slate-600">{n0(p.fcUpto)}</td>
                <td className="px-3 py-2 text-right font-semibold">{n0(p.poUpto)}</td>
                <td className="px-3 py-2">
                  <DivBar v={p.diff} max={maxAbs} />
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${tone(p.pct)}`}>{pc(p.pct, 0)}</td>
                <td className={`px-3 py-2 text-right ${tone(p.diff)}`}>{p.box ? (p.diff / p.box).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "-"}</td>
                <td className="px-3 py-2 text-right">
                  <span className={p.lastPo < p.lastFc ? "text-red-700" : p.lastPo > p.lastFc ? "text-emerald-700" : ""}>{n0(p.lastPo)}</span>
                  {p.lastFc > 0 && <span className="text-xs text-slate-400"> / {big(p.lastFc)}</span>}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">{n0(p.fcMonth)}</td>
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
      <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100 md:hidden">
        {(all ? list : list.slice(0, 10)).map((p) => (
          <li key={p.part} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <button className="text-left font-semibold" onClick={() => onPart(p.part)}>
                {p.part}
              </button>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${tone(p.pct)}`}>{pc(p.pct, 0)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">Forecast</div>
                <div>{big(p.fcUpto)}</div>
              </div>
              <div>
                <div className="text-slate-500">PO</div>
                <div className="font-semibold">{big(p.poUpto)}</div>
              </div>
              <div>
                <div className="text-slate-500">Gap</div>
                <div className={tone(p.diff)}>
                  {p.diff > 0 ? "+" : ""}
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

// ---------- 8. per part per hari ----------
function HeatCard({ r }: { r: ForecastReport }) {
  const [mode, setMode] = useState<"po" | "fc">("po");
  const [all, setAll] = useState(false);
  const rows = all ? r.heat : r.heat.slice(0, 15);
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Per part per hari · {ymLabel(r.month!, true)}</h2>
          <p className="text-xs text-slate-500">{mode === "po" ? "Angka = PO. Hijau = ≥ forecast hari itu, merah = di bawah forecast, abu-abu = belum ada PO." : "Angka = forecast harian dari customer."}</p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {(
            [
              ["po", "PO vs forecast"],
              ["fc", "Forecast"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} className={`rounded-md px-3 py-1 font-medium ${mode === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-100">
        <table className="text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 text-left">Part</th>
              <th className="px-2 py-1.5 text-right">Total</th>
              {r.days.map((d) => (
                <th key={d.tanggal} className={`min-w-11 px-1 py-1.5 text-center ${isOff(d.tanggal) ? "text-slate-300" : ""} ${d.tanggal === r.upto ? "text-brand-600" : ""}`}>
                  {Number(d.tanggal.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.part} className="border-t border-slate-100">
                <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 font-medium">{p.part}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right font-semibold">{big(mode === "po" ? p.poTotal : p.fcTotal)}</td>
                {r.days.map((d) => {
                  const f = p.fc[d.tanggal] ?? 0;
                  const q = p.po[d.tanggal] ?? 0;
                  const title = `${p.part} · ${dayLabel(d.tanggal)}: forecast ${n0(f)}, PO ${d.future && !q ? "-" : n0(q)}`;
                  if (mode === "fc")
                    return (
                      <td key={d.tanggal} className="px-0.5 py-0.5 text-center text-slate-600" title={title}>
                        {f ? axisBig(f) : ""}
                      </td>
                    );
                  const pending = d.future && !q;
                  const cls = pending ? (f ? "text-slate-300" : "") : !f && !q ? "" : q >= f ? "bg-emerald-50 text-emerald-800" : q === 0 ? "bg-red-100 text-red-800" : "bg-red-50 text-red-700";
                  return (
                    <td key={d.tanggal} className="px-0.5 py-0.5 text-center" title={title}>
                      {(f || q) > 0 && <div className={`rounded px-0.5 py-1 ${cls}`}>{pending ? axisBig(f) : axisBig(q)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && r.heat.length > 15 && (
        <button className="btn-secondary mt-3 w-full sm:w-auto" onClick={() => setAll(true)}>
          Tampilkan semua {r.heat.length} part
        </button>
      )}
    </section>
  );
}

// ---------- 9. tren bulanan ----------
function MonthlyCard({ r, onPick }: { r: ForecastReport; onPick: (m: string) => void }) {
  const data = r.monthly.map((m) => ({ ...m, label: ymLabel(m.bulan) }));
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-2 flex items-center gap-2 font-bold">
        <Ico d={I.trend} className="h-5 w-5 text-brand-600" />
        Tren Bulanan
      </h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v: unknown, n: unknown) => [`${n0(v as number)} pcs`, String(n)]} cursor={{ fill: "rgba(155,27,31,0.06)" }} />
              <Bar dataKey="fcUpto" name="Forecast" fill={GREY} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(d) => onPick((d as unknown as { bulan: string }).bulan)} className="cursor-pointer" />
              <Bar dataKey="poUpto" name="Actual PO" fill={RED} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(d) => onPick((d as unknown as { bulan: string }).bulan)} className="cursor-pointer" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <table className="w-full self-start text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Bulan</th>
              <th className="px-3 py-2 text-right">Forecast</th>
              <th className="px-3 py-2 text-right">PO</th>
              <th className="px-3 py-2 text-right">Ach.</th>
            </tr>
          </thead>
          <tbody>
            {[...r.monthly].reverse().map((m) => (
              <tr key={m.bulan} onClick={() => onPick(m.bulan)} className={`cursor-pointer border-t border-slate-100 tabular-nums hover:bg-slate-50 ${m.bulan === r.month ? "bg-brand-50" : ""}`}>
                <td className="px-3 py-1.5 font-medium">
                  {ymLabel(m.bulan)}
                  {m.partial && m.upto && <span className="ml-1 text-xs font-normal text-slate-400">s/d {Number(m.upto.slice(8))}</span>}
                </td>
                <td className="px-3 py-1.5 text-right">{n0(m.fcUpto)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{n0(m.poUpto)}</td>
                <td className={`px-3 py-1.5 text-right font-semibold ${achTone(m.ach)}`}>{pct(m.ach)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- data tersimpan (admin) ----------
function DataCard({ r }: { r: ForecastReport }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function del(v: string, c: string) {
    if (!confirm(`Hapus forecast ${ymLabel(v, true)} untuk ${c}? Data di Sheet dikosongkan (PO tidak ikut terhapus).`)) return;
    setBusy(`${v}|${c}`);
    const res = await fetch(`/api/forecast?versi=${v}&customer=${encodeURIComponent(c)}`, { method: "DELETE" });
    setBusy("");
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Gagal menghapus.");
    router.refresh();
  }
  return (
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer font-bold">
        Data tersimpan · {r.versions.length} forecast bulanan · {r.poDates.length} tanggal PO
      </summary>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-600">Forecast</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {[...r.versions].reverse().map((v) => (
              <li key={`${v.versi}|${v.customer}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>
                    {v.customer} · {ymLabel(v.versi, true)}
                  </b>{" "}
                  <span className="text-slate-500">
                    · {v.parts} part · {big(v.total)} pcs · {v.by} {v.at.slice(0, 16)}
                  </span>
                </span>
                <button className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50" disabled={!!busy} onClick={() => del(v.versi, v.customer)}>
                  {busy === `${v.versi}|${v.customer}` ? "Menghapus…" : "Hapus"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-600">PO terakhir diinput</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {r.poDates.slice(0, 12).map((p) => (
              <li key={`${p.tanggal}|${p.customer}`} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <b>{dayLabel(p.tanggal, true)}</b> <span className="text-slate-500">· {p.customer}</span>
                </span>
                <span className="tabular-nums text-slate-600">
                  {n0(p.total)} pcs · {p.by} {p.at.slice(11, 16)}
                </span>
              </li>
            ))}
            {!r.poDates.length && <li className="py-2 text-slate-400">Belum ada PO.</li>}
          </ul>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Data ada di tab &quot;Forecast Harian&quot; dan &quot;PO Harian&quot; di Google Sheet. <Link href="/forecast" className="underline">Muat ulang</Link>
      </p>
    </details>
  );
}
