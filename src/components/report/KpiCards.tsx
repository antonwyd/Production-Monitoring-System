import type { Kpi } from "@/lib/reports";
import { formatCell } from "@/lib/format";

/** Kartu angka utama: garis kiri dan label hijau/merah bila ada target. 2 kolom di HP, 4 di desktop. */
export default function KpiCards({ kpis }: { kpis: Kpi[] }) {
  if (!kpis.length) return null;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className="card relative flex flex-col gap-1 overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4">
          {k.status && <span className={`absolute inset-y-3 left-0 w-1 rounded-r ${k.status === "good" ? "bg-emerald-600" : "bg-brand-600"}`} />}
          <div className="text-[13px] leading-tight text-slate-500 sm:text-sm">{k.label}</div>
          <div className="text-2xl font-bold tabular-nums sm:text-3xl">{formatCell(k.value, k.format)}</div>
          {k.target && (
            <div className={`text-xs font-semibold ${k.status === "good" ? "text-emerald-700" : k.status === "bad" ? "text-brand-600" : "text-slate-500"}`}>
              {k.status === "good" ? "✓ Sesuai target" : k.status === "bad" ? "Di luar target" : "Target"} · {k.target}
            </div>
          )}
          {k.hint && <div className="text-xs text-slate-500">{k.hint}</div>}
        </div>
      ))}
    </section>
  );
}
