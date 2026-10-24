"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** "Data per 16:42 WIB" + Muat ulang: membaca ulang Google Sheet tanpa menunggu cache 1 menit habis. */
export default function DataStatus({ asOf, className = "" }: { asOf: number; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const time = new Date(asOf).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const loading = busy || pending;
  async function reload() {
    setBusy(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } finally {
      setBusy(false);
      start(() => router.refresh());
    }
  }
  return (
    <span className={`no-print inline-flex items-center gap-2 text-xs text-slate-500 ${className}`}>
      <span>Data per {time} WIB</span>
      <button type="button" onClick={reload} disabled={loading} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50">
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
        </svg>
        {loading ? "Memuat…" : "Muat ulang"}
      </button>
    </span>
  );
}
