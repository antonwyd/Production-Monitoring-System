"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOTAL, ymLabel, type ParsedForecast } from "@/lib/forecast";

const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));

/** Dialog di atas halaman (portal ke body: induk halaman memakai animasi transform). */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`anim-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function ForecastUpload({
  customers,
  defaultCustomer,
  versions,
  onClose,
  onSaved,
}: {
  customers: string[];
  defaultCustomer: string;
  versions: string[];
  onClose: () => void;
  onSaved: (customer: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  const [err, setErr] = useState("");
  const [p, setP] = useState<ParsedForecast | null>(null);
  const [customer, setCustomer] = useState(defaultCustomer || customers.find((c) => /NSK INDONESIA/i.test(c)) || customers[0] || "PT NSK INDONESIA");
  const input = useRef<HTMLInputElement>(null);

  async function read(f: File, versi?: string) {
    setFile(f);
    setErr("");
    setBusy("read");
    const fd = new FormData();
    fd.append("file", f);
    if (versi) fd.append("versi", versi);
    const res = await fetch("/api/forecast/parse", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setP(null);
      return setErr(body.error ?? "File tidak bisa dibaca.");
    }
    setP(body as ParsedForecast);
  }

  async function save() {
    if (!p) return;
    setBusy("save");
    setErr("");
    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", versi: p.versi, customer: customer.trim(), rows: p.rows, daily: p.daily }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setErr(body.error ?? "Gagal menyimpan.");
    onSaved(customer.trim());
  }

  const exists = p && versions.includes(p.versi) && customer === defaultCustomer;
  const s = p?.summary;
  const pct = s?.actual != null && s.forecast ? s.actual / s.forecast - 1 : null;
  const counts = p ? p.months.reduce((a, m) => ((a[m.jenis] = (a[m.jenis] ?? 0) + 1), a), {} as Record<string, number>) : {};
  const topParts = p ? p.rows.filter((r) => r.part !== TOTAL && r.bulan === p.versi && (r.jenis === "Plan" || r.jenis === "Actual")).sort((a, b) => b.qty - a.qty).slice(0, 6) : [];

  return (
    <Modal title="Upload file forecast" onClose={onClose} wide={!!p}>
      <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
        {!p && (
          <>
            <label
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) read(f);
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-brand-600 bg-brand-50" : "border-slate-300 hover:border-brand-600 hover:bg-slate-50"}`}
            >
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M12 18v-6M9 15l3-3 3 3" />
              </svg>
              <span className="font-semibold">{busy === "read" ? "Membaca file…" : file ? file.name : "Pilih atau tarik file Excel ke sini"}</span>
              <span className="text-sm text-slate-500">File forecast customer (.xlsx), mis. &quot;11. TKI Nov 2026.xlsx&quot;</span>
              <input
                ref={input}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                }}
              />
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <b>Format yang dibaca:</b> sheet bulanan (No · Part · qty/box · kolom bulan dengan label <i>actual / plan / forecast</i>, kolom bulan ganda di kanan = forecast lama, baris &quot;plan&quot; di bawah total = forecast total dulu) dan sheet harian (Part · tanggal 1–31).{" "}
              <a className="font-semibold text-brand-600 underline" href={`/api/forecast/template.xlsx?c=${encodeURIComponent(defaultCustomer)}`}>
                Unduh template
              </a>
            </div>
          </>
        )}
        {busy === "read" && p && <p className="text-sm text-slate-500">Membaca ulang…</p>}
        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>}

        {p && s && (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
              <div>
                <b>{file?.name}</b> terbaca. Periksa ringkasan di bawah, lalu simpan.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="fc-cust">
                  Customer
                </label>
                <input id="fc-cust" className="input" list="fc-cust-list" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                <datalist id="fc-cust-list">
                  {customers.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor="fc-ver">
                  Versi file (bulan berjalan di file)
                </label>
                <input id="fc-ver" type="month" className="input" value={p.versi} onChange={(e) => e.target.value && file && read(file, e.target.value)} />
              </div>
            </div>
            {exists && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Versi {ymLabel(p.versi, true)} untuk {customer} sudah pernah di-upload. Menyimpan akan <b>menimpa</b> data versi itu.</div>}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-4">
              {[
                [`PO ${ymLabel(p.versi)}`, n0(s.actual), "pcs"],
                [`Forecast ${ymLabel(p.versi)}`, n0(s.forecast), pct == null ? "tidak ada" : `PO ${pct > 0 ? "+" : ""}${(pct * 100).toFixed(1).replace(".", ",")}%`],
                ["Part", String(s.parts), `${s.dailyDays} hari PO harian`],
                ["Rentang bulan", `${ymLabel(s.from)} – ${ymLabel(s.to)}`, `${counts.Actual ?? 0} actual · ${counts.Plan ?? 0} plan · ${counts.Forecast ?? 0} forecast`],
              ].map(([k, v, h]) => (
                <div key={k} className="bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="text-lg font-bold tabular-nums">{v}</div>
                  <div className="text-xs text-slate-500">{h}</div>
                </div>
              ))}
            </div>
            {p.warnings.length > 0 && (
              <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900">
                {p.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {topParts.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">PO terbesar {ymLabel(p.versi)}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {topParts.map((r) => (
                      <tr key={r.part} className="border-t border-slate-100">
                        <td className="py-1.5">{r.part}</td>
                        <td className="py-1.5 text-right tabular-nums">{n0(r.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
        {p && (
          <button className="btn-secondary mr-auto" onClick={() => (setP(null), setFile(null), setErr(""))} disabled={!!busy}>
            Ganti file
          </button>
        )}
        <button className="btn-secondary" onClick={onClose} disabled={busy === "save"}>
          Batal
        </button>
        <button className="btn-primary" onClick={save} disabled={!p || !customer.trim() || !!busy}>
          {busy === "save" && <span className="spinner" />}
          {busy === "save" ? "Menyimpan…" : "Simpan ke database"}
        </button>
      </div>
    </Modal>
  );
}
