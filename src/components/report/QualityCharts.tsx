"use client";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: d })}%`;
const tip = { borderRadius: 8, border: "none", background: "#172033", color: "#fff", fontSize: 12 };
const axis = { fontSize: 11, fill: "#64748b" };

/** Pareto mendatar: batang NG per jenis (sumbu bawah, pcs) + garis kumulatif (sumbu atas, %). */
export function ParetoH({ data }: { data: { name: string; qty: number; share: number; cum: number }[] }) {
  const h = Math.max(220, data.length * 30 + 60);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" horizontal={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ ...axis, fill: "#334155" }} axisLine={false} tickLine={false} interval={0} />
          <XAxis xAxisId="q" type="number" tick={axis} tickFormatter={(v) => n0(v)} axisLine={false} tickLine={false} />
          <XAxis xAxisId="c" type="number" orientation="top" domain={[0, 1]} tick={axis} tickFormatter={(v) => pct(v, 0)} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v, name) => (name === "Kumulatif" ? pct(Number(v)) : `${n0(Number(v))} pcs`)} />
          <Bar xAxisId="q" dataKey="qty" name="NG" fill="#9b1b1f" barSize={16} radius={[0, 3, 3, 0]}>
            <LabelList dataKey="qty" position="right" formatter={(v) => n0(Number(v))} style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
          </Bar>
          <Line xAxisId="c" dataKey="cum" name="Kumulatif" stroke="#f59e9e" strokeWidth={2} dot={{ r: 3, fill: "#f59e9e" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grafik mini di tabel (tanpa sumbu). Nilai null = tidak ada produksi hari itu. */
export function MiniLine({ data, color = "#9b1b1f" }: { data: (number | null)[]; color?: string }) {
  const rows = data.map((v, i) => ({ i, v }));
  if (!data.some((v) => v)) return <span className="text-xs text-slate-300">-</span>;
  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
          <YAxis hide domain={[0, "dataMax"]} />
          <Line dataKey="v" stroke={color} strokeWidth={1.6} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tren NG rate harian satu part, dengan garis batas NG. */
export function RateTrend({ data, limit }: { data: { date: string; rate: number | null }[]; limit: number }) {
  if (!data.some((d) => d.rate != null)) return <div className="grid h-48 place-items-center text-sm text-slate-500">Belum ada data.</div>;
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={8} />
          <YAxis tick={axis} tickFormatter={(v) => pct(v, 2)} width={48} axisLine={false} tickLine={false} domain={[0, (max: number) => Math.max(max, limit) * 1.2]} />
          <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v) => pct(Number(v), 2)} />
          <ReferenceLine y={limit} stroke="#e11d48" strokeDasharray="4 4" />
          <Line dataKey="rate" name="NG rate" stroke="#9b1b1f" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
