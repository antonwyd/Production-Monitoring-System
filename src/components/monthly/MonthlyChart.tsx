"use client";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "@/lib/monthly";

// Dua panel: atas = kumulatif Result vs Plan (sudah on-track atau belum), bawah = result harian,
// batang merah tua bila mencapai plan harian, merah muda bila di bawah. Plan selalu garis putus abu-abu.
const BRAND = "#9b1b1f";
const SOFT = "#e8a5a7";
const PLAN = "#64748b";
const GRID = "#eef0f3";
const AX = { fontSize: 11, fill: "#64748b" };
const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1e3 ? `${Math.round(v / 1e3)} rb` : String(v));
const TIP = {
  contentStyle: { borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#cbd5e1" },
  cursor: { fill: "rgba(155,27,31,0.06)" },
};

function Legend({ items }: { items: { label: string; color: string; kind: "bar" | "line" | "dash" | "area" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === "bar" ? (
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          ) : i.kind === "area" ? (
            <i className="h-2.5 w-4 rounded-sm border-t-2" style={{ borderColor: i.color, background: `${i.color}22` }} />
          ) : (
            <i className="w-4 border-t-2" style={{ borderColor: i.color, borderStyle: i.kind === "dash" ? "dashed" : "solid" }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export default function MonthlyChart({ daily, hasPlan, asOf }: { daily: DailyRow[]; hasPlan: boolean; asOf?: string }) {
  const data = daily.map((d) => ({ day: d.day, work: d.work, plan: d.plan || null, result: d.total, cumPlan: hasPlan ? d.cumPlan : null, cumResult: asOf && d.date > asOf ? null : d.cumResult }));
  const today = asOf && asOf.slice(0, 7) === daily[0]?.date.slice(0, 7) && asOf < daily[daily.length - 1].date ? Number(asOf.slice(8)) : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">Kumulatif</span>
          <Legend
            items={[
              { label: "Result", color: BRAND, kind: "area" },
              ...(hasPlan ? [{ label: "Plan", color: PLAN, kind: "dash" as const }] : []),
            ]}
          />
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tick={AX} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={2} />
              <YAxis tick={AX} tickFormatter={short} width={48} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v, n) => [fmt(Number(v)), String(n)]} labelFormatter={(l) => `Sampai tanggal ${l}`} />
              <Area dataKey="cumResult" name="Result kumulatif" stroke={BRAND} strokeWidth={2.5} fill="url(#cumFill)" dot={false} activeDot={{ r: 4 }} />
              {today && <ReferenceLine x={today} stroke="#94a3b8" strokeDasharray="2 3" label={{ value: "hari ini", position: "top", fontSize: 10, fill: "#64748b" }} />}
              {hasPlan && <Line dataKey="cumPlan" name="Plan kumulatif" stroke={PLAN} strokeWidth={2} strokeDasharray="6 4" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">Harian</span>
          <Legend
            items={
              hasPlan
                ? [
                    { label: "Capai plan", color: BRAND, kind: "bar" },
                    { label: "Di bawah plan", color: SOFT, kind: "bar" },
                    { label: "Plan harian", color: PLAN, kind: "dash" },
                  ]
                : [{ label: "Result", color: BRAND, kind: "bar" }]
            }
          />
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tick={AX} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={2} />
              <YAxis tick={AX} tickFormatter={short} width={48} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v, n) => [fmt(Number(v)), String(n)]} labelFormatter={(l) => `Tanggal ${l}`} />
              <Bar dataKey="result" name="Result" radius={[3, 3, 0, 0]} maxBarSize={14}>
                {data.map((d) => (
                  <Cell key={d.day} fill={!hasPlan || !d.plan || d.result >= d.plan ? BRAND : SOFT} />
                ))}
              </Bar>
              {hasPlan && <Line dataKey="plan" name="Plan harian" stroke={PLAN} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} type="stepAfter" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
