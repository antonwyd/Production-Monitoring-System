"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueCard } from "@/lib/views";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function QueueList({ cards, canDecide }: { cards: QueueCard[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const complete = cards.filter((c) => !c.warnings.length);

  async function decide(ids: string[], action: "ok" | "no", note = "") {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memproses.");
      const fails = (j.errors as string[] | undefined) ?? [];
      setMsg(fails.length ? `Sebagian gagal: ${fails.join("; ")}` : action === "ok" ? `${j.ok} laporan disetujui.` : "Laporan ditolak.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal memproses.");
    } finally {
      setBusy(false);
    }
  }

  function reject(id: string) {
    const note = window.prompt("Alasan penolakan (akan dilihat member):");
    if (note === null) return;
    if (!note.trim()) return setMsg("Alasan penolakan wajib diisi.");
    decide([id], "no", note.trim());
  }

  return (
    <section className="card">
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
            Setujui semua yang lengkap ({complete.length})
          </button>
        )}
      </div>
      {msg && <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-sm">{msg}</div>}
      {cards.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada laporan yang menunggu.</p>}
      {cards.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-slate-100 px-4 py-4 last:border-0 sm:px-5">
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
              <button className="btn min-h-11 bg-emerald-100 text-emerald-900 hover:bg-emerald-200" disabled={busy} onClick={() => decide([c.id], "ok")}>
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
