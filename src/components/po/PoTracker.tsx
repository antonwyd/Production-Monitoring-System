"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { byCustomer, PROCESSES, rowsOf, type PoRow, type PoState, type Process } from "@/lib/po";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d: string) => (d ? `${+d.slice(8, 10)} ${BULAN[+d.slice(5, 7) - 1]}` : "-");

const BADGE: Record<PoRow["level"], string> = {
  late: "bg-red-600 text-white",
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-50 text-emerald-700",
  done: "bg-slate-100 text-slate-500",
};
function sisaHari(r: PoRow) {
  if (r.status === "Dikirim") return "Dikirim";
  if (!r.open) return "Lengkap";
  const d = r.daysLeft;
  return d < 0 ? `lewat ${-d} hari` : d === 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi`;
}

const LS = "qa:po";
const recall = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "{}");
  } catch {
    return {};
  }
};
const remember = (v: Record<string, string>) => {
  try {
    localStorage.setItem(LS, JSON.stringify({ ...recall(), ...v }));
  } catch {}
};

type Act = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

export default function PoTracker({ initial, today, manage }: { initial: PoState; today: string; manage: boolean }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cust, setCust] = useState("");
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);

  const rows = useMemo(() => rowsOf(data.pos, today), [data.pos, today]);
  const sums = useMemo(() => byCustomer(rows), [rows]);
  const open = rows.filter((r) => r.status === "Open");
  const tot = (pr: Process) => ({ pcs: open.reduce((s, r) => s + r.proc[pr].short, 0), box: open.reduce((s, r) => s + r.proc[pr].shortBox, 0) });
  const urgent = rows.filter((r) => r.level === "late" || r.level === "urgent").length;
  const qq = q.trim().toLowerCase();
  const list = rows.filter((r) => (!cust || r.customer === cust) && (showDone || r.open) && (!qq || r.itemName.toLowerCase().includes(qq) || r.noPo.toLowerCase().includes(qq)));

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/po", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  // Realtime sederhana: muat ulang tiap 20 detik selama halaman terbuka.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && !busy && refresh(), 20_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [busy, refresh]);

  const act: Act = async (body, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: j.error ?? `Gagal (${r.status}).` });
        if (r.status === 409) refresh();
        return false;
      }
      setData(j);
      if (ok) setMsg({ ok: true, text: ok });
      return true;
    } catch {
      setMsg({ ok: false, text: "Tidak ada koneksi. Coba lagi." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-16 pt-5 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Pantau PO Customer</h1>
          <p className="text-sm text-slate-500">
            Tekan <b>+</b> setiap 1 box Seiretsu / Senbetsu selesai, sisa PO berkurang otomatis. Data per {data.asOf.slice(11, 16)}.
          </p>
        </div>
        <button className="btn-secondary h-10" onClick={refresh} disabled={busy}>
          Muat ulang
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi title="PO aktif" value={`${n0(open.reduce((s, r) => s + r.qty, 0))} pcs`} sub={`${open.length} PO`} />
        {PROCESSES.map((pr) => (
          <Kpi key={pr} title={`${pr} kurang`} value={`${n0(tot(pr).box)} box`} sub={`${n0(tot(pr).pcs)} pcs`} tone={tot(pr).pcs ? "red" : "green"} />
        ))}
        <Kpi title="Mendesak" value={String(urgent)} sub="delivery ≤ 2 hari belum lengkap" tone={urgent ? "red" : "green"} />
      </div>

      {manage && <AddPo data={data} today={today} busy={busy} act={act} />}

      {msg && (
        <div role="status" className={`rounded-lg border px-4 py-3 text-sm font-medium ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[{ customer: "" }, ...sums].map((c) => {
          const s = "short" in c ? c : null;
          return (
            <button key={c.customer || "all"} onClick={() => setCust(c.customer)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cust === c.customer ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
              {c.customer || "Semua"}
              {s && s.open > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${cust === c.customer ? "bg-white/20" : "bg-red-100 text-red-700"}`}>{s.open}</span>}
            </button>
          );
        })}
        <input className="input ml-auto h-9 w-44 py-1 text-sm" placeholder="Cari part / No PO" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Lengkap / dikirim
        </label>
      </div>

      {cust && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-100 px-4 py-2 text-sm">
          <b>{cust}</b>
          {PROCESSES.map((pr) => {
            const s = sums.find((x) => x.customer === cust)?.short[pr];
            return (
              <span key={pr} className={s?.pcs ? "font-semibold text-red-700" : "text-emerald-700"}>
                {pr}: {s?.pcs ? `kurang ${n0(s.box)} box (${n0(s.pcs)} pcs)` : "lengkap"}
              </span>
            );
          })}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_2.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Customer · Part</span>
          <span>Delivery</span>
          <span className="text-right">Qty PO</span>
          <span>Seiretsu</span>
          <span>Senbetsu</span>
          <span />
        </div>
        {list.length ? (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => (
              <PoLine key={r.id} r={r} manage={manage} busy={busy} act={act} />
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-slate-500">{rows.length ? "Tidak ada PO yang cocok." : "Belum ada PO."}</p>
        )}
      </div>
    </main>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: "red" | "green" }) {
  return (
    <div className="card flex flex-col gap-0.5 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
      <span className={`text-2xl font-bold tabular-nums ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : "text-slate-900"}`}>{value}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </div>
  );
}

// ---------- Input PO: seperti lembar PO customer, cukup isi qty ----------

function AddPo({ data, today, busy, act }: { data: PoState; today: string; busy: boolean; act: Act }) {
  const customers = useMemo(() => [...new Set(data.items.map((i) => i.customer))], [data.items]);
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState(customers[0] ?? "");
  const [due, setDue] = useState("");
  const [noPo, setNoPo] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  useEffect(() => {
    const r = recall();
    if (r.customer && customers.includes(r.customer)) setCustomer(r.customer);
  }, [customers]);
  const items = data.items.filter((i) => i.customer === customer && i.active);
  const num = (v: string | undefined) => Number((v ?? "").replace(/[.,\s]/g, "")) || 0;
  const lines = items.filter((i) => num(qty[i.itemId]) > 0).map((i) => ({ i, pcs: num(qty[i.itemId]), box: i.pcsPerBox > 0 ? Math.ceil(num(qty[i.itemId]) / i.pcsPerBox) : 0 }));
  const totPcs = lines.reduce((s, l) => s + l.pcs, 0);
  const totBox = lines.reduce((s, l) => s + l.box, 0);
  const ready = lines.length > 0 && !!due;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const ok = await act(
      { action: "addPo", customer, due, noPo, lines: lines.map((l) => ({ itemId: l.i.itemId, qty: l.pcs })) },
      `PO ${noPo || ""} ${customer} tersimpan: ${lines.length} part, ${n0(totPcs)} pcs, ${n0(totBox)} box, delivery ${tgl(due)}.`,
    );
    if (ok) {
      setQty({});
      setNoPo("");
      setOpen(false);
    }
  }

  if (!open)
    return (
      <button className="btn-primary h-12 self-start px-5 text-base" onClick={() => setOpen(true)}>
        + Input PO baru
      </button>
    );

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Input PO baru</h2>
        <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800" onClick={() => setOpen(false)}>
          Tutup
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label>
          <span className="label">Customer</span>
          <select
            className="input"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setQty({});
              remember({ customer: e.target.value });
            }}
          >
            {customers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Delivery date</span>
          <input type="date" className="input" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          <span className="label">PO No.</span>
          <input className="input" value={noPo} onChange={(e) => setNoPo(e.target.value)} placeholder="opsional" />
        </label>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="hidden px-3 py-2 sm:table-cell">Item code</th>
              <th className="px-3 py-2">Item name</th>
              <th className="px-3 py-2 text-right">Qty (pcs)</th>
              <th className="px-3 py-2 text-right">Box</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => {
              const v = num(qty[i.itemId]);
              const box = i.pcsPerBox > 0 ? v / i.pcsPerBox : 0;
              return (
                <tr key={i.itemId} className={v > 0 ? "bg-brand-50/50" : ""}>
                  <td className="hidden px-3 py-1.5 text-xs text-slate-500 sm:table-cell">{i.itemId}</td>
                  <td className="px-3 py-1.5">
                    <div className="font-semibold">{i.itemName}</div>
                    <div className="text-xs text-slate-500">1 box = {n0(i.pcsPerBox)} pcs</div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      inputMode="numeric"
                      className="input ml-auto w-32 py-1.5 text-right tabular-nums"
                      aria-label={`Qty ${i.itemName}`}
                      value={qty[i.itemId] ?? ""}
                      onChange={(e) => setQty({ ...qty, [i.itemId]: e.target.value })}
                      onBlur={() => v > 0 && setQty({ ...qty, [i.itemId]: n0(v) })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {v > 0 ? (
                      <>
                        <b>{n0(Math.ceil(box))}</b>
                        {!Number.isInteger(box) && <div className="text-xs text-amber-700">tidak pas box ({box.toLocaleString("id-ID", { maximumFractionDigits: 2 })})</div>}
                      </>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Total: <b>{n0(totPcs)} pcs</b> · <b>{n0(totBox)} box</b> · {lines.length} part
        </span>
        {!due && lines.length > 0 && <span className="text-sm text-amber-700">Isi delivery date dulu.</span>}
        <button className="btn-primary ml-auto h-11 px-6" disabled={!ready || busy}>
          Simpan PO
        </button>
      </div>
    </form>
  );
}

// ---------- Baris PO ----------

function Counter({ r, pr, busy, act }: { r: PoRow; pr: Process; busy: boolean; act: Act }) {
  const p = r.proc[pr];
  const pct = r.qty > 0 ? Math.min(100, (p.done / r.qty) * 100) : 0;
  const dis = busy || r.status !== "Open";
  const add = (delta: number) => act({ action: "box", row: r.row, id: r.id, process: pr, delta });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-16 text-xs font-semibold text-slate-500 md:hidden">{pr}</span>
        <button type="button" className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 text-lg font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={dis || r.box[pr] <= 0} onClick={() => confirm(`Kurangi 1 box ${pr} ${r.itemName}?`) && add(-1)} aria-label={`Kurangi box ${pr}`}>
          −
        </button>
        <button
          type="button"
          className="min-w-[4.5rem] rounded-lg px-1 text-center tabular-nums hover:bg-slate-50 disabled:hover:bg-transparent"
          disabled={dis}
          title="Tambah banyak box sekaligus"
          onClick={() => {
            const v = Math.round(Number(prompt(`Tambah berapa box ${pr} untuk ${r.itemName}?`, "1")));
            if (v > 0) add(v);
          }}
        >
          <span className="text-lg font-bold">{n0(r.box[pr])}</span>
          <span className="text-xs text-slate-500"> / {n0(r.qtyBox)}</span>
        </button>
        <button type="button" className="h-9 w-11 shrink-0 rounded-lg bg-brand-600 text-xl font-bold text-white shadow-sm hover:bg-brand-700 active:scale-95 disabled:opacity-40" disabled={dis} onClick={() => add(1)} aria-label={`Tambah 1 box ${pr}`}>
          +
        </button>
      </div>
      <div className="h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-200 md:ml-0">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${p.short ? "text-red-700" : "text-emerald-600"}`}>{p.short ? `kurang ${n0(p.shortBox)} box · ${n0(p.short)} pcs` : "lengkap"}</span>
    </div>
  );
}

function PoLine({ r, manage, busy, act }: { r: PoRow; manage: boolean; busy: boolean; act: Act }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ qty: "", due: "", noPo: "", sei: "", sen: "" });
  const start = () => {
    setF({ qty: String(r.qty), due: r.due, noPo: r.noPo, sei: String(r.box.Seiretsu), sen: String(r.box.Senbetsu) });
    setEdit(true);
  };
  const num = (v: string) => Number(v.replace(/[.,\s]/g, ""));
  return (
    <li className={`px-4 py-3 ${r.open || r.status === "Open" ? "" : "bg-slate-50/60"}`}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_2.5rem] md:items-center">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r.customer}</div>
            <div className="text-base font-bold text-slate-900">{r.itemName}</div>
            <div className="truncate text-xs text-slate-500">
              {r.noPo ? `PO ${r.noPo} · ` : ""}1 box = {n0(r.pcsPerBox)} pcs
            </div>
          </div>
          <div className="text-right md:hidden">
            <div className="font-semibold">{tgl(r.due)}</div>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.level]}`}>{sisaHari(r)}</span>
          </div>
        </div>
        <div className="hidden md:block">
          <div className="font-semibold">{tgl(r.due)}</div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.level]}`}>{sisaHari(r)}</span>
        </div>
        <div className="text-sm tabular-nums md:text-right">
          <span className="text-xs text-slate-500 md:hidden">Qty PO: </span>
          <b>{n0(r.qtyBox)} box</b>
          <span className="text-xs text-slate-500 md:hidden"> · </span><div className="inline text-xs text-slate-500 md:block">{n0(r.qty)} pcs</div>
        </div>
        {PROCESSES.map((pr) => (
          <Counter key={pr} r={r} pr={pr} busy={busy} act={act} />
        ))}
        <div className="text-right">
          {manage && (
            <button className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => (edit ? setEdit(false) : start())} aria-label="Ubah PO" title="Ubah PO">
              ⋯
            </button>
          )}
        </div>
      </div>
      {edit && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-amber-50 p-3 text-sm">
          <label>
            <span className="label">Qty PO (pcs)</span>
            <input inputMode="numeric" className="input w-32 py-1.5" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          </label>
          <label>
            <span className="label">Delivery</span>
            <input type="date" className="input py-1.5" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          </label>
          <label>
            <span className="label">No PO</span>
            <input className="input w-32 py-1.5" value={f.noPo} onChange={(e) => setF({ ...f, noPo: e.target.value })} />
          </label>
          <label>
            <span className="label">Box Seiretsu</span>
            <input inputMode="numeric" className="input w-20 py-1.5" value={f.sei} onChange={(e) => setF({ ...f, sei: e.target.value })} />
          </label>
          <label>
            <span className="label">Box Senbetsu</span>
            <input inputMode="numeric" className="input w-20 py-1.5" value={f.sen} onChange={(e) => setF({ ...f, sen: e.target.value })} />
          </label>
          <button
            className="btn-primary py-1.5"
            disabled={busy}
            onClick={async () => (await act({ action: "updatePo", row: r.row, id: r.id, qty: num(f.qty), due: f.due, noPo: f.noPo, box: { Seiretsu: num(f.sei), Senbetsu: num(f.sen) } }, "PO diperbarui.")) && setEdit(false)}
          >
            Simpan
          </button>
          {r.status === "Open" ? (
            <button className="btn-secondary py-1.5" disabled={busy} onClick={async () => (await act({ action: "updatePo", row: r.row, id: r.id, status: "Dikirim" }, `${r.itemName} ditandai sudah dikirim.`)) && setEdit(false)}>
              Sudah dikirim
            </button>
          ) : (
            <button className="btn-secondary py-1.5" disabled={busy} onClick={async () => (await act({ action: "updatePo", row: r.row, id: r.id, status: "Open" }, "PO dibuka lagi.")) && setEdit(false)}>
              Buka lagi
            </button>
          )}
          <button className="px-2 py-1.5 font-semibold text-red-600" disabled={busy} onClick={async () => confirm(`Hapus PO ${r.customer} ${r.itemName}?`) && (await act({ action: "updatePo", row: r.row, id: r.id, status: "Dihapus" }, "PO dihapus.")) && setEdit(false)}>
            Hapus
          </button>
        </div>
      )}
    </li>
  );
}
