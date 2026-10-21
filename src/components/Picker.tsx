"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

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
          aria-haspopup="dialog"
          className={`input flex min-h-[46px] items-center justify-between gap-2 text-left ${
            invalid ? "border-red-400 bg-red-50/40 hover:border-red-400" : ""
          }`}
        >
          <span className={`min-w-0 truncate ${selected ? "font-medium text-slate-900" : "text-slate-400"}`}>
            {selected ? selected.label : placeholder}
            {selected?.sub && <span className="ml-2 text-sm font-normal text-slate-500">{selected.sub}</span>}
          </span>
          <Icon name="chevronDown" size={16} className="text-slate-400" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-stretch justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-start sm:p-6 sm:pt-[10vh]" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full animate-sheet-in flex-col bg-white sm:max-h-[70vh] sm:max-w-lg sm:overflow-hidden sm:rounded-2xl sm:shadow-pop"
          >
            <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-2 sm:px-3">
              <button type="button" className="btn-ghost btn-sm min-h-10 px-2 sm:hidden" onClick={() => setOpen(false)} aria-label="Tutup">
                <Icon name="arrowLeft" size={20} />
              </button>
              <div className="relative flex-1">
                <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  className="w-full rounded-lg bg-transparent py-2.5 pr-3 pl-10 text-base outline-none placeholder:text-slate-400 focus-visible:outline-none"
                  placeholder={`Cari ${label.toLowerCase()}…`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <button type="button" className="btn-ghost btn-sm hidden px-2 sm:inline-flex" onClick={() => setOpen(false)} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain py-1 pb-8 sm:pb-2">
              {filtered.map((g, gi) => (
                <div key={gi}>
                  {g.title && <div className="sticky top-0 z-10 bg-white/95 px-4 pt-3 pb-1.5 text-xs font-medium text-slate-500 backdrop-blur">{g.title}</div>}
                  {g.options.map((o) => {
                    const on = o.value === value;
                    return (
                      <button
                        type="button"
                        key={String(o.value)}
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className={`mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-lg px-3 py-3 text-left text-base transition-colors hover:bg-slate-100 ${
                          on ? "bg-brand-50 text-brand-700 hover:bg-brand-50" : "text-slate-900"
                        }`}
                      >
                        <span className={`min-w-0 flex-1 ${on ? "font-semibold" : ""}`}>{o.label}</span>
                        {o.sub && <span className={`text-right text-sm ${on ? "text-brand-600" : "text-slate-500"}`}>{o.sub}</span>}
                        <Icon name="check" size={16} className={on ? "text-brand-600" : "invisible"} />
                      </button>
                    );
                  })}
                </div>
              ))}
              {!filtered.length && (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <Icon name="search" size={24} className="mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">Tidak ada hasil{total ? "" : " (master kosong)"}.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
