"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const pct = (v: number, d = 1) => `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: d })}%`;
const tip = { borderRadius: 8, border: "none", background: "#172033", color: "#fff", fontSize: 12 };
const axis = { fontSize: 11, fill: "#64748b" };

/** Utilisasi per mesin (urut tertinggi) dengan garis target. */
export function UtilBars({ data, target }: { data: { name: string; util: number | null }[]; target: number }) {
  const many = data.length > 14;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={many ? "preserveStartEnd" : 0} angle={many ? -35 : 0} textAnchor={many ? "end" : "middle"} height={many ? 50 : 30} minTickGap={4} />
          <YAxis tick={axis} tickFormatter={(v) => pct(v, 0)} width={44} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(155,27,31,0.06)" }} formatter={(v) => [pct(Number(v)), "Utilisasi"]} />
          <ReferenceLine y={target} stroke="#334155" strokeDasharray="4 4" label={{ value: `Target ${pct(target, 0)}`, position: "insideTopRight", fontSize: 11, fill: "#334155" }} />
          <Bar dataKey="util" fill="#9b1b1f" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tampilan Grafik tabel Semua mesin: utilisasi, efisiensi, dan OEE per mesin. */
export function MachineBars({ data }: { data: { name: string; util: number | null; eff: number | null; oee: number | null }[] }) {
  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={4} />
          <YAxis tick={axis} tickFormatter={(v) => pct(v, 0)} width={44} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(155,27,31,0.06)" }} formatter={(v, n) => [v == null ? "-" : pct(Number(v)), n]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="util" name="Utilisasi" fill="#9b1b1f" radius={[2, 2, 0, 0]} maxBarSize={14} />
          <Bar dataKey="eff" name="Efisiensi" fill="#64748b" radius={[2, 2, 0, 0]} maxBarSize={14} />
          <Bar dataKey="oee" name="OEE (kira-kira)" fill="#f59e0b" radius={[2, 2, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tren harian satu mesin: utilisasi dan efisiensi. */
export function MachineTrend({ data }: { data: { date: string; util: number | null; eff: number | null }[] }) {
  if (!data.some((d) => d.util != null)) return <div className="grid h-40 place-items-center text-sm text-slate-500">Mesin ini tidak jalan di rentang ini.</div>;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={8} />
          <YAxis tick={axis} tickFormatter={(v) => pct(v, 0)} width={44} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v, n) => [v == null ? "-" : pct(Number(v)), n]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="util" name="Utilisasi" stroke="#9b1b1f" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          <Line dataKey="eff" name="Efisiensi" stroke="#64748b" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
