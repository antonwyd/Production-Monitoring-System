"use client";
import { useState } from "react";
import { ymLabel, type PartPoint } from "@/lib/forecast";
import { Modal } from "./ForecastUpload";

type Line = { part: string; forecast: string; actual: string };
const toNum = (s: string) => {
  const t = s.replace(/[.\s]/g, "").replace(",", ".");
  return t === "" ? null : Number(t);
};
const fmt = (v: number | null | undefined) => (v == null || v === 0 ? "" : Math.round(v).toLocaleString("id-ID"));

/** Input manual satu bulan: forecast & PO aktual per part. Bisa tempel dari Excel (Part · Forecast · PO). */
export default function ForecastManual({
  customers,
  defaultCustomer,
  month,
  parts,
  onClose,
  onSaved,
}: {
  customers: string[];
  defaultCustomer: string;
  month: string;
  parts: PartPoint[];
  onClose: () => void;
  onSaved: (customer: string, month: string) => void;
}) {
  const [customer, setCustomer] = useState(defaultCustomer || "PT NSK INDONESIA");
  const [bulan, setBulan] = useState(month);
  const init = (b: string): Line[] =>
    parts.length
      ? [...parts].sort((a, b2) => a.part.localeCompare(b2.part)).map((p) => (b === month ? { part: p.part, forecast: fmt(p.forecast), actual: fmt(p.actual) } : { part: p.part, forecast: "", actual: "" }))
      : Array.from({ length: 5 }, () => ({ part: "", forecast: "", actual: "" }));
  const [lines, setLines] = useState<Line[]>(() => init(month));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  function paste(e: React.ClipboardEvent, i: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const rows = text.trim().split(/\r?\n/).map((r) => r.split("\t"));
    setLines((ls) => {
      const out = [...ls];
      rows.forEach((cols, k) => {
        const [part, f, a] = cols.length >= 3 ? cols : [out[i + k]?.part ?? "", cols[0], cols[1] ?? ""];
        const at = out.findIndex((l) => l.part.replace(/\s+/g, " ").trim().toLowerCase() === String(part).replace(/\s+/g, " ").trim().toLowerCase());
        const line = { part: String(part).trim(), forecast: String(f ?? "").trim(), actual: String(a ?? "").trim() };
        if (at >= 0) out[at] = line;
        else out.push(line);
      });
      return out;
    });
  }

  const totF = lines.reduce((a, l) => a + (toNum(l.forecast) ?? 0), 0);
  const totA = lines.reduce((a, l) => a + (toNum(l.actual) ?? 0), 0);

  async function save() {
    setErr("");
    const bad = lines.find((l) => l.part.trim() && ([toNum(l.forecast), toNum(l.actual)].some((v) => v !== null && (!Number.isFinite(v) || v < 0))));
    if (bad) return setErr(`Angka untuk ${bad.part} tidak valid.`);
    const items = lines
      .filter((l) => l.part.trim() && (toNum(l.forecast) !== null || toNum(l.actual) !== null))
      .map((l) => ({ part: l.part.trim(), forecast: toNum(l.forecast), actual: toNum(l.actual), box: parts.find((p) => p.part === l.part)?.box || undefined }));
    if (!items.length) return setErr("Isi minimal satu part.");
    setBusy(true);
    const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manual", customer: customer.trim(), bulan, items }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(body.error ?? "Gagal menyimpan.");
    onSaved(customer.trim(), bulan);
  }

  return (
    <Modal title="Input manual forecast & PO" onClose={onClose} wide>
      <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fm-cust">
              Customer
            </label>
            <input id="fm-cust" className="input" list="fm-cust-list" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <datalist id="fm-cust-list">
              {customers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="fm-bln">
              Bulan
            </label>
            <input
              id="fm-bln"
              type="month"
              className="input"
              value={bulan}
              onChange={(e) => {
                if (!e.target.value) return;
                setBulan(e.target.value);
                setLines(init(e.target.value));
              }}
            />
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Isi <b>Forecast</b> (yang dulu diberikan customer untuk {ymLabel(bulan, true)}) dan <b>PO aktual</b> (yang benar-benar masuk). Kosongkan bila tidak tahu. Bisa tempel 3 kolom dari Excel: Part · Forecast · PO.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-1 text-left font-semibold">Part</th>
                <th className="w-36 pb-1 text-right font-semibold">Forecast (pcs)</th>
                <th className="w-36 pb-1 text-right font-semibold">PO aktual (pcs)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input className="input h-9 py-1 text-sm" value={l.part} placeholder="Nama part" onChange={(e) => set(i, "part", e.target.value)} onPaste={(e) => paste(e, i)} />
                  </td>
                  <td className="py-1 pr-2">
                    <input className="input h-9 py-1 text-right text-sm tabular-nums" inputMode="numeric" value={l.forecast} onChange={(e) => set(i, "forecast", e.target.value)} onPaste={(e) => paste(e, i)} />
                  </td>
                  <td className="py-1">
                    <input className="input h-9 py-1 text-right text-sm tabular-nums" inputMode="numeric" value={l.actual} onChange={(e) => set(i, "actual", e.target.value)} onPaste={(e) => paste(e, i)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold tabular-nums">
                <td className="pt-2">
                  <button className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => setLines((ls) => [...ls, { part: "", forecast: "", actual: "" }])}>
                    + Tambah part
                  </button>
                </td>
                <td className="pt-2 text-right">{totF.toLocaleString("id-ID")}</td>
                <td className="pt-2 text-right">{totA.toLocaleString("id-ID")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || !customer.trim()}>
          {busy && <span className="spinner" />}
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </Modal>
  );
}
