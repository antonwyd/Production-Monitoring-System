"use client";
import { useEffect, useRef, useState } from "react";

/** Angka KPI. Dulu dianimasikan dari 0; sekarang langsung tampil (design system: tanpa animasi dekoratif). */
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string; ms?: number }) {
  return (
    <span className="tabular-nums">
      {value.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export type ToastKind = "ok" | "warn" | "err" | "info";
const TOAST_STYLE: Record<ToastKind, { bg: string; icon: string; path: string }> = {
  ok: { bg: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "bg-emerald-600", path: "M5 12.5l4.5 4.5L19 7.5" },
  warn: { bg: "border-amber-200 bg-amber-50 text-amber-900", icon: "bg-amber-500", path: "M12 7v6M12 17h.01" },
  err: { bg: "border-rose-200 bg-rose-50 text-rose-900", icon: "bg-rose-600", path: "M7 7l10 10M17 7L7 17" },
  info: { bg: "border-slate-200 bg-white text-slate-800", icon: "bg-slate-500", path: "M12 8h.01M12 11v6" },
};

/** Notifikasi melayang di pojok bawah, hilang sendiri setelah beberapa detik. */
export function Toast({ kind, title, text, onClose }: { kind: ToastKind; title: string; text?: string; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    setLeaving(false);
    const t1 = setTimeout(() => setLeaving(true), 4300);
    const t2 = setTimeout(() => close.current(), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [title, text]);
  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => close.current(), 180);
  };
  const s = TOAST_STYLE[kind];
  return (
    <div className={`${leaving ? "anim-toast-out" : "anim-toast"} fixed bottom-24 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border p-4 shadow-xl lg:bottom-6 ${s.bg}`} role="status" aria-live="polite">
      <span className={`anim-pop flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${s.icon}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d={s.path} />
        </svg>
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">{title}</div>
        {text && <div className="opacity-80">{text}</div>}
      </div>
      <button onClick={dismiss} className="text-lg leading-none opacity-50 hover:opacity-100" aria-label="Tutup">
        ×
      </button>
    </div>
  );
}
