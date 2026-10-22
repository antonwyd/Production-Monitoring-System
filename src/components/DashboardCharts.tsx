"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

/** Tren 7 hari: batang hasil & NG (pcs, kiri), garis NG rate (%, kanan). */
export function TrendChart({ data }: { data: { label: string; qty: number; ng: number; rate: number | null }[] }) {
  const rows = data.map((d) => ({ ...d, rate: d.rate ?? 0 }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis yAxisId="q" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} width={44} axisLine={false} tickLine={false} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => pct(v)} width={52} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, name) => (name === "NG Rate" ? pct(Number(v)) : `${n0(Number(v))} pcs`)} />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="q" dataKey="qty" name="Hasil Produksi" fill="#9b1b1f" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Bar yAxisId="q" dataKey="ng" name="NG" fill="#f4a3a8" radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Line yAxisId="r" dataKey="rate" name="NG Rate" stroke="#eab308" strokeWidth={2} dot={{ r: 3, fill: "#eab308" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut status laporan: sudah kirim / menunggu / belum kirim. */
export function StatusDonut({ done, waiting, missing, label }: { done: number; waiting: number; missing: number; label: string }) {
  const data = [
    { name: "Sudah kirim", value: done, fill: "#16a34a" },
    { name: "Menunggu validasi", value: waiting, fill: "#f97316" },
    { name: "Belum kirim", value: missing, fill: "#e11d48" },
  ];
  const empty = done + waiting + missing === 0;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={empty ? [{ name: "-", value: 1, fill: "#e2e8f0" }] : data}
            dataKey="value"
            innerRadius={52}
            outerRadius={72}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{label}</span>
        <span className="text-xs text-slate-500">sudah kirim</span>
      </div>
    </div>
  );
}
