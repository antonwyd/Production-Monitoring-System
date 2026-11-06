"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dayLabel, isOff, monthDays, normPart, toQty, ymLabel } from "@/lib/forecast";
import { CustomerSelect, Modal } from "./ForecastUpload";

type Info = { part: string; box: number; fc: number; fcMonth: number; poMonth: number };
type Bahan = { parts: Info[]; saved: Record<string, number>; fcDays: Record<string, Record<string, number>>; hasForecast: boolean; today: string };

const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("id-ID"));
const fmt = (v: number | null | undefined) => (v ? Math.round(v).toLocaleString("id-ID") : "");

async function loadBahan(customer: string, tanggal: string): Promise<Bahan> {
  const res = await fetch(`/api/forecast?c=${encodeURIComponent(customer)}&t=${tanggal}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Gagal memuat daftar part.");
  return body as Bahan;
}

function useBahan(customer: string, tanggal: string) {
  const [data, setData] = useState<Bahan | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!customer || !tanggal) return;
    let live = true;
    setLoading(true);
    setErr("");
    loadBahan(customer, tanggal)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [customer, tanggal]);
  return { data, err, loading };
}

/** Tempel blok dari Excel ke grid: mulai dari sel (row, col), isi ke kanan & ke bawah. */
function pasteBlock(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .replace(/\n$/, "")
    .split("\n")
    .map((l) => l.split("\t"));
}

// =====================================================================================
// Input actual PO satu tanggal kirim
// =====================================================================================
export function PoInput({ customers, defaultCustomer, defaultDate, onClose, onSaved }: { customers: string[]; defaultCustomer: string; defaultDate: string; onClose: () => void; onSaved: (customer: string, tanggal: string) => void }) {
  const [customer, setCustomer] = useState(defaultCustomer || customers.find((c) => /NSK INDONESIA/i.test(c)) || "");
  const [tanggal, setTanggal] = useState(defaultDate);
  const { data, err: loadErr, loading } = useBahan(customer, tanggal);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [onlyFc, setOnlyFc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!data) return;
    setVals(Object.fromEntries(Object.entries(data.saved).map(([p, v]) => [p, fmt(v)])));
    setExtra(Object.keys(data.saved).filter((p) => !data.parts.some((x) => x.part === p)));
  }, [data]);

  const rows: Info[] = useMemo(() => [...(data?.parts ?? []), ...extra.filter((p) => !data?.parts.some((x) => x.part === p)).map((p) => ({ part: p, box: 0, fc: 0, fcMonth: 0, poMonth: 0 }))], [data, extra]);
  const shown = rows.filter((r) => (!q || r.part.toLowerCase().includes(q.toLowerCase())) && (!onlyFc || r.fc > 0 || toQty(vals[r.part] ?? ""))).sort((a, b) => Number(b.fc > 0) - Number(a.fc > 0));
  const totPo = rows.reduce((a, r) => a + (toQty(vals[r.part] ?? "") || 0), 0);
  const totFc = rows.reduce((a, r) => a + r.fc, 0);
  const hasSaved = data && Object.keys(data.saved).length > 0;

  function paste(e: React.ClipboardEvent, idx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const block = pasteBlock(text);
    const next = { ...vals };
    const add: string[] = [];
    block.forEach((cols, k) => {
      if (cols.length >= 2) {
        // "Part<TAB>Qty": cocokkan nama part.
        const name = normPart(cols[0]);
        const hit = rows.find((r) => r.part.toLowerCase() === name.toLowerCase());
        const part = hit?.part ?? name;
        if (!part) return;
        if (!hit) add.push(part);
        next[part] = cols[cols.length - 1].trim();
      } else {
        const r = shown[idx + k];
        if (r) next[r.part] = cols[0].trim();
      }
    });
    setVals(next);
    if (add.length) setExtra((x) => [...x, ...add.filter((p) => !x.includes(p))]);
  }

  async function save() {
    setErr("");
    const bad = rows.find((r) => {
      const v = toQty(vals[r.part] ?? "");
      return v !== null && (Number.isNaN(v) || v < 0);
    });
    if (bad) return setErr(`Qty untuk ${bad.part} tidak valid.`);
    const items = rows.map((r) => ({ part: r.part, qty: toQty(vals[r.part] ?? "") || 0 })).filter((i) => i.qty > 0);
    if (!items.length && !hasSaved) return setErr("Isi qty PO minimal satu part.");
    if (!items.length && !confirm(`Kosongkan semua PO tanggal ${dayLabel(tanggal)}?`)) return;
    setBusy(true);
    const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "po", customer, tanggal, items }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(body.error ?? "Gagal menyimpan.");
    onSaved(customer, tanggal);
  }

  const shift = (n: number) => {
    const d = new Date(`${tanggal}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    setTanggal(d.toISOString().slice(0, 10));
  };

  return (
    <Modal title="Input actual PO" onClose={onClose} wide>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="label" htmlFor="po-cust">
              Customer
            </label>
            <CustomerSelect id="po-cust" value={customer} onChange={setCustomer} customers={customers} />
          </div>
          <div>
            <label className="label" htmlFor="po-date">
              Tanggal kirim
            </label>
            <div className="flex gap-1">
              <button type="button" className="btn-secondary px-3" onClick={() => shift(-1)} aria-label="Tanggal sebelumnya">
                ‹
              </button>
              <input id="po-date" type="date" className="input" value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
              <button type="button" className="btn-secondary px-3" onClick={() => shift(1)} aria-label="Tanggal berikutnya">
                ›
              </button>
            </div>
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          <b>{dayLabel(tanggal, true)} {tanggal.slice(0, 4)}</b> · PO yang turun hari ini diisi ke tanggal kirimnya (biasanya besok). Bisa tempel kolom qty atau &quot;Part + Qty&quot; dari Excel.
        </p>
        {hasSaved && <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">PO tanggal ini sudah pernah diisi. Angka di bawah = yang tersimpan; simpan untuk memperbarui.</div>}
        {data && !data.hasForecast && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Forecast {ymLabel(tanggal.slice(0, 7), true)} untuk customer ini belum ada. Daftar part diambil dari Master Customer.</div>}
        {(loadErr || err) && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadErr || err}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <input className="input h-10 flex-1 py-1" placeholder="Cari part…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyFc} onChange={(e) => setOnlyFc(e.target.checked)} className="accent-brand-600" /> Hanya yang ada forecast
          </label>
        </div>
        {loading && !data ? (
          <p className="py-8 text-center text-sm text-slate-500">Memuat daftar part…</p>
        ) : (
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Part</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="w-36 px-3 py-2 text-right">PO (pcs)</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => {
                  const v = toQty(vals[r.part] ?? "");
                  const diff = v !== null && !Number.isNaN(v) ? v - r.fc : null;
                  return (
                    <tr key={r.part} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{r.part}</div>
                        {r.box > 0 && <div className="text-[11px] text-slate-400">{n0(r.box)}/box</div>}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${r.fc ? "text-slate-700" : "text-slate-300"}`}>{r.fc ? n0(r.fc) : "–"}</td>
                      <td className="px-2 py-1">
                        <input
                          inputMode="numeric"
                          className="input h-9 w-full py-1 text-right tabular-nums"
                          value={vals[r.part] ?? ""}
                          placeholder="0"
                          onChange={(e) => setVals((x) => ({ ...x, [r.part]: e.target.value }))}
                          onPaste={(e) => paste(e, i)}
                          aria-label={`PO ${r.part}`}
                        />
                      </td>
                      <td className={`hidden px-3 py-1.5 text-right tabular-nums sm:table-cell ${diff == null ? "text-slate-300" : diff < 0 ? "text-red-700" : diff > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                        {diff == null ? "–" : `${diff > 0 ? "+" : ""}${n0(diff)}`}
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                      {customer ? "Tidak ada part." : "Pilih customer dulu."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <div className="mr-auto text-sm">
          <span className="text-slate-500">Total PO</span> <b className="tabular-nums">{n0(totPo)}</b>
          {totFc > 0 && (
            <span className={`ml-2 tabular-nums ${totPo < totFc ? "text-red-700" : "text-emerald-700"}`}>
              ({Math.round((totPo / totFc) * 100)}% dari forecast {n0(totFc)})
            </span>
          )}
        </div>
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || !customer || loading}>
          {busy && <span className="spinner" />}
          {busy ? "Menyimpan…" : "Simpan PO"}
        </button>
      </div>
    </Modal>
  );
}

// =====================================================================================
// Input forecast sebulan sekaligus (grid Part × tanggal, bisa tempel dari Excel)
// =====================================================================================
type GridRow = { part: string; box: string; days: string[] };

export function ForecastInput({ customers, defaultCustomer, defaultMonth, onClose, onSaved }: { customers: string[]; defaultCustomer: string; defaultMonth: string; onClose: () => void; onSaved: (customer: string, month: string) => void }) {
  const [customer, setCustomer] = useState(defaultCustomer || customers.find((c) => /NSK INDONESIA/i.test(c)) || "");
  const [month, setMonth] = useState(defaultMonth);
  const dates = useMemo(() => monthDays(month), [month]);
  const { data, err: loadErr, loading } = useBahan(customer, `${month}-01`);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = useCallback((n: number) => Array.from({ length: n }, () => ({ part: "", box: "", days: Array(dates.length).fill("") })), [dates.length]);
  useEffect(() => {
    if (!data) return;
    const list = data.parts.length ? data.parts : [];
    setRows([
      ...list.map((p) => ({ part: p.part, box: fmt(p.box), days: dates.map((t) => fmt(data.fcDays[p.part]?.[t])) })),
      ...blank(list.length ? 3 : 10),
    ]);
  }, [data, dates, blank]);

  const set = (i: number, col: number, v: string) =>
    setRows((rs) => rs.map((r, j) => (j !== i ? r : col === -2 ? { ...r, part: v } : col === -1 ? { ...r, box: v } : { ...r, days: r.days.map((d, k) => (k === col ? v : d)) })));

  /** Tempel blok Excel mulai sel (i, col). col -2 = kolom Part, -1 = Pcs/box, 0.. = tanggal. */
  function paste(e: React.ClipboardEvent, i: number, col: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const block = pasteBlock(text);
    setRows((rs) => {
      const out = rs.map((r) => ({ ...r, days: [...r.days] }));
      block.forEach((cells, k) => {
        while (out.length <= i + k) out.push(blank(1)[0]);
        const r = out[i + k];
        cells.forEach((v, c) => {
          const at = col + c;
          if (at === -2) r.part = v.trim();
          else if (at === -1) r.box = v.trim();
          else if (at >= 0 && at < dates.length) r.days[at] = v.trim();
        });
      });
      return out;
    });
  }

  const totals = rows.map((r) => r.days.reduce((a, d) => a + (toQty(d) || 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const dayTot = dates.map((_, k) => rows.reduce((a, r) => a + (toQty(r.days[k]) || 0), 0));

  async function save() {
    setErr("");
    const daily: { part: string; tanggal: string; qty: number; box?: number }[] = [];
    for (const r of rows) {
      const part = normPart(r.part);
      const hasNum = r.days.some((d) => d.trim() !== "");
      if (!part) {
        if (hasNum) return setErr("Ada baris berisi angka tapi nama part kosong.");
        continue;
      }
      const box = toQty(r.box);
      for (let k = 0; k < dates.length; k++) {
        const v = toQty(r.days[k]);
        if (v === null) continue;
        if (Number.isNaN(v) || v < 0) return setErr(`Angka ${part} tanggal ${k + 1} tidak valid.`);
        if (v > 0) daily.push({ part, tanggal: dates[k], qty: v, box: box && !Number.isNaN(box) ? box : undefined });
      }
    }
    if (!daily.length) return setErr("Isi forecast minimal satu part.");
    if (data?.hasForecast && !confirm(`Forecast ${ymLabel(month, true)} untuk ${customer} akan diganti dengan isian ini. Lanjut?`)) return;
    setBusy(true);
    const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "forecast", versi: month, customer, daily }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(body.error ?? "Gagal menyimpan.");
    onSaved(customer, month);
  }

  const base = "h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1 outline-none hover:border-slate-200 focus:border-brand-600 focus:bg-white";
  const cell = `${base} text-right tabular-nums`;
  return (
    <Modal title="Input forecast harian sebulan" onClose={onClose} wide>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div>
            <label className="label" htmlFor="fi-cust">
              Customer
            </label>
            <CustomerSelect id="fi-cust" value={customer} onChange={setCustomer} customers={customers} />
          </div>
          <div>
            <label className="label" htmlFor="fi-month">
              Bulan forecast
            </label>
            <input id="fi-month" type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          Cara cepat: di Excel blok nama part sampai tanggal terakhir, Copy, lalu klik sel <b>Part</b> baris pertama dan Paste. Bisa juga blok angka saja lalu paste di tanggal 1.
          {data?.hasForecast && " Forecast bulan ini sudah ada dan ditampilkan; simpan akan menggantinya."}
        </p>
        {(loadErr || err) && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadErr || err}</div>}
        {loading && !rows.length ? (
          <p className="py-8 text-center text-sm text-slate-500">Memuat…</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-xl ring-1 ring-slate-200">
            <table className="text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500">
                <tr>
                  <th className="sticky left-0 z-20 min-w-44 bg-slate-50 px-2 py-1.5 text-left">Part</th>
                  <th className="min-w-16 px-1 py-1.5 text-right">Pcs/box</th>
                  <th className="min-w-20 px-1 py-1.5 text-right">Total</th>
                  {dates.map((t) => (
                    <th key={t} className={`min-w-16 px-1 py-1.5 text-center ${isOff(t) ? "bg-slate-100 text-slate-400" : ""}`}>
                      {Number(t.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-1 py-0.5">
                      <input className={`${base} text-left font-medium`} value={r.part} placeholder={i === 0 ? "Paste di sini" : ""} onChange={(e) => set(i, -2, e.target.value)} onPaste={(e) => paste(e, i, -2)} aria-label={`Part baris ${i + 1}`} />
                    </td>
                    <td className="px-0.5 py-0.5">
                      <input className={cell} inputMode="numeric" value={r.box} onChange={(e) => set(i, -1, e.target.value)} onPaste={(e) => paste(e, i, -1)} aria-label={`Pcs/box baris ${i + 1}`} />
                    </td>
                    <td className="px-1 py-0.5 text-right font-semibold tabular-nums">{totals[i] ? n0(totals[i]) : ""}</td>
                    {dates.map((t, k) => (
                      <td key={t} className={`px-0.5 py-0.5 ${isOff(t) ? "bg-slate-50" : ""}`}>
                        <input className={cell} inputMode="numeric" value={r.days[k] ?? ""} onChange={(e) => set(i, k, e.target.value)} onPaste={(e) => paste(e, i, k)} aria-label={`${r.part || `baris ${i + 1}`} tanggal ${k + 1}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-slate-800 font-semibold text-white">
                <tr>
                  <td className="sticky left-0 bg-slate-800 px-2 py-1.5">Total</td>
                  <td />
                  <td className="px-1 py-1.5 text-right tabular-nums">{n0(grand)}</td>
                  {dayTot.map((v, k) => (
                    <td key={k} className="px-1 py-1.5 text-right tabular-nums">
                      {v ? (v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${Math.round(v / 1e3)}rb` : v) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <button type="button" className="self-start text-sm font-semibold text-brand-600 hover:underline" onClick={() => setRows((rs) => [...rs, ...blank(5)])}>
          + Tambah 5 baris
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <div className="mr-auto text-sm">
          <span className="text-slate-500">Total {ymLabel(month)}</span> <b className="tabular-nums">{n0(grand)}</b> pcs · {rows.filter((r, i) => normPart(r.part) && totals[i]).length} part
        </div>
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || !customer}>
          {busy && <span className="spinner" />}
          {busy ? "Menyimpan…" : "Simpan forecast"}
        </button>
      </div>
    </Modal>
  );
}
