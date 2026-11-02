"use client";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TIP = {
  contentStyle: { borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#cbd5e1" },
  cursor: { fill: "rgba(37,99,235,0.06)" },
};
const AX = { fontSize: 11, fill: "#64748b" };
const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const short = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1000 ? `${Math.round(v / 1000)} rb` : String(v));

export function TrendChart({ data, target, color }: { data: { label: string; output: number }[]; target: number; color: string }) {
  const rows = data.map((d) => ({ ...d, target }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={AX} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis tick={AX} tickFormatter={short} width={44} tickLine={false} axisLine={false} />
        <Tooltip {...TIP} formatter={(v, name) => [`${n0(Number(v))} pcs`, name === "target" ? "Target harian" : "Output aktual"]} />
        <Bar dataKey="output" fill={color} radius={[3, 3, 0, 0]} maxBarSize={18} />
        {target > 0 && <Line dataKey="target" stroke="#1e3a8a" strokeWidth={2} dot={false} strokeDasharray="5 4" />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ parts, total }: { parts: { name: string; value: number; color: string }[]; total: number }) {
  const data = parts.filter((p) => p.value > 0);
  return (
    <div className="relative h-36 w-36 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.length ? data : [{ name: "-", value: 1, color: "#e2e8f0" }]} dataKey="value" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
            {(data.length ? data : [{ color: "#e2e8f0" }]).map((p, i) => (
              <Cell key={i} fill={p.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-xs text-slate-500">PO</span>
      </div>
    </div>
  );
}
