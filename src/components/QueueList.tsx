"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueCard } from "@/lib/views";
import { Toast, type ToastKind } from "./Motion";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function QueueList({ cards, canDecide }: { cards: QueueCard[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState<{ kind: ToastKind; title: string; text?: string } | null>(null);
  const complete = cards.filter((c) => !c.warnings.length);

  async function decide(ids: string[], action: "ok" | "no", note = "") {
    setBusy(true);
    setBusyId(ids.length === 1 ? ids[0] : "*");
    setMsg("");
    try {
      const r = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memproses.");
      const fails = (j.errors as string[] | undefined) ?? [];
      if (fails.length) setToast({ kind: "warn", title: "Sebagian gagal", text: fails.join("; ") });
      else setToast(action === "ok" ? { kind: "ok", title: "Berhasil disetujui", text: `${j.ok} laporan masuk ke sheet.` } : { kind: "info", title: "Laporan ditolak", text: "Member akan melihat alasannya." });
      router.refresh();
    } catch (e) {
      setToast({ kind: "err", title: "Gagal", text: e instanceof Error ? e.message : "Gagal memproses." });
    } finally {
      setBusy(false);
      setBusyId("");
    }
  }

  function reject(id: string) {
    const note = window.prompt("Alasan penolakan (akan dilihat member):");
    if (note === null) return;
    if (!note.trim()) return setMsg("Alasan penolakan wajib diisi.");
    decide([id], "no", note.trim());
  }

  return (
    <section className="card anim-in lift" style={{ animationDelay: ".26s" }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-bold">
          Menunggu validasi <span className="text-orange-700">({cards.length})</span>
        </h2>
        {canDecide && complete.length > 0 && (
          <button
            className="btn-primary ml-auto min-h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={() => window.confirm(`Setujui ${complete.length} laporan yang lengkap?`) && decide(complete.map((c) => c.id), "ok")}
          >
            {busyId === "*" && <span className="spinner" aria-hidden />}
            Setujui semua yang lengkap ({complete.length})
          </button>
        )}
        <a href="/?page=leader" className={`text-sm font-semibold text-brand-600 hover:underline ${canDecide && complete.length > 0 ? "" : "ml-auto"}`}>
          Lihat semua ›
        </a>
      </div>
      {msg && <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-sm">{msg}</div>}
      {cards.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-sm text-slate-500">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          Tidak ada laporan yang menunggu validasi.
        </div>
      )}
      {cards.map((c) => (
        <div key={c.id} className="flex flex-wrap transition-colors hover:bg-slate-50/70 items-center gap-x-5 gap-y-3 border-b border-slate-100 px-4 py-4 last:border-0 sm:px-5">
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="font-semibold">
              {c.member} <span className="text-xs font-normal text-slate-400">· kirim {c.sent}</span>
            </div>
            <div className="text-sm text-slate-500">{c.detail}</div>
            {c.warnings.map((w) => (
              <div key={w} className="mt-1.5 rounded-md bg-orange-50 px-2 py-1 text-sm font-medium text-orange-800">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-5 text-sm">
            <div>
              <div className="text-xs text-slate-500">Hasil</div>
              <div className="font-semibold tabular-nums">{n0(c.qty)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">NG</div>
              <div className="font-semibold tabular-nums">{n0(c.ng)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Menit</div>
              <div className="font-semibold tabular-nums">{n0(c.minutes)}</div>
            </div>
          </div>
          {canDecide && (
            <div className="grid w-full grid-cols-[2fr_1fr_1fr] gap-2 sm:flex sm:w-auto">
              <button className="btn min-h-11 bg-emerald-700 text-white hover:bg-emerald-800" disabled={busy} onClick={() => decide([c.id], "ok")}>
                {busyId === c.id && <span className="spinner" aria-hidden />}
                Setujui
              </button>
              <a className="btn-secondary min-h-11" href="/?page=leader" title="Edit di halaman validasi">
                Edit
              </a>
              <button className="btn-secondary min-h-11 text-orange-800" disabled={busy} onClick={() => reject(c.id)}>
                Tolak
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
