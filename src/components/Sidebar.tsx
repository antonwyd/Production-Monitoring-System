"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type NavItem = { key: string; href: string; label: string; icon: string; external?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

// Ikon garis sederhana (24x24), tanpa library tambahan.
const ICONS: Record<string, string> = {
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

export default function Sidebar({ groups, active, user }: { groups: NavGroup[]; active: string; user: { name: string; role: string } }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.title && <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>}
          {g.items.map((it) => {
            const on = it.key === active;
            const cls = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${on ? "bg-brand-600 font-semibold text-white shadow-lg shadow-black/20" : "font-medium text-slate-300 hover:bg-white/5 hover:text-white"}`;
            return it.external ? (
              <a key={it.key} href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
                <Icon name={it.icon} />
                {it.label}
              </a>
            ) : (
              <Link key={it.key} href={it.href} className={cls} onClick={() => setOpen(false)}>
                <Icon name={it.icon} />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-600 ring-2 ring-brand-600">
        {user.name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 text-xs leading-tight">
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
    <Link href="/hari-ini" className="flex flex-col gap-1.5 px-5 pb-4 pt-5">
      <span className="w-fit rounded-lg bg-white px-2.5 py-1.5">
        <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-7 w-auto" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PT Takai Seiki Indonesia</span>
    </Link>
  );

  return (
    <>
      {/* Desktop: menu tetap di kiri */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#1d2430] lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* HP / tablet: bar atas + menu geser */}
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 bg-[#1d2430] px-3 py-2 text-white lg:hidden">
        <button aria-label="Buka menu" className="rounded-lg p-2 text-white hover:bg-white/10" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="rounded-md bg-white px-2 py-1">
          <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-6 w-auto" />
        </span>
        <span className="font-bold">Produksi &amp; QA</span>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#1d2430] shadow-xl">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
