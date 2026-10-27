"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MonthPlan } from "@/lib/sheets/plan";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const show = (v: number | undefined) => (v ? v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "");

/** Form plan satu section: angka plan + kalender hari kerja + catatan. Disimpan ke tab "Plan Bulanan". */
export default function PlanForm({
  month,
  section,
  days,
  firstWeekday,
  defaultDays,
  normalMin,
  current,
  previous,
}: {
  month: string;
  section: { key: string; name: string; unit: string; categories: string };
  days: number;
  firstWeekday: number;
  defaultDays: number[];
  normalMin: number;
  current: MonthPlan | null;
  previous: MonthPlan | null;
}) {
  const router = useRouter();
  const base = current ?? previous;
  const [production, setProduction] = useState(show(current?.production));
  const [units, setUnits] = useState(show(base?.units));
  const [productivity, setProductivity] = useState(show(base?.productivity));
  const [hours, setHours] = useState(show(current?.hoursNormal));
  const [note, setNote] = useState(current?.note ?? "");
  const [work, setWork] = useState<Set<number>>(new Set(current?.workDays.length ? current.workDays : defaultDays));
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});

  const n = work.size;
  const daily = n ? num(production) / n : 0;
  const hoursDefault = Math.round(((n * normalMin) / 60) * 10) / 10;
  const hoursNormal = num(hours) || hoursDefault;
  const required = num(productivity) > 0 && num(units) > 0 ? num(production) / (num(productivity) * num(units)) : null;
  const toggle = (d: number) =>
    setWork((w) => {
      const x = new Set(w);
      if (x.has(d)) x.delete(d);
      else x.add(d);
      return x;
    });
  const cells = useMemo(() => [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)], [days, firstWeekday]);

  async function save() {
    setState({ busy: true });
    try {
      const res = await fetch("/api/production-report/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, section: section.key, production: num(production), units: num(units), productivity: num(productivity), hoursNormal: num(hours), workDays: [...work], note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Gagal menyimpan.");
      setState({ ok: "Tersimpan." });
      router.refresh();
    } catch (e) {
      setState({ err: (e as Error).message });
    }
  }

  const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{section.name}</h2>
        <span className="text-xs text-slate-500">
          {section.categories}
          {current ? ` · terakhir diisi ${current.by} ${current.updated}` : previous ? " · belum diisi, angka diambil dari plan bulan lalu" : " · belum diisi"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2">
            <span className="label">Plan Produksi (pcs/bulan)</span>
            <input className="input" inputMode="numeric" value={production} onChange={(e) => setProduction(e.target.value)} placeholder="mis. 31.778.200" />
          </label>
          <label>
            <span className="label">{section.unit}</span>
            <input className="input" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />
          </label>
          <label>
            <span className="label">Productivity (pcs/jam)</span>
            <input className="input" inputMode="decimal" value={productivity} onChange={(e) => setProductivity(e.target.value)} />
          </label>
          <label className="col-span-2">
            <span className="label">Time Normal (jam / {section.unit.toLowerCase()})</span>
            <input className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={`otomatis ${show(hoursDefault)} (${n} hari × ${normalMin / 60} jam)`} />
          </label>
          <label className="col-span-2">
            <span className="label">Catatan (tampil di Notes)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
          </label>
          <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-4">
            Plan harian <b>{fmt(daily)}</b> pcs × {n} hari kerja · Time Normal <b>{show(hoursNormal)}</b> jam · Time Required{" "}
            <b>{required == null ? "-" : show(Math.round(required * 10) / 10)}</b> jam · Need Over Time{" "}
            <b className={required != null && required - hoursNormal > 0 ? "text-red-700" : ""}>{required == null ? "-" : show(Math.round((required - hoursNormal) * 10) / 10)}</b> jam
          </div>
        </div>
        <div>
          <span className="label">Hari kerja ({n} hari) · klik untuk libur/masuk</span>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {HARI.map((h) => (
              <span key={h} className="py-1 font-semibold text-slate-500">
                {h}
              </span>
            ))}
            {cells.map((d, i) =>
              d == null ? (
                <span key={`x${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(d)}
                  className={`h-9 rounded-md border text-sm font-semibold transition ${work.has(d) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-red-700"}`}
                  aria-pressed={work.has(d)}
                >
                  {d}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={state.busy || !num(production)}>
          {state.busy ? "Menyimpan…" : "Simpan plan"}
        </button>
        {state.ok && <span className="text-sm font-semibold text-emerald-700">{state.ok}</span>}
        {state.err && <span className="text-sm font-semibold text-red-700">{state.err}</span>}
      </div>
    </section>
  );
}
