"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DownloadMenu, { type DownloadLink } from "./DownloadMenu";

// Filter report: tombol cepat periode, tanggal sendiri (dilipat), pilihan kategori/member/part yang
// langsung berlaku tanpa tombol "Tampilkan", dan satu tombol Unduh (Excel / PDF).

export type FilterSelect = { name: string; label: string; value: string; options: { value: string; label: string }[] };

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const add = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const monthEnd = (d: string) => add(`${new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1)).toISOString().slice(0, 7)}-01`, -1);
const dmy = (d: string, year = true) => `${+d.slice(8, 10)} ${BLN[+d.slice(5, 7) - 1]}${year ? ` ${d.slice(0, 4)}` : ""}`;

/** "1 – 24 Okt 2026", "28 Sep – 3 Okt 2026", "24 Okt 2026". */
export function periodLabel(from: string, to: string) {
  if (from === to) return dmy(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${+from.slice(8, 10)} – ${dmy(to)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${dmy(from, false)} – ${dmy(to)}`;
  return `${dmy(from)} – ${dmy(to)}`;
}

export default function FilterBar({
  mode,
  from,
  to,
  date,
  month,
  today,
  selects = [],
  search,
  downloads,
}: {
  mode: "range" | "date" | "month";
  from: string;
  to: string;
  date: string;
  month: string;
  today: string;
  selects?: FilterSelect[];
  search?: { name: string; label: string; placeholder: string; value: string };
  downloads: DownloadLink[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [sp]);

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) if (v) q.set(k, v);
    else q.delete(k);
    return `${path}?${q.toString()}`;
  };
  const go = (patch: Record<string, string | null>) => {
    setBusy(true);
    router.push(href(patch));
  };

  const y = add(today, -1);
  const lm = add(monthStart(today), -1);
  const presets: { label: string; patch: Record<string, string | null>; on: boolean }[] =
    mode === "range"
      ? [
          { label: "Hari ini", patch: { from: today, to: today }, on: from === today && to === today },
          { label: "Kemarin", patch: { from: y, to: y }, on: from === y && to === y },
          { label: "7 hari", patch: { from: add(today, -6), to: today }, on: from === add(today, -6) && to === today },
          { label: "Bulan ini", patch: { from: monthStart(today), to: today }, on: from === monthStart(today) && to === today },
          { label: "Bulan lalu", patch: { from: monthStart(lm), to: monthEnd(lm) }, on: from === monthStart(lm) && to === monthEnd(lm) },
        ]
      : mode === "date"
        ? [
            { label: "Hari ini", patch: { date: today }, on: date === today },
            { label: "Kemarin", patch: { date: y }, on: date === y },
          ]
        : [
            { label: "Bulan ini", patch: { month: today.slice(0, 7) }, on: month === today.slice(0, 7) },
            { label: "Bulan lalu", patch: { month: lm.slice(0, 7) }, on: month === lm.slice(0, 7) },
          ];
  const anyOn = presets.some((p) => p.on);
  const label = mode === "range" ? periodLabel(from, to) : mode === "date" ? dmy(date) : `${BULAN[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;

  const chip = "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors";
  return (
    <section className={`no-print card flex flex-col gap-3 px-4 py-3 transition-opacity sm:px-5 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={href(p.patch)}
              onClick={() => setBusy(true)}
              className={`${chip} ${p.on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600"}`}
            >
              {p.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setCustom((v) => !v)}
            className={`${chip} gap-1.5 ${!anyOn || custom ? "border-brand-600 text-brand-600" : "border-slate-200 text-slate-700 hover:border-brand-600 hover:text-brand-600"} bg-white`}
            aria-expanded={custom}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </svg>
            {anyOn ? (mode === "month" ? "Pilih bulan" : "Pilih tanggal") : label}
          </button>
        </div>
        <DownloadMenu links={downloads} className="ml-auto" compact />
      </div>

      {custom && (
        <div className="anim-fade flex flex-wrap items-end gap-3">
          {mode === "range" && (
            <>
              <label className="text-sm text-slate-500">
                Dari
                <input type="date" value={from} max={to} onChange={(e) => e.target.value && go({ from: e.target.value })} className="input mt-1 h-10" />
              </label>
              <label className="text-sm text-slate-500">
                Sampai
                <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && go({ to: e.target.value })} className="input mt-1 h-10" />
              </label>
            </>
          )}
          {mode === "date" && (
            <label className="text-sm text-slate-500">
              Tanggal
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && go({ date: e.target.value })} className="input mt-1 h-10" />
            </label>
          )}
          {mode === "month" && (
            <label className="text-sm text-slate-500">
              Bulan
              <input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && go({ month: e.target.value })} className="input mt-1 h-10" />
            </label>
          )}
          <span className="pb-2.5 text-sm font-semibold text-slate-700">{label}</span>
        </div>
      )}

      {(selects.length > 0 || search) && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          {selects.map((s) => (
            <label key={s.name} className="text-sm text-slate-500">
              <span className="sr-only sm:not-sr-only sm:block">{s.label}</span>
              <select value={s.value} onChange={(e) => go({ [s.name]: e.target.value || null })} className="input h-10 w-full sm:mt-1 sm:w-auto sm:min-w-48" aria-label={s.label}>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {search && (
            <form
              className="text-sm text-slate-500"
              onSubmit={(e) => {
                e.preventDefault();
                go({ [search.name]: String(new FormData(e.currentTarget).get(search.name) ?? "").trim() || null });
              }}
            >
              <span className="sr-only sm:not-sr-only sm:block">{search.label}</span>
              <input type="search" name={search.name} defaultValue={search.value} placeholder={search.placeholder} enterKeyHint="search" className="input h-10 w-full sm:mt-1 sm:w-52" aria-label={search.label} />
            </form>
          )}
        </div>
      )}
    </section>
  );
}
