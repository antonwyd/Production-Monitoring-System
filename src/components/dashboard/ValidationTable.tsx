"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueCard } from "@/lib/views";
import { Toast, type ToastKind } from "../Motion";
import { ConfirmDialog } from "../QueueList";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Antrian validasi ringkas. Setujui/Tolak memakai /api/decide yang sama dengan halaman leader (cek peran di server). */
export default function ValidationTable({ cards, canDecide }: { cards: QueueCard[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ kind: ToastKind; title: string; text?: string } | null>(null);
  const [dlg, setDlg] = useState<{ id: string; who: string; action: "ok" | "no" } | null>(null);

  async function decide(id: string, action: "ok" | "no", note = "") {
    setBusy(id);
    try {
      const r = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id], action, note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memproses.");
      const fails = (j.errors as string[] | undefined) ?? [];
      if (fails.length) setToast({ kind: "warn", title: "Gagal", text: fails.join("; ") });
      else setToast(action === "ok" ? { kind: "ok", title: "Disetujui", text: "Laporan masuk ke sheet." } : { kind: "info", title: "Ditolak", text: "Member akan melihat alasannya." });
      router.refresh();
    } catch (e) {
      setToast({ kind: "err", title: "Gagal", text: e instanceof Error ? e.message : "Gagal memproses." });
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {dlg && (
        <ConfirmDialog
          danger={dlg.action === "no"}
          title={dlg.action === "no" ? "Tolak laporan ini?" : "Setujui laporan ini?"}
          text={dlg.who}
          okLabel={dlg.action === "no" ? "Tolak" : "Setujui"}
          inputLabel={dlg.action === "no" ? "Alasan penolakan (akan dilihat member)" : undefined}
          onCancel={() => setDlg(null)}
          onOk={(note) => {
            const d = dlg;
            setDlg(null);
            decide(d.id, d.action, note);
          }}
        />
      )}
      {cards.length === 0 ? (
        <div className="grid h-full min-h-32 place-items-center text-sm text-slate-500">Tidak ada laporan yang menunggu validasi.</div>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <th className="py-2 pl-4 pr-2 sm:pl-5">Kirim</th>
                <th className="px-2 py-2">Operator</th>
                <th className="px-2 py-2">Mesin</th>
                <th className="px-2 py-2">Proses</th>
                <th className="px-2 py-2 text-right">Hasil</th>
                <th className="py-2 pl-2 pr-4 text-right sm:pr-5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cards.slice(0, 6).map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="py-2.5 pl-4 pr-2 tabular-nums sm:pl-5">{c.sent}</td>
                  <td className="px-2 py-2.5 font-medium">
                    {c.member}
                    {c.warnings.length > 0 && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800" title={c.warnings.join("\n")}>
                        cek
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">{c.mcs.join(", ") || "-"}</td>
                  <td className="px-2 py-2.5">{c.procs.join(", ") || "-"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{n0(c.qty)}</td>
                  <td className="py-2 pl-2 pr-4 sm:pr-5">
                    <div className="flex justify-end gap-1.5">
                      <a href="/?page=leader" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Buka di halaman validasi">
                        Buka
                      </a>
                      {canDecide && (
                        <>
                          <button disabled={!!busy} onClick={() => setDlg({ id: c.id, who: c.member, action: "ok" })} className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                            {busy === c.id ? "…" : "Setujui"}
                          </button>
                          <button disabled={!!busy} onClick={() => setDlg({ id: c.id, who: c.member, action: "no" })} className="rounded-md border border-orange-200 px-2 py-1 text-xs font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50">
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
