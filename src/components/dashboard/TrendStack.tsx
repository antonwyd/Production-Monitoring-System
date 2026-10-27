"use client";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; qty: number; ach: number | null; rate: number | null; lt: number };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: d })}%`;
const kfmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v));
const tip = { borderRadius: 8, border: "none", background: "#172033", color: "#fff", fontSize: 12 };
const axis = { fontSize: 11, fill: "#64748b" };

/**
 * Tiga grafik kecil dengan sumbu X yang sama, supaya pcs, persen, dan menit tidak berbagi skala:
 * 1) hasil (pcs) + achievement (%) dengan garis target, 2) NG rate (%) dengan batas, 3) lost time (menit).
 */
export default function TrendStack({ data, target, ngLimit }: { data: Row[]; target: number; ngLimit: number }) {
  const rows = data.map((d) => ({ ...d, ach: d.ach ?? undefined, rate: d.rate ?? undefined }));
  const empty = data.every((d) => !d.qty && !d.lt);
  if (empty) return <div className="grid h-64 place-items-center text-sm text-slate-500">Belum ada laporan yang disetujui di periode ini.</div>;
  const tick = data.length > 14 ? Math.ceil(data.length / 10) - 1 : 0;
  return (
    <div className="flex flex-col gap-1">
      <Panel title="Hasil (pcs) & Achievement (%)" legend={[["#9b1b1f", "Hasil"], ["#0f766e", "Achievement"], ["#94a3b8", `Target ${target}%`, true]]}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId="trend" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis yAxisId="q" tick={axis} tickFormatter={kfmt} width={44} axisLine={false} tickLine={false} />
            <YAxis yAxisId="a" orientation="right" tick={axis} tickFormatter={(v) => pct(v, 0)} width={44} axisLine={false} tickLine={false} domain={[0, (max: number) => Math.max(1.2, Math.ceil(max * 10) / 10)]} />
            <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v, name) => (name === "Achievement" ? pct(Number(v)) : `${n0(Number(v))} pcs`)} />
            <ReferenceLine yAxisId="a" y={target / 100} stroke="#94a3b8" strokeDasharray="4 4" />
            <Bar yAxisId="q" dataKey="qty" name="Hasil" fill="#9b1b1f" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line yAxisId="a" dataKey="ach" name="Achievement" stroke="#0f766e" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="NG rate (%)" legend={[["#d97706", "NG rate"], ["#e11d48", `Batas ${pct(ngLimit, 2)}`, true]]} small>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId="trend" margin={{ top: 6, right: 44, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis tick={axis} tickFormatter={(v) => pct(v, 2)} width={44} axisLine={false} tickLine={false} domain={[0, (max: number) => Math.max(max, ngLimit) * 1.2]} />
            <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v) => pct(Number(v), 2)} />
            <ReferenceLine y={ngLimit} stroke="#e11d48" strokeDasharray="4 4" />
            <Line dataKey="rate" name="NG rate" stroke="#d97706" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Lost time (menit)" legend={[["#2563eb", "Lost time"]]} small axis>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId="trend" margin={{ top: 6, right: 44, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={tick} minTickGap={6} />
            <YAxis tick={axis} width={44} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tip} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#cbd5e1" }} formatter={(v) => `${n0(Number(v))} menit`} />
            <Bar dataKey="lt" name="Lost time" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function Panel({ title, legend, small, axis, children }: { title: string; legend: [string, string, boolean?][]; small?: boolean; axis?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">{title}</span>
        {legend.map(([c, l, dash]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={dash ? "h-0 w-3 border-t-2 border-dashed" : "h-2.5 w-2.5 rounded-sm"} style={dash ? { borderColor: c } : { background: c }} />
            {l}
          </span>
        ))}
      </div>
      <div className={small ? (axis ? "h-28" : "h-20") : "h-40"}>{children}</div>
    </div>
  );
}
