"use client";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import type { SubmissionStatus, SubmissionView } from "@/lib/types";

const TABS: { key: SubmissionStatus; label: string }[] = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

type DecideResult = { id: string; ok: boolean; message?: string };

export default function LeaderQueue() {
  const [tab, setTab] = useState<SubmissionStatus>("pending");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<SubmissionView | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: tab });
    if (date) qs.set("date", date);
    const res = await fetch(`/api/queue?${qs}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setCounts(data.counts);
    }
    setSelected(new Set());
    setLoading(false);
  }, [tab, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(ids: string[], action: "approve" | "reject", note = "", bulk = false) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/queue/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, note, bulk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const results = data.results as DecideResult[];
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      setMessage({
        ok: failed.length === 0,
        text:
          `${ok} kiriman ${action === "approve" ? "disetujui" : "ditolak"}.` +
          (failed.length ? ` Gagal: ${failed.map((f) => `${f.id} (${f.message})`).join("; ")}` : ""),
      });
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Gagal memproses." });
    } finally {
      setBusy(false);
    }
  }

  const okItems = items.filter((i) => !i.needsCheck);
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  return (
    <div className="mx-auto max-w-4xl px-3 pb-28 pt-4">
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${tab === t.key ? "bg-white text-brand-700 shadow" : "text-slate-600"}`}
          >
            {t.label} <span className="ml-1 rounded-full bg-slate-100 px-2 text-xs">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="label">Filter tanggal</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date && (
          <button className="btn-secondary" onClick={() => setDate("")}>
            Semua tanggal
          </button>
        )}
        {tab === "pending" && okItems.length > 0 && (
          <button
            className="btn-secondary"
            onClick={() => setSelected(selected.size === okItems.length ? new Set() : new Set(okItems.map((i) => i.id)))}
          >
            {selected.size === okItems.length ? "Batal pilih" : `Pilih semua (OK) · ${okItems.length}`}
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-3 rounded-lg p-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message.text}</div>
      )}

      {loading ? (
        <p className="p-8 text-center text-slate-500">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="card p-8 text-center text-slate-500">Tidak ada kiriman.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const open = expanded.has(s.id);
            return (
              <li key={s.id} className={`card p-4 ${s.needsCheck && s.status === "pending" ? "border-amber-400 ring-1 ring-amber-200" : ""}`}>
                <div className="flex items-start gap-3">
                  {tab === "pending" && !s.needsCheck && (
                    <input
                      type="checkbox"
                      className="mt-1 h-6 w-6 accent-brand-600"
                      checked={selected.has(s.id)}
                      onChange={() => setSelected((x) => toggle(x, s.id))}
                      aria-label={`Pilih ${s.id}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold">{s.memberName}</span>
                      <span className="text-sm text-slate-500">{s.memberNik}</span>
                      {s.needsCheck && s.status === "pending" && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">⚠ Perlu dicek</span>
                      )}
                      {s.status !== "pending" && <StatusBadge status={s.status} />}
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatDateId(s.workDate)} · dikirim {formatDateTimeId(s.submittedAt)} · <span className="font-mono">{s.id}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                      <Stat label="Part" value={s.parts.length} />
                      <Stat label="Total qty" value={s.totals.qty.toLocaleString("id-ID")} />
                      <Stat label="Menit normal" value={s.totals.minNormal} />
                      <Stat label="Lost time" value={`${s.totals.lostMin} mnt`} />
                      <Stat label="OT" value={`${s.totals.minOt} mnt`} />
                    </div>
                    {s.warnings.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                        {s.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    )}
                    {s.status !== "pending" && (
                      <div className="mt-2 text-sm text-slate-600">
                        {s.status === "approved" ? "Disetujui" : "Ditolak"} oleh {s.leaderName ?? "-"} · {formatDateTimeId(s.decidedAt)}
                        {s.leaderNote && <div className="text-red-700">Alasan: {s.leaderNote}</div>}
                      </div>
                    )}
                    <button className="mt-2 text-sm font-semibold text-brand-700" onClick={() => setExpanded((x) => toggle(x, s.id))}>
                      {open ? "Sembunyikan detail ▴" : "Lihat detail ▾"}
                    </button>
                    {open && <Detail s={s} />}
                  </div>
                </div>
                {s.status === "pending" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-secondary border-red-300 text-red-700" disabled={busy} onClick={() => setRejecting(s)}>
                      Reject
                    </button>
                    <button className="btn-success" disabled={busy} onClick={() => decide([s.id], "approve")}>
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "pending" && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-lg">
          <div className="mx-auto max-w-4xl">
            <button className="btn-success w-full py-3.5 text-lg" disabled={busy} onClick={() => decide([...selected], "approve", "", true)}>
              {busy ? "Memproses…" : `Approve ${selected.size} kiriman`}
            </button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-lg font-bold">Reject laporan {rejecting.memberName}</h2>
            <p className="mb-3 text-sm text-slate-600">
              {formatDateId(rejecting.workDate)} · {rejecting.id}. Alasan akan terlihat oleh operator.
            </p>
            <textarea
              className="input min-h-28"
              placeholder="Alasan reject (wajib)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => setRejecting(null)} disabled={busy}>
                Batal
              </button>
              <button className="btn-danger" disabled={busy || !reason.trim()} onClick={() => decide([rejecting.id], "reject", reason)}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Detail({ s }: { s: SubmissionView }) {
  return (
    <div className="mt-2 space-y-3 overflow-x-auto">
      {s.parts.length > 0 && (
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="p-2">Kategori / Part</th>
              <th className="p-2">MC</th>
              <th className="p-2 text-right">Qty (OT)</th>
              <th className="p-2 text-right">Menit (OT)</th>
              <th className="p-2">Lot / Oiban</th>
              <th className="p-2">NG</th>
            </tr>
          </thead>
          <tbody>
            {s.parts.map((p, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="p-2">
                  <div className="font-medium">
                    {p.partName} {p.type}
                  </div>
                  <div className="text-xs text-slate-500">{p.categoryName}</div>
                </td>
                <td className="p-2">{p.mcNo}</td>
                <td className="p-2 text-right">
                  {p.qtyNormal.toLocaleString("id-ID")}
                  {p.qtyOt > 0 && <span className="text-slate-500"> ({p.qtyOt.toLocaleString("id-ID")})</span>}
                </td>
                <td className="p-2 text-right">
                  {p.minNormal}
                  {p.minOt > 0 && <span className="text-slate-500"> ({p.minOt})</span>}
                </td>
                <td className="p-2">
                  {p.lot || "-"}
                  {p.oiban && <div className="text-xs text-slate-500">{p.oiban}</div>}
                </td>
                <td className="p-2 text-xs">{p.ng.length ? p.ng.map((n) => `${n.label}: ${n.qty}`).join(", ") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {s.lostTimes.length > 0 && (
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="p-2">Lost time / Another job</th>
              <th className="p-2 text-right">Menit</th>
              <th className="p-2">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {s.lostTimes.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="p-2">
                  {l.name} <span className="text-xs text-slate-500">({l.group === "ANOTHER_JOB" ? "Another job" : "Lost time"})</span>
                </td>
                <td className="p-2 text-right">{l.minutes}</td>
                <td className="p-2">{l.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
