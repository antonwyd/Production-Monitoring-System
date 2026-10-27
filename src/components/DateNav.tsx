"use client";
import { useRouter, useSearchParams } from "next/navigation";

const shift = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Pilih tanggal dashboard: panah hari sebelum/sesudah dan kalender. */
export default function DateNav({ date, max, label }: { date: string; max: string; label: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  // Filter lain (proses, rentang tren) tetap terbawa saat ganti tanggal.
  const go = (d: string) => {
    if (!d) return;
    const q = new URLSearchParams(sp.toString());
    q.set("date", d);
    router.push(`?${q}`);
  };
  const btn = "flex h-11 w-10 items-center justify-center text-lg text-slate-500 hover:text-slate-900 disabled:text-slate-300";
  return (
    <div className="flex items-center rounded-lg border border-slate-300 bg-white">
      <button className={btn} onClick={() => go(shift(date, -1))} aria-label="Hari sebelumnya">
        ‹
      </button>
      <label className="relative flex h-11 cursor-pointer items-center gap-2 border-x border-slate-200 px-3 text-sm font-medium">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        </svg>
        {label}
        <input
          type="date"
          value={date}
          max={max}
          onChange={(e) => go(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pilih tanggal"
        />
      </label>
      <button className={btn} disabled={date >= max} onClick={() => go(shift(date, 1))} aria-label="Hari berikutnya">
        ›
      </button>
    </div>
  );
}
