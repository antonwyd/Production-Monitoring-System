import type { Tile as TileData } from "@/lib/views";

export function Tile({ t, compact }: { t: TileData; compact?: boolean }) {
  return (
    <div className={`card flex flex-col gap-1 ${compact ? "p-3" : "px-5 py-4"}`}>
      <div className="text-sm text-slate-500">{t.label}</div>
      <div className={`font-bold tabular-nums ${compact ? "text-2xl" : "text-3xl"}`}>{t.value}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {t.trend && (
          <span className={`rounded-full px-2 py-0.5 font-semibold ${t.trend.good ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
            {t.trend.text}
          </span>
        )}
        <span>{t.sub}</span>
      </div>
    </div>
  );
}

const GRADE_CLS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-slate-200 text-slate-800",
  C: "bg-orange-100 text-orange-800",
  D: "bg-red-100 text-red-800",
};

export function Grade({ g }: { g: string }) {
  if (!g || g === "-") return <span className="text-slate-400">-</span>;
  return <span className={`inline-block min-w-7 rounded-md px-2 py-0.5 text-center text-xs font-bold ${GRADE_CLS[g] ?? ""}`}>{g}</span>;
}

export function BarRow({ name, right, pct }: { name: string; right: string; pct: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <span>{name}</span>
        <span className="font-semibold tabular-nums">{right}</span>
      </div>
      <div className="h-2 rounded bg-slate-100">
        <div className="h-2 rounded bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}
