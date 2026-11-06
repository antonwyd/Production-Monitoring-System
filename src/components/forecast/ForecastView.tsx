"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMonths, diffStatus, ymLabel, type ForecastReport, type MonthPoint, type PartPoint } from "@/lib/forecast";
import DownloadMenu from "@/components/report/DownloadMenu";
import ForecastUpload from "./ForecastUpload";
import ForecastManual from "./ForecastManual";

// Forecast vs PO aktual: 1) angka utama bulan terpilih, 2) tren bulanan + selisih %, 3) forecast ke depan,
// 4) per part (naik/turun terbesar), 5) PO harian.

const MAROON = "#9b1b1f";
const MAROON_SOFT = "#e8a5a7";
const SLATE = "#475569";
const UP = "#047857";
const DOWN = "#b91c1c";
const TIP = { borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12, padding: "8px 12px" };
const AX = { fontSize: 11, fill: "#64748b" };

const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));
const big = (v: number | null | undefined) =>
  v == null ? "-" : Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt` : Math.abs(v) >= 1e4 ? `${Math.round(v / 1e3).toLocaleString("id-ID")} rb` : n0(v);
const pc = (v: number | null | undefined, d = 1) => (v == null ? "-" : v > 9.99 ? ">+999%" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(d).replace(".", ",")}%`);
const axisBig = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}rb` : String(v));
const tone = (v: number | null | undefined) => (v == null ? "text-slate-500" : v > 0.0005 ? "text-emerald-700" : v < -0.0005 ? "text-red-700" : "text-slate-600");

const ST = {
  naik: { label: "Di atas forecast", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: "▲" },
  turun: { label: "Di bawah forecast", chip: "bg-red-50 text-red-700 ring-red-200", icon: "▼" },
  sesuai: { label: "Sesuai (±10%)", chip: "bg-slate-100 text-slate-700 ring-slate-200", icon: "●" },
  none: { label: "Belum ada forecast", chip: "bg-slate-100 text-slate-500 ring-slate-200", icon: "–" },
} as const;

function Chip({ pct }: { pct: number | null }) {
  const s = ST[diffStatus(pct)];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${s.chip}`}>
      <span aria-hidden className="text-[9px]">{s.icon}</span>
      {s.label}
    </span>
  );
}

function Delta({ v, suffix }: { v: number | null; suffix?: string }) {
  return (
    <span className={`font-semibold tabular-nums ${tone(v)}`}>
      {v == null ? "-" : `${v > 0 ? "▲" : v < 0 ? "▼" : ""} ${pc(v)}`}
      {suffix && v != null && <span className="font-normal text-slate-500"> {suffix}</span>}
    </span>
  );
}

export default function ForecastView({ r, canEdit, isAdmin, customers }: { r: ForecastReport; canEdit: boolean; isAdmin: boolean; customers: string[] }) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [manual, setManual] = useState(false);
  const go = (q: { c?: string; m?: string }) => {
    const p = new URLSearchParams();
    p.set("c", q.c ?? r.customer);
    if (q.m) p.set("m", q.m);
    router.push(`/forecast?${p}`, { scroll: false });
  };
  const sel = r.sel;
  const actMonths = r.months.filter((m) => m.actual !== null).map((m) => m.bulan);
  const i = sel ? actMonths.indexOf(sel.bulan) : -1;
  const prev = i > 0 ? actMonths[i - 1] : null;
  const next = i >= 0 && i < actMonths.length - 1 ? actMonths[i + 1] : null;
  const allCustomers = [...new Set([...r.customers, ...customers])].sort();

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Forecast vs PO</h1>
        <p className="text-sm text-slate-500">Seberapa jauh PO customer yang masuk dibanding forecast yang mereka berikan, dan trennya per bulan.</p>
        {r.versions.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            File terakhir: versi {ymLabel(r.versions[r.versions.length - 1].versi, true)} · {r.versions[r.versions.length - 1].sumber} oleh {r.versions[r.versions.length - 1].by}, {r.versions[r.versions.length - 1].at.slice(0, 16)}
          </p>
        )}
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        {r.customers.length > 1 && (
          <select className="input h-10 w-auto py-1" value={r.customer} onChange={(e) => go({ c: e.target.value })} aria-label="Customer">
            {r.customers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        {sel && (
          <div className="flex items-center gap-1">
            <button className="btn-secondary h-10 px-3" disabled={!prev} onClick={() => prev && go({ m: prev })} aria-label="Bulan sebelumnya">
              ‹
            </button>
            <select className="input h-10 w-auto min-w-36 py-1 text-center font-semibold" value={sel.bulan} onChange={(e) => go({ m: e.target.value })} aria-label="Bulan">
              {[...actMonths].reverse().map((m) => (
                <option key={m} value={m}>
                  {ymLabel(m, true)}
                </option>
              ))}
            </select>
            <button className="btn-secondary h-10 px-3" disabled={!next} onClick={() => next && go({ m: next })} aria-label="Bulan berikutnya">
              ›
            </button>
          </div>
        )}
        {canEdit && (
          <>
            <button className="btn-secondary h-10 px-3" onClick={() => setManual(true)}>
              ✎ Input manual
            </button>
            <button className="btn-primary h-10 px-4" onClick={() => setUpload(true)}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
              </svg>
              Upload file
            </button>
          </>
        )}
        <DownloadMenu
          compact
          links={[
            ...(sel ? [{ label: "Excel laporan (.xlsx)", hint: "Ringkasan, tren bulanan, per part, PO harian", href: `/api/forecast/forecast-vs-po.xlsx?c=${encodeURIComponent(r.customer)}&m=${sel.bulan}` }] : []),
            { label: "Template upload (.xlsx)", hint: "Format sama dengan file forecast customer", href: `/api/forecast/template.xlsx?c=${encodeURIComponent(r.customer)}&versi=${sel ? addMonths(r.versions[r.versions.length - 1]?.versi ?? sel.bulan, 1) : ""}` },
          ]}
        />
      </div>
    </div>
  );

  const modals = (
    <>
      {upload && <ForecastUpload customers={allCustomers} defaultCustomer={r.customer} versions={r.versions.map((v) => v.versi)} onClose={() => setUpload(false)} onSaved={(c) => (setUpload(false), go({ c }), router.refresh())} />}
      {manual && (
        <ForecastManual
          customers={allCustomers}
          defaultCustomer={r.customer}
          month={sel?.bulan ?? new Date().toISOString().slice(0, 7)}
          parts={r.parts}
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl text-brand-600">📈</div>
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
      <Hero r={r} />
      <Insights r={r} />
      <TrendCard r={r} onPick={(m) => go({ m })} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AheadCard r={r} />
        <MoversCard r={r} />
      </div>
      <PartsCard r={r} />
      {r.daily.length > 0 && <DailyCard r={r} />}
      {isAdmin && <VersionsCard r={r} />}
      {modals}
    </main>
  );
}

// ---------- 1. angka utama ----------
function Hero({ r }: { r: ForecastReport }) {
  const s = r.sel!;
  const st = diffStatus(s.pct);
  const ratio = s.forecast ? Math.min(1.5, (s.actual ?? 0) / s.forecast) : null;
  const nx = r.nextMonth;
  const nxVal = nx?.actual ?? nx?.forecast ?? null;
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>
              PO {s.kind === "plan" ? "firm" : "aktual"} {ymLabel(s.bulan, true)}
            </span>
            <Chip pct={s.pct} />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{big(s.actual)}</div>
            <div className="pb-1.5 text-sm text-slate-600">
              pcs · forecast <b className="text-slate-900">{big(s.forecast)}</b>
            </div>
          </div>
          {ratio !== null ? (
            <div>
              <div className="relative h-3 w-full rounded-full bg-slate-100">
                <div className={`anim-bar h-full rounded-full ${st === "turun" ? "bg-red-600" : st === "naik" ? "bg-emerald-600" : "bg-brand-600"}`} style={{ width: `${(Math.min(ratio, 1.5) / 1.5) * 100}%` }} />
                <div className="absolute -top-1 bottom-[-4px] w-0.5 rounded bg-slate-800" style={{ left: `calc(${(1 / 1.5) * 100}% - 1px)` }} title="Forecast = 100%" />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                <span>
                  PO = <b className="text-slate-800">{Math.round(ratio * 100)}%</b> dari forecast
                </span>
                <span>
                  Selisih <b className={tone(s.pct)}>{s.diff! > 0 ? "+" : ""}{big(s.diff)} pcs ({pc(s.pct)})</b>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Forecast untuk bulan ini belum ada (tidak tercatat di file).</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 lg:border-l lg:border-t-0">
          <Tile k="PO vs bulan lalu" v={<Delta v={s.mom} />} h={`PO ${ymLabel(addMonths(s.bulan, -1))}`} />
          <Tile k="PO vs tahun lalu" v={<Delta v={s.yoy} />} h={`PO ${ymLabel(addMonths(s.bulan, -12))}`} />
          <Tile
            k={`${nx?.kind === "forecast" ? "Forecast" : "PO"} ${nx ? ymLabel(nx.bulan) : "bulan depan"}`}
            v={<span className="tabular-nums">{big(nxVal)}</span>}
            h={nxVal != null && s.actual ? <Delta v={nxVal / s.actual - 1} suffix="vs bulan ini" /> : "belum ada"}
          />
          <Tile
            k={`Akurasi forecast ${r.stats.n} bln`}
            v={<span className="tabular-nums">{r.stats.accuracy == null ? "-" : `${(r.stats.accuracy * 100).toFixed(1).replace(".", ",")}%`}</span>}
            h={r.stats.bias == null ? "-" : `rata-rata PO ${pc(r.stats.bias)} dari forecast`}
          />
        </div>
      </div>
    </section>
  );
}

function Tile({ k, v, h }: { k: string; v: React.ReactNode; h: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="mt-1 text-2xl font-bold">{v}</div>
      <div className="mt-0.5 text-xs text-slate-500">{h}</div>
    </div>
  );
}

// ---------- 2. kesimpulan otomatis ----------
function Insights({ r }: { r: ForecastReport }) {
  const s = r.sel!;
  const items: { icon: string; text: React.ReactNode }[] = [];
  const st = r.stats;
  if (st.n >= 3 && st.bias != null)
    items.push({
      icon: st.bias < -0.03 ? "↘" : st.bias > 0.03 ? "↗" : "≈",
      text: (
        <>
          {st.n} bulan terakhir PO rata-rata <b className={tone(st.bias)}>{pc(st.bias)}</b> dari forecast: {st.below} bulan turun &gt;10%, {st.above} bulan naik &gt;10%, {st.within} bulan sesuai.
          {st.bias < -0.05 && " Forecast customer cenderung terlalu tinggi, jangan langsung dijadikan dasar lembur."}
        </>
      ),
    });
  if (st.growth12 != null)
    items.push({
      icon: st.growth12 >= 0 ? "▲" : "▼",
      text: (
        <>
          Total PO 12 bulan s/d {ymLabel(s.bulan)} <b className={tone(st.growth12)}>{pc(st.growth12)}</b> dibanding 12 bulan sebelumnya.
        </>
      ),
    });
  const ahead = r.months.filter((m) => m.kind === "forecast").slice(0, 4);
  if (ahead.length && s.actual) {
    const avg = ahead.reduce((a, m) => a + (m.forecast ?? 0), 0) / ahead.length;
    items.push({
      icon: "→",
      text: (
        <>
          Forecast {ahead.length} bulan ke depan rata-rata <b>{big(avg)}</b>/bulan, <b className={tone(avg / s.actual - 1)}>{pc(avg / s.actual - 1)}</b> dibanding PO {ymLabel(s.bulan)}.
          {st.bias != null && st.n >= 3 && <> Bila pola selisih berlanjut, perkiraan PO realistis ±{big(avg * (1 + st.bias))}/bulan.</>}
        </>
      ),
    });
  }
  if (!items.length) return null;
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {items.map((it, i) => (
        <div key={i} className="card flex gap-3 p-4 text-sm leading-relaxed text-slate-700">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-bold text-brand-600">{it.icon}</span>
          <p>{it.text}</p>
        </div>
      ))}
    </section>
  );
}

// ---------- 3. tren bulanan ----------
const RANGES = [
  { k: 12, label: "12 bln" },
  { k: 24, label: "24 bln" },
  { k: 0, label: "Semua" },
];

function TrendCard({ r, onPick }: { r: ForecastReport; onPick: (m: string) => void }) {
  const [range, setRange] = useState(12);
  const [view, setView] = useState<"chart" | "table">("chart");
  const data = useMemo(() => {
    const sel = r.sel!.bulan;
    const hist = r.months.filter((m) => m.kind !== "forecast");
    const fut = r.months.filter((m) => m.kind === "forecast");
    const upto = hist.filter((m) => m.bulan <= sel);
    const after = hist.filter((m) => m.bulan > sel);
    const shown = range ? upto.slice(-range) : upto;
    return [...shown, ...after, ...fut].map((m) => ({
      ...m,
      label: ymLabel(m.bulan),
      bar: m.actual ?? null,
      fbar: m.kind === "forecast" ? m.forecast : null,
      line: m.forecast,
      pctV: m.pct,
    }));
  }, [r, range]);
  const futStart = data.find((d) => d.kind === "forecast")?.label;
  const pctTicks = useMemo(() => {
    const vals = data.map((d) => d.pctV ?? 0);
    const lo = Math.floor(Math.min(-0.1, ...vals) * 10) / 10;
    const hi = Math.ceil(Math.max(0.1, ...vals) * 10) / 10;
    const step = hi - lo > 0.6 ? 0.2 : 0.1;
    const out: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }, [data]);
  const futEnd = data[data.length - 1]?.label;
  const many = data.length > 18;
  const tipFmt = (v: unknown, name: unknown) => [`${n0(v as number)} pcs`, String(name)];
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Tren forecast vs PO per bulan</h2>
          <p className="text-xs text-slate-500">Klik batang untuk melihat bulan itu. Area abu-abu = bulan depan (baru forecast).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {RANGES.map((x) => (
              <button key={x.k} onClick={() => setRange(x.k)} className={`rounded-md px-3 py-1 font-medium ${range === x.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {(["chart", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 font-medium ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {v === "chart" ? "Grafik" : "Tabel"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "chart" ? (
        <>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm" style={{ background: MAROON }} /> PO aktual / firm
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-3 w-3 rounded-sm" style={{ background: MAROON_SOFT }} /> Forecast bulan depan
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: SLATE }} /> Forecast yang diberikan
            </span>
          </div>
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={many ? "18%" : "28%"}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                {futStart && <ReferenceArea x1={futStart} x2={futEnd} fill="#f1f5f9" fillOpacity={0.8} ifOverflow="extendDomain" />}
                <XAxis dataKey="label" tick={AX} interval={many ? "preserveStartEnd" : 0} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={AX} tickFormatter={axisBig} width={44} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(155,27,31,0.06)" }} formatter={tipFmt} />
                <Bar dataKey="bar" name="PO aktual" radius={[4, 4, 0, 0]} onClick={(d) => onPick((d as unknown as MonthPoint).bulan)} className="cursor-pointer" isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.bulan} fill={MAROON} fillOpacity={d.bulan === r.sel!.bulan ? 1 : 0.72} stroke={d.bulan === r.sel!.bulan ? "#4a0b0d" : undefined} strokeWidth={d.bulan === r.sel!.bulan ? 2 : 0} />
                  ))}
                </Bar>
                <Bar dataKey="fbar" name="Forecast bulan depan" fill={MAROON_SOFT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line dataKey="line" name="Forecast" stroke={SLATE} strokeWidth={2} strokeDasharray="5 4" dot={many ? false : { r: 3, fill: SLATE, stroke: "#fff", strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Selisih PO vs forecast (%)</h3>
              <span className="text-xs text-slate-500">pita abu-abu = ±10%</span>
            </div>
            <div className="h-32 sm:h-36">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.filter((d) => d.kind !== "forecast")} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <ReferenceArea y1={-0.1} y2={0.1} fill="#f1f5f9" />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <XAxis dataKey="label" tick={AX} interval={many ? "preserveStartEnd" : 0} tickLine={false} axisLine={false} />
                  <YAxis tick={AX} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={44} tickLine={false} axisLine={false} domain={[pctTicks[0], pctTicks[pctTicks.length - 1]]} ticks={pctTicks} />
                  <Tooltip contentStyle={TIP} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(15,23,42,0.04)" }} formatter={(v: unknown) => [pc(v as number), "PO vs forecast"]} />
                  <Bar dataKey="pctV" radius={[3, 3, 3, 3]} isAnimationActive={false} onClick={(d) => onPick((d as unknown as MonthPoint).bulan)} className="cursor-pointer">
                    {data
                      .filter((d) => d.kind !== "forecast")
                      .map((d) => (
                        <Cell key={d.bulan} fill={(d.pctV ?? 0) >= 0 ? UP : DOWN} fillOpacity={Math.abs(d.pctV ?? 0) <= 0.1 ? 0.45 : 0.9} />
                      ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Bulan</th>
                <th className="px-3 py-2 text-right">Forecast</th>
                <th className="px-3 py-2 text-right">PO</th>
                <th className="px-3 py-2 text-right">Selisih</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">vs bln lalu</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">vs thn lalu</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((m) => (
                <tr key={m.bulan} onClick={() => m.actual != null && onPick(m.bulan)} className={`cursor-pointer border-t border-slate-100 tabular-nums hover:bg-slate-50 ${m.bulan === r.sel!.bulan ? "bg-brand-50" : ""}`}>
                  <td className="px-3 py-2 font-medium">
                    {ymLabel(m.bulan, true)} {m.kind !== "actual" && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">{m.kind === "plan" ? "firm" : "forecast"}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{n0(m.forecast)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{n0(m.actual)}</td>
                  <td className={`px-3 py-2 text-right ${tone(m.pct)}`}>{n0(m.diff)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${tone(m.pct)}`}>{pc(m.pct)}</td>
                  <td className={`hidden px-3 py-2 text-right sm:table-cell ${tone(m.mom)}`}>{pc(m.mom)}</td>
                  <td className={`hidden px-3 py-2 text-right sm:table-cell ${tone(m.yoy)}`}>{pc(m.yoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- 4a. ke depan ----------
function AheadCard({ r }: { r: ForecastReport }) {
  const s = r.sel!;
  const ahead = r.months.filter((m) => m.bulan > s.bulan).slice(0, 5);
  const max = Math.max(s.actual ?? 0, ...ahead.map((m) => m.actual ?? m.forecast ?? 0)) || 1;
  const rev = new Map(r.revisions.map((x) => [x.bulan, x]));
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-bold">Bulan ke depan</h2>
      <p className="mb-3 text-xs text-slate-500">Dibanding PO {ymLabel(s.bulan)}. Revisi = perubahan dari file forecast sebelumnya.</p>
      {ahead.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Belum ada forecast bulan depan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[{ ...s, isBase: true }, ...ahead.map((m) => ({ ...m, isBase: false }))].map((m) => {
            const v = m.actual ?? m.forecast ?? 0;
            const rv = rev.get(m.bulan);
            return (
              <li key={m.bulan} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3">
                <div className="text-sm font-semibold">
                  {ymLabel(m.bulan)}
                  <div className="text-[10px] font-semibold uppercase text-slate-400">{m.isBase ? "dasar" : m.kind === "forecast" ? "forecast" : "PO"}</div>
                </div>
                <div className="h-6 rounded-md bg-slate-100">
                  <div className="anim-bar flex h-full items-center rounded-md px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(8, (v / max) * 100)}%`, background: m.isBase ? MAROON : m.kind === "forecast" ? "#b5555a" : MAROON }}>
                    {big(v)}
                  </div>
                </div>
                <div className="min-w-24 text-right text-xs">
                  {!m.isBase && s.actual ? <Delta v={v / s.actual - 1} /> : <span className="text-slate-400">—</span>}
                  {rv && (
                    <div className="text-slate-500">
                      revisi <span className={tone(rv.pct)}>{pc(rv.pct)}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- 4b. part naik/turun terbesar ----------
function MoversCard({ r }: { r: ForecastReport }) {
  const withFc = r.parts.filter((p) => p.diff !== null && p.diff !== 0);
  const up = [...withFc].filter((p) => p.diff! > 0).sort((a, b) => b.diff! - a.diff!).slice(0, 5);
  const down = [...withFc].filter((p) => p.diff! < 0).sort((a, b) => a.diff! - b.diff!).slice(0, 5);
  const max = Math.max(1, ...withFc.map((p) => Math.abs(p.diff!)));
  const List = ({ items, sign }: { items: PartPoint[]; sign: 1 | -1 }) => (
    <ul className="flex flex-col gap-2">
      {items.length === 0 && <li className="text-sm text-slate-400">Tidak ada.</li>}
      {items.map((p) => (
        <li key={p.part} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate font-medium" title={p.part}>
              {p.part}
            </span>
            <span className={`shrink-0 tabular-nums font-semibold ${sign > 0 ? "text-emerald-700" : "text-red-700"}`}>
              {sign > 0 ? "+" : ""}
              {big(p.diff)} <span className="font-normal text-slate-500">({pc(p.pct, 0)})</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div className="anim-bar h-full rounded-full" style={{ width: `${(Math.abs(p.diff!) / max) * 100}%`, background: sign > 0 ? UP : DOWN }} />
          </div>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-bold">Part dengan selisih terbesar</h2>
      <p className="mb-3 text-xs text-slate-500">PO {ymLabel(r.sel!.bulan)} dibanding forecast, dalam pcs.</p>
      {withFc.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Forecast per part untuk bulan ini tidak tercatat (file lama hanya punya total).</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">▲ PO di atas forecast</div>
            <List items={up} sign={1} />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">▼ PO di bawah forecast</div>
            <List items={down} sign={-1} />
          </div>
        </div>
      )}
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
  async function del(v: string) {
    if (!confirm(`Hapus data forecast versi ${ymLabel(v, true)} untuk ${r.customer}? Data di Sheet dikosongkan.`)) return;
    setBusy(v);
    const res = await fetch(`/api/forecast?versi=${v}&customer=${encodeURIComponent(r.customer)}`, { method: "DELETE" });
    setBusy("");
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "Gagal menghapus.");
    router.refresh();
  }
  return (
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer font-bold">File forecast tersimpan ({r.versions.length})</summary>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {[...r.versions].reverse().map((v) => (
          <li key={v.versi} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b>Versi {ymLabel(v.versi, true)}</b> <span className="text-slate-500">· {v.sumber} oleh {v.by} · {v.at.slice(0, 16)}</span>
            </span>
            <button className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50" disabled={!!busy} onClick={() => del(v.versi)}>
              {busy === v.versi ? "Menghapus…" : "Hapus"}
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
