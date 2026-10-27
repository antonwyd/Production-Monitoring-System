"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "@/lib/monthly";

// Warna sama dengan PPT lama yang biasa dilihat Presdir: plan ungu, result hijau.
const PLAN = "#7030a0";
const RESULT = "#7cb342";
const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");
const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1e3 ? `${Math.round(v / 1e3)} rb` : String(v));

/** Batang Daily Plan & Daily Result (sumbu kiri) + garis Total Plan & Total Result kumulatif (sumbu kanan). */
export default function MonthlyChart({ daily, hasPlan }: { daily: DailyRow[]; hasPlan: boolean }) {
  const data = daily.map((d) => ({ day: d.day, plan: d.plan, result: d.total, cumPlan: d.cumPlan, cumResult: d.cumResult }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} interval={1} />
          <YAxis yAxisId="d" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={short} width={48} />
          <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={short} width={52} />
          <Tooltip
            formatter={(v, n) => [fmt(Number(v)), String(n)]}
            labelFormatter={(l) => `Tanggal ${l}`}
            contentStyle={{ borderRadius: 10, border: "none", background: "#1d2430", color: "#fff", fontSize: 12 }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {hasPlan && <Bar yAxisId="d" dataKey="plan" name="Daily Plan" fill={PLAN} barSize={6} />}
          <Bar yAxisId="d" dataKey="result" name="Daily Result" fill={RESULT} barSize={6} />
          {hasPlan && <Line yAxisId="c" dataKey="cumPlan" name="Total Plan" stroke={PLAN} strokeDasharray="5 4" strokeWidth={2} dot={false} />}
          <Line yAxisId="c" dataKey="cumResult" name="Total Result" stroke={RESULT} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
