"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type NavItem = { key: string; href: string; label: string; icon: string; external?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

// Ikon garis sederhana (24x24), tanpa library tambahan.
const ICONS: Record<string, string> = {
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  today: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15l2 2 4-4",
  report: "M3 3v18h18M7 15l4-4 3 3 5-6",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  quality: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  machine: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  check: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  data: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  lock: "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4",
  sheet: "M4 3h16v18H4zM4 9h16M4 15h16M10 3v18",
  dash: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  form: "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 12h8M8 16h5",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.report} />
    </svg>
  );
}

export const SB_KEY = "qa:sidebar";

export default function Sidebar({ groups, active, user }: { groups: NavGroup[]; active: string; user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  useEffect(() => {
    let v = false;
    try {
      v = localStorage.getItem(SB_KEY) === "mini";
    } catch {}
    document.documentElement.dataset.sb = v ? "mini" : "";
    setMini(v);
  }, []);
  function toggleMini() {
    const v = !mini;
    setMini(v);
    document.documentElement.dataset.sb = v ? "mini" : "";
    try {
      localStorage.setItem(SB_KEY, v ? "mini" : "");
    } catch {}
  }

  const nav = (
    <nav className="relative flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.title && <div className="sb-hide px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>}
          {g.items.map((it) => {
            const on = it.key === active;
            const cls = `sb-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98] ${on ? "bg-brand-600 font-semibold text-white shadow-lg shadow-black/20 before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-brand-100" : "font-medium text-slate-300 hover:translate-x-0.5 hover:bg-white/5 hover:text-white"}`;
            return it.external ? (
              <a key={it.key} href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls} title={it.label} aria-current={on ? "page" : undefined}>
                <Icon name={it.icon} />
                <span className="sb-hide truncate">{it.label}</span>
              </a>
            ) : (
              <Link key={it.key} href={it.href} className={cls} onClick={() => setOpen(false)} title={it.label} aria-current={on ? "page" : undefined}>
                <Icon name={it.icon} />
                <span className="sb-hide truncate">{it.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="sb-foot relative flex items-center gap-3 border-t border-white/10 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-600 ring-2 ring-brand-600">
        {user.name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()}
      </div>
      <div className="sb-hide min-w-0 flex-1 text-xs leading-tight">
        <div className="truncate text-sm font-semibold text-white">{user.name}</div>
        <div className="text-slate-400">{user.role}</div>
      </div>
      <button
        title="Keluar"
        aria-label="Keluar"
        className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
      >
        <Icon name="logout" />
      </button>
    </div>
  );

  const brand = (
    <Link href="/hari-ini" className="sb-brand relative flex items-center px-5 pb-5 pt-6">
      <img src="/logo-tki-dark.png" alt="PT. Takai Seiki Indonesia" className="h-auto w-full max-w-[11.5rem]" />
    </Link>
  );

  return (
    <>
      {/* Desktop: menu tetap di kiri */}
      <aside className="sb-desk no-print fixed inset-y-0 left-0 z-30 hidden w-[var(--sb-w)] flex-col bg-[#141d33] transition-[width] duration-200 ease-out lg:flex">
        {/* Foto bearing produk TKI di bawah menu, memudar ke warna sidebar. */}
        <div className="sb-hide pointer-events-none absolute inset-x-0 bottom-0 h-72" aria-hidden>
          <img src="/login-bearing-480.webp" alt="" className="h-full w-full object-cover opacity-50 grayscale-[25%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#141d33] via-[#141d33]/70 to-[#141d33]/85" />
        </div>
        <button
          onClick={toggleMini}
          aria-label={mini ? "Lebarkan menu" : "Lipat menu"}
          title={mini ? "Lebarkan menu" : "Lipat menu"}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:scale-110 hover:text-brand-600"
        >
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-200 ${mini ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {brand}
        {nav}
        {footer}
      </aside>

      {/* HP / tablet: bar atas + menu geser */}
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2 text-slate-900 backdrop-blur lg:hidden">
        <button aria-label="Buka menu" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-7 w-auto" />
        <span className="font-bold tracking-tight">QA Production</span>
      </header>
      {/* HP: menu bawah */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-slate-200 bg-white/95 px-2 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
        {[
          { key: "hari-ini", href: "/hari-ini", label: "Home", icon: "dash" },
          { key: "laporan", href: "/laporan", label: "Laporan", icon: "report" },
          null,
          { key: "report:ng-type", href: "/reports/ng-type", label: "Kualitas", icon: "quality" },
        ].map((it, i) =>
          it ? (
            <Link key={it.key} href={it.href} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors ${it.key === active ? "text-brand-600" : "text-slate-500"}`}>
              <Icon name={it.icon} />
              {it.label}
            </Link>
          ) : (
            <a key={i} href="/" aria-label="Form member" className="-mt-6 flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40 transition active:scale-95">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              Input
            </a>
          ),
        )}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-slate-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Lainnya
        </button>
      </nav>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 anim-toast" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#141d33] shadow-xl animate-[slide-in_.25s_ease-out]">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
