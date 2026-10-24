"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
          <Tooltip cursor={{ fill: "rgba(155,27,31,0.06)" }} contentStyle={{ borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v, name) => (name === "NG Rate" ? pct(Number(v)) : `${n0(Number(v))} pcs`)} />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="q" dataKey="qty" name="Hasil Produksi" fill="#9b1b1f" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={700} />
          <Line yAxisId="r" dataKey="rate" name="NG Rate" stroke="#1d2430" strokeWidth={2} dot={{ r: 3, fill: "#1d2430" }} isAnimationActive animationDuration={700} />
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
            isAnimationActive animationDuration={700}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{label}</span>
        <span className="text-xs text-slate-500">laporan masuk</span>
      </div>
    </div>
  );
}

/** Grafik mini di kartu: garis (hasil) atau batang (NG). */
export function Spark({ data, kind }: { data: number[]; kind: "line" | "bar" }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div className="-mt-1 h-9 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "line" ? (
          <AreaChart data={rows} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9b1b1f" stopOpacity={0.25} />
                <stop offset="1" stopColor="#9b1b1f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#9b1b1f" strokeWidth={2} fill="url(#sparkFill)" dot={false} isAnimationActive animationDuration={800} />
          </AreaChart>
        ) : (
          <BarChart data={rows} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
            <Bar dataKey="v" fill="#f4a3a8" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={800} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
