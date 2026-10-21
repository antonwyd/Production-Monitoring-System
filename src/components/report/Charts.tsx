"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Chart } from "@/lib/reports";
import { formatCell } from "@/lib/format";

const COLOR = "#3a55e0";
const GRID = "#eef0f3";
const TICK = { fontSize: 11, fill: "#667085" };
const TOOLTIP = {
  contentStyle: { borderRadius: 8, border: "1px solid #e4e7ec", boxShadow: "0 8px 24px -8px rgb(16 24 40 / 0.18)", fontSize: 12, padding: "8px 10px" },
  labelStyle: { color: "#101828", fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: "#344054", padding: 0 },
};

export default function Charts({ charts }: { charts: Chart[] }) {
  if (!charts.length) return null;
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {charts.map((c) => {
        const s = c.series[0];
        const tick = (v: number) => (s.format === "pct" ? `${Math.round(v * 100)}%` : formatCell(v, s.format === "dec1" ? "dec1" : "int"));
        const gid = `g-${c.title.replace(/[^a-z0-9]/gi, "")}`;
        const many = c.data.length > 6;
        return (
          <div key={c.title} className="card p-4 sm:p-5">
            <h3 className="section-title mb-4">{c.title}</h3>
            {c.data.length === 0 ? (
              <div className="grid h-60 place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">Belum ada data.</div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  {c.type === "line" ? (
                    <AreaChart data={c.data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLOR} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey={c.xKey} tick={TICK} tickLine={false} axisLine={{ stroke: "#e4e7ec" }} tickMargin={8} />
                      <YAxis tick={TICK} tickFormatter={tick} width={56} tickLine={false} axisLine={false} />
                      <Tooltip {...TOOLTIP} cursor={{ stroke: "#d0d5dd", strokeDasharray: "3 3" }} formatter={(v) => [formatCell(v as number, s.format), s.label]} />
                      <Area
                        type="monotone"
                        dataKey={s.key}
                        stroke={COLOR}
                        strokeWidth={2}
                        fill={`url(#${gid})`}
                        dot={{ r: 2.5, fill: "#fff", stroke: COLOR, strokeWidth: 1.5 }}
                        activeDot={{ r: 4.5, fill: COLOR, stroke: "#fff", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={c.data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis
                        dataKey={c.xKey}
                        tick={TICK}
                        tickLine={false}
                        axisLine={{ stroke: "#e4e7ec" }}
                        interval={0}
                        angle={many ? -35 : 0}
                        textAnchor={many ? "end" : "middle"}
                        height={many ? 84 : 30}
                        tickMargin={6}
                        tickFormatter={(v) => (typeof v === "string" && v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                      />
                      <YAxis tick={TICK} tickFormatter={tick} width={56} tickLine={false} axisLine={false} />
                      <Tooltip {...TOOLTIP} cursor={{ fill: "#f1f3f6" }} formatter={(v) => [formatCell(v as number, s.format), s.label]} />
                      <Bar dataKey={s.key} fill={COLOR} radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} />
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
