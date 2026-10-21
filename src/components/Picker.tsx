"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type PickerOption<V> = { value: V; label: string; sub?: string; search?: string };
export type PickerGroup<V> = { title?: string; options: PickerOption<V>[] };

/** Picker layar penuh dengan kotak cari (pengganti dropdown kecil di HP). */
export default function Picker<V extends string | number>({
  label,
  value,
  groups,
  onChange,
  placeholder = "Pilih…",
  disabled,
  invalid,
  normalizeSearch,
}: {
  label: string;
  value: V | null;
  groups: PickerGroup<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  normalizeSearch?: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const all = groups.flatMap((g) => g.options);
  const selected = all.find((o) => o.value === value);
  const total = all.length;

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const norm = normalizeSearch ?? ((s: string) => s.toLowerCase());
    const nq = norm(q.trim());
    if (!nq) return groups;
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => norm(`${o.label} ${o.sub ?? ""} ${o.search ?? ""}`).includes(nq)),
      }))
      .filter((g) => g.options.length);
  }, [q, groups, normalizeSearch]);

  return (
    <>
      <div>
        <span className="label">{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`input flex min-h-[46px] items-center justify-between text-left disabled:bg-slate-100 disabled:text-slate-400 ${
            invalid ? "border-red-400" : ""
          }`}
        >
          <span className={selected ? "" : "text-slate-400"}>
            {selected ? selected.label : placeholder}
            {selected?.sub && <span className="ml-2 text-sm text-slate-500">{selected.sub}</span>}
          </span>
          <span className="text-slate-400">▾</span>
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-label={label}>
          <div className="flex items-center gap-2 border-b border-slate-200 p-3">
            <button type="button" className="btn-secondary px-3" onClick={() => setOpen(false)} aria-label="Tutup">
              ←
            </button>
            <input
              ref={inputRef}
              className="input"
              placeholder={`Cari ${label.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((g, gi) => (
              <div key={gi}>
                {g.title && <div className="sticky top-0 bg-slate-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">{g.title}</div>}
                {g.options.map((o) => (
                  <button
                    type="button"
                    key={String(o.value)}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3.5 text-left text-base hover:bg-brand-50 ${
                      o.value === value ? "bg-brand-50 font-semibold text-brand-700" : ""
                    }`}
                  >
                    <span>{o.label}</span>
                    {o.sub && <span className="text-right text-sm text-slate-500">{o.sub}</span>}
                  </button>
                ))}
              </div>
            ))}
            {!filtered.length && <p className="p-6 text-center text-slate-500">Tidak ada hasil{total ? "" : " (master kosong)"}.</p>}
          </div>
        </div>
      )}
    </>
  );
}
