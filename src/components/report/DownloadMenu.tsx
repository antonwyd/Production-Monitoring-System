"use client";
import { useEffect, useRef, useState } from "react";

export type DownloadLink = { label: string; hint: string; href: string };

/** Satu tombol "Unduh" dengan pilihan Excel / PDF. */
export default function DownloadMenu({ links, className = "", compact = false }: { links: DownloadLink[]; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" className="btn-primary h-10 px-3 sm:px-4" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Unduh Excel atau PDF">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>Unduh</span>
      </button>
      {open && (
        <div role="menu" className="anim-fade absolute right-0 top-12 z-20 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {links.map((d) => (
            <a key={d.href} role="menuitem" href={d.href} target={d.href.includes(".pdf") ? "_blank" : undefined} rel="noreferrer" className="flex flex-col px-4 py-2.5 hover:bg-slate-50" onClick={() => setOpen(false)}>
              <span className="text-sm font-semibold">{d.label}</span>
              <span className="text-xs text-slate-500">{d.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
