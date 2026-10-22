"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Chart } from "@/lib/reports";
import { formatCell } from "@/lib/format";

const COLOR = "#9b1b1f";

export default function Charts({ charts }: { charts: Chart[] }) {
  if (!charts.length) return null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {charts.map((c) => {
        const s = c.series[0];
        const tick = (v: number) => (s.format === "pct" ? `${Math.round(v * 100)}%` : formatCell(v, s.format === "dec1" ? "dec1" : "int"));
        return (
          <div key={c.title} className="card p-5">
            <h3 className="mb-3 font-bold">{c.title}</h3>
            {c.data.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  {c.type === "line" ? (
                    <LineChart data={c.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#eef0f3" vertical={false} />
                      <XAxis dataKey={c.xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={tick} width={56} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(155,27,31,0.06)" }} formatter={(v) => [formatCell(v as number, s.format), s.label]} />
                      <Line type="monotone" dataKey={s.key} stroke={COLOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive animationDuration={600} />
                    </LineChart>
                  ) : (
                    <BarChart data={c.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#eef0f3" vertical={false} />
                      <XAxis dataKey={c.xKey} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={c.data.length > 6 ? -30 : 0} textAnchor={c.data.length > 6 ? "end" : "middle"} height={c.data.length > 6 ? 60 : 30} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={tick} width={56} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} cursor={{ fill: "rgba(155,27,31,0.06)" }} formatter={(v) => [formatCell(v as number, s.format), s.label]} />
                      <Bar dataKey={s.key} fill={COLOR} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
