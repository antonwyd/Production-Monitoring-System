"use client";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Chart } from "@/lib/reports";
import { formatCell } from "@/lib/format";

const COLOR = "#9b1b1f";
const CUM = "#e8a5a7";
const TIP = {
  contentStyle: { borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#cbd5e1" },
  cursor: { fill: "rgba(155,27,31,0.06)" },
};
const AX = { fontSize: 11, fill: "#64748b" };

export default function Charts({ charts }: { charts: Chart[] }) {
  if (!charts.length) return null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {charts.map((c) => {
        const s = c.series[0];
        const small = s.format === "pct" && c.data.every((d) => Math.abs(Number(d[s.key]) || 0) < 0.05);
        const tick = (v: number) => (s.format === "pct" ? `${(v * 100).toFixed(small ? 2 : 0).replace(".", ",")}%` : formatCell(v, s.format === "dec1" ? "dec1" : "int"));
        const many = c.data.length > 6;
        const xAxis = (
          <XAxis
            dataKey={c.xKey}
            tick={AX}
            interval={c.type === "line" ? "preserveStartEnd" : 0}
            angle={many && c.type !== "line" ? -35 : 0}
            textAnchor={many && c.type !== "line" ? "end" : "middle"}
            height={many && c.type !== "line" ? 70 : 30}
            tickFormatter={(v: string) => (String(v).length > 16 ? `${String(v).slice(0, 15)}…` : v)}
          />
        );
        const fmtTip = (v: unknown, name: unknown) => (name === "Kumulatif" ? [formatCell(v as number, "pct"), "Kumulatif"] : [formatCell(v as number, s.format), s.label]);
        return (
          <div key={c.title} className="card p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-bold">{c.title}</h3>
              {c.type === "pareto" && (
                <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR }} /> {s.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-0.5 w-3" style={{ background: CUM }} /> Kumulatif
                  </span>
                </span>
              )}
            </div>
            {c.data.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Belum ada data.</p>
            ) : (
              <div className={many && c.type !== "line" ? "h-72" : "h-60"}>
                <ResponsiveContainer width="100%" height="100%">
                  {c.type === "line" ? (
                    <LineChart data={c.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#eef0f3" vertical={false} />
                      {xAxis}
                      <YAxis tick={AX} tickFormatter={tick} width={56} />
                      <Tooltip {...TIP} formatter={fmtTip} />
                      <Line type="monotone" dataKey={s.key} stroke={COLOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive animationDuration={600} />
                    </LineChart>
                  ) : c.type === "pareto" ? (
                    <ComposedChart data={c.data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#eef0f3" vertical={false} />
                      {xAxis}
                      <YAxis yAxisId="v" tick={AX} tickFormatter={tick} width={56} />
                      <YAxis yAxisId="c" orientation="right" domain={[0, 1]} ticks={[0, 0.5, 0.8, 1]} tick={AX} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={40} />
                      <ReferenceLine yAxisId="c" y={0.8} stroke={CUM} strokeDasharray="4 4" />
                      <Tooltip {...TIP} formatter={fmtTip} />
                      <Bar yAxisId="v" dataKey={s.key} name={s.label} fill={COLOR} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive animationDuration={600} />
                      <Line yAxisId="c" dataKey="cum" name="Kumulatif" stroke={CUM} strokeWidth={2} dot={{ r: 3, fill: CUM }} isAnimationActive animationDuration={600} />
                    </ComposedChart>
                  ) : (
                    <BarChart data={c.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#eef0f3" vertical={false} />
                      {xAxis}
                      <YAxis tick={AX} tickFormatter={tick} width={56} />
                      <Tooltip {...TIP} formatter={fmtTip} />
                      <Bar dataKey={s.key} fill={COLOR} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive animationDuration={600} />
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
