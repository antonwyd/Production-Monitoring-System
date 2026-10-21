"use client";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import Icon from "@/components/Icon";
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
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-32 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Validasi laporan</h1>
        <p className="mt-1 text-sm text-slate-500">Periksa kiriman operator, lalu setujui atau tolak dengan alasan.</p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200/70 ring-inset sm:w-auto">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all sm:flex-none ${
                  on ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
                <span
                  className={`num min-w-5 rounded-full px-1.5 text-xs font-semibold ${
                    on ? (t.key === "pending" && counts[t.key] > 0 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700") : "bg-slate-200/70 text-slate-500"
                  }`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <label className="relative min-w-0 flex-1 sm:max-w-[200px]">
            <span className="sr-only">Filter tanggal</span>
            <input type="date" className="input py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {date && (
            <button className="btn-ghost btn-sm" onClick={() => setDate("")}>
              <Icon name="x" size={14} />
              Semua tanggal
            </button>
          )}
        </div>
      </div>

      {tab === "pending" && okItems.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-xs">
          <label className="flex cursor-pointer items-center gap-3 font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={selected.size === okItems.length}
              onChange={() => setSelected(selected.size === okItems.length ? new Set() : new Set(okItems.map((i) => i.id)))}
            />
            Pilih semua yang OK
          </label>
          <span className="num text-slate-500">
            {selected.size}/{okItems.length} dipilih
          </span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`mb-3 flex animate-fade-in items-start gap-2.5 rounded-lg border p-3 text-sm ${
            message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <Icon name={message.ok ? "checkCircle" : "alertCircle"} size={16} className="mt-0.5" />
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="-m-1 rounded p-1 opacity-60 hover:opacity-100" aria-label="Tutup">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <ul className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="card p-5">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-10 animate-pulse rounded bg-slate-50" />
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Icon name={tab === "pending" ? "checkCircle" : "inbox"} size={22} />
          </span>
          <p className="font-medium text-slate-900">{tab === "pending" ? "Semua sudah divalidasi" : "Tidak ada kiriman"}</p>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "pending" ? "Kiriman baru dari operator akan muncul di sini." : date ? "Coba pilih tanggal lain." : "Belum ada data di status ini."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const open = expanded.has(s.id);
            const flagged = s.needsCheck && s.status === "pending";
            const checked = selected.has(s.id);
            return (
              <li
                key={s.id}
                className={`card overflow-hidden transition-shadow ${flagged ? "border-amber-300" : ""} ${checked ? "border-brand-300 ring-2 ring-brand-100" : ""}`}
              >
                {flagged && (
                  <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 sm:px-5">
                    <Icon name="alert" size={14} />
                    Perlu dicek sebelum disetujui
                  </div>
                )}
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  {tab === "pending" && !s.needsCheck && (
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer"
                      checked={checked}
                      onChange={() => setSelected((x) => toggle(x, s.id))}
                      aria-label={`Pilih ${s.id}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-base font-semibold text-slate-900">{s.memberName}</span>
                      <span className="num text-sm text-slate-400">{s.memberNik}</span>
                      {s.status !== "pending" && <StatusBadge status={s.status} />}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {formatDateId(s.workDate)} · dikirim {formatDateTimeId(s.submittedAt)} · <span className="num">{s.id}</span>
                    </div>
                    <dl className="num mt-4 flex flex-wrap gap-x-6 gap-y-3 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70 ring-inset sm:gap-x-10">
                      <Stat label="Part" value={s.parts.length} />
                      <Stat label="Total qty" value={s.totals.qty.toLocaleString("id-ID")} />
                      <Stat label="Menit normal" value={s.totals.minNormal} />
                      <Stat label="Lost time" value={`${s.totals.lostMin} mnt`} />
                      <Stat label="OT" value={`${s.totals.minOt} mnt`} />
                    </dl>
                    {s.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-amber-800">
                        {s.warnings.map((w) => (
                          <li key={w} className="flex gap-2">
                            <Icon name="alert" size={14} className="mt-0.5 text-amber-500" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.status !== "pending" && (
                      <div className="mt-3 text-sm text-slate-500">
                        {s.status === "approved" ? "Disetujui" : "Ditolak"} oleh <span className="font-medium text-slate-700">{s.leaderName ?? "-"}</span> ·{" "}
                        {formatDateTimeId(s.decidedAt)}
                        {s.leaderNote && <div className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-red-700">Alasan: {s.leaderNote}</div>}
                      </div>
                    )}
                    <button
                      aria-expanded={open}
                      className="mt-3 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                      onClick={() => setExpanded((x) => toggle(x, s.id))}
                    >
                      {open ? "Sembunyikan detail" : "Lihat detail"}
                      <Icon name="chevronDown" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && <Detail s={s} />}
                  </div>
                </div>
                {s.status === "pending" && (
                  <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:justify-end sm:px-5">
                    <button className="btn-danger-soft btn-sm min-h-10 flex-1 sm:flex-none sm:px-4" disabled={busy} onClick={() => setRejecting(s)}>
                      <Icon name="x" size={15} />
                      Reject
                    </button>
                    <button className="btn-success btn-sm min-h-10 flex-1 sm:flex-none sm:px-4" disabled={busy} onClick={() => decide([s.id], "approve")}>
                      <Icon name="check" size={15} />
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
        <div className="fixed inset-x-0 bottom-0 z-40 animate-sheet-in border-t border-slate-200 bg-white/95 shadow-bar backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <span className="num hidden flex-1 text-sm text-slate-600 sm:block">
              <span className="font-semibold text-slate-900">{selected.size}</span> kiriman dipilih
            </span>
            <button className="btn-success h-12 w-full sm:w-auto sm:px-6" disabled={busy} onClick={() => decide([...selected], "approve", "", true)}>
              <Icon name="check" size={16} />
              {busy ? "Memproses…" : `Approve ${selected.size} kiriman`}
            </button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="rej-title" className="w-full max-w-md animate-sheet-in rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <Icon name="alertCircle" size={20} />
              </span>
              <div>
                <h2 id="rej-title" className="text-lg font-semibold tracking-tight">
                  Reject laporan {rejecting.memberName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatDateId(rejecting.workDate)} · {rejecting.id}. Alasan akan terlihat oleh operator.
                </p>
              </div>
            </div>
            <label className="label" htmlFor="rej-reason">
              Alasan reject <span className="text-red-600">*</span>
            </label>
            <textarea
              id="rej-reason"
              className="input min-h-28 resize-y"
              placeholder="Contoh: qty part 2 tidak sesuai dengan catatan line"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="mt-5 grid grid-cols-2 gap-2">
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
    <div className="min-w-0">
      <dt className="text-xs whitespace-nowrap text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold whitespace-nowrap text-slate-900">{value}</dd>
    </div>
  );
}

function Detail({ s }: { s: SubmissionView }) {
  return (
    <div className="mt-3 animate-fade-in space-y-3">
      {s.parts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="data-table min-w-[560px]">
            <thead className="text-left">
              <tr>
                <th>Kategori / Part</th>
                <th>MC</th>
                <th className="text-right">Qty (OT)</th>
                <th className="text-right">Menit (OT)</th>
                <th>Lot / Oiban</th>
                <th>NG</th>
              </tr>
            </thead>
            <tbody>
              {s.parts.map((p, i) => (
                <tr key={i} className="align-top">
                  <td>
                    <div className="font-medium text-slate-900">
                      {p.partName} {p.type}
                    </div>
                    <div className="text-xs text-slate-500">{p.categoryName}</div>
                  </td>
                  <td>{p.mcNo}</td>
                  <td className="text-right">
                    {p.qtyNormal.toLocaleString("id-ID")}
                    {p.qtyOt > 0 && <span className="text-slate-500"> ({p.qtyOt.toLocaleString("id-ID")})</span>}
                  </td>
                  <td className="text-right">
                    {p.minNormal}
                    {p.minOt > 0 && <span className="text-slate-500"> ({p.minOt})</span>}
                  </td>
                  <td>
                    {p.lot || "-"}
                    {p.oiban && <div className="text-xs text-slate-500">{p.oiban}</div>}
                  </td>
                  <td className="text-xs whitespace-normal">{p.ng.length ? p.ng.map((n) => `${n.label}: ${n.qty}`).join(", ") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.lostTimes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="data-table">
            <thead className="text-left">
              <tr>
                <th>Lost time / Another job</th>
                <th className="text-right">Menit</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {s.lostTimes.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.name} <span className="text-xs text-slate-500">({l.group === "ANOTHER_JOB" ? "Another job" : "Lost time"})</span>
                  </td>
                  <td className="text-right">{l.minutes}</td>
                  <td className="whitespace-normal">{l.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
