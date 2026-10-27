"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Ubah satu parameter URL dashboard dan pertahankan yang lain (tanggal, proses, rentang tren). */
export function useSetParam() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (key: string, value: string) => {
    const q = new URLSearchParams(sp.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  };
}

export function ProcSelect({ procs, value }: { procs: string[]; value: string }) {
  const set = useSetParam();
  return (
    <label className="relative">
      <span className="sr-only">Proses</span>
      <select value={value} onChange={(e) => set("proc", e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm font-medium text-slate-800 hover:border-slate-400">
        <option value="">Semua proses</option>
        {procs.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented({ name, value, options }: { name: string; value: string; options: [string, string][] }) {
  const set = useSetParam();
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold" role="group">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => set(name, v)}
          aria-pressed={value === v}
          className={`rounded-md px-2.5 py-1.5 transition-colors ${value === v ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
