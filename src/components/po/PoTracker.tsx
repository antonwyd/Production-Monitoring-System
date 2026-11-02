"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, monthEnd, monthStart } from "@/lib/dates";
import { dailyOutput, PROCESSES, rowsOf, type PoRow, type PoState, type Process } from "@/lib/po";
import { StatusDonut, TrendChart } from "./PoCharts";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d: string) => (d ? `${+d.slice(8, 10)} ${BULAN[+d.slice(5, 7) - 1]}` : "-");
const tglY = (d: string) => (d ? `${tgl(d)} ${d.slice(0, 4)}` : "-");

const PROC_COLOR: Record<Process, string> = { Seiretsu: "#16a34a", Senbetsu: "#2563eb", Washing: "#7c3aed" };
const STATE = {
  Selesai: { color: "#16a34a", cls: "bg-emerald-100 text-emerald-700" },
  "On Progress": { color: "#f59e0b", cls: "bg-amber-100 text-amber-700" },
  Kekurangan: { color: "#dc2626", cls: "bg-red-100 text-red-700" },
} as const;
type State = keyof typeof STATE;

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

/** Data + aksi bersama untuk dashboard dan halaman input per proses. */
function usePoData(initial: PoState) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
  return { data, busy, msg, setMsg, refresh, act };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm font-medium ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {msg.text}
    </div>
  );
}

function Ico({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const IC = {
  doc: "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 12h8M8 16h5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alert: "M12 3l10 18H2L12 3zM12 10v4M12 17h.01",
  dl: "M12 3v12M7 10l5 5 5-5M4 21h16",
};

function Kpi({ icon, tone, title, value, unit, sub }: { icon: string; tone: string; title: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>
        <Ico d={icon} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-600">{title}</div>
        <div className="text-2xl font-bold tabular-nums leading-tight">
          {value}
          {unit && <span className="ml-1 text-sm font-semibold text-slate-500">{unit}</span>}
        </div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

// =================== Dashboard ===================

export default function PoDashboard({ initial, today, manage }: { initial: PoState; today: string; manage: boolean }) {
  const { data, busy, msg, refresh, act } = usePoData(initial);
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(monthEnd(today));
  const [cust, setCust] = useState("");
  const [state, setState] = useState<"" | State | "Dikirim">("");
  const [proc, setProc] = useState<Process>("Washing");
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);

  const all = useMemo(() => rowsOf(data.pos, today), [data.pos, today]);
  const customers = useMemo(() => [...new Set([...data.items.map((i) => i.customer), ...all.map((r) => r.customer)])], [data.items, all]);
  const inPeriod = all.filter((r) => r.due >= from && r.due <= to && (!cust || r.customer === cust));
  const rows = inPeriod.filter((r) => !state || (state === "Dikirim" ? r.status === "Dikirim" : r.state === state));

  const target = rows.reduce((s, r) => s + r.qty, 0);
  const output = rows.reduce((s, r) => s + r.output, 0);
  const cnt = (st: State) => rows.filter((r) => r.state === st).length;
  const share = (k: number) => (rows.length ? pct(k / rows.length) : "-");

  const ids = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const trendTo = to < today ? to : today;
  const daily = useMemo(() => dailyOutput(data.log, from, trendTo >= from ? trendTo : from, ids), [data.log, from, trendTo, ids]);
  const workDays = Math.max(1, countWorkDays(from, to));
  const alerts = rows.filter((r) => r.state !== "Selesai").sort((a, b) => a.due.localeCompare(b.due) || b.short - a.short).slice(0, 5);
  const exportUrl = `/api/po/export?from=${from}&to=${to}&customer=${encodeURIComponent(cust)}&state=${encodeURIComponent(state)}`;

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-16 pt-5 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Production Monitoring System</div>
          <h1 className="text-2xl font-bold sm:text-3xl">Monitoring PO Customer</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Data per {data.asOf.slice(11, 16)}</span>
          <button className="btn-secondary h-10" onClick={refresh} disabled={busy}>
            Muat ulang
          </button>
          {manage && (
            <button className="btn-primary h-10" onClick={() => setAdding((v) => !v)}>
              + Input PO baru
            </button>
          )}
        </div>
      </div>

      {manage && adding && <AddPo data={data} today={today} busy={busy} act={act} onClose={() => setAdding(false)} />}
      <Msg msg={msg} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] lg:max-w-4xl">
        <label>
          <span className="label">Periode (tanggal delivery)</span>
          <div className="flex items-center gap-1">
            <input type="date" className="input py-2" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="Dari" />
            <span className="text-slate-400">–</span>
            <input type="date" className="input py-2" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="Sampai" />
          </div>
        </label>
        <label>
          <span className="label">Customer</span>
          <select className="input py-2" value={cust} onChange={(e) => setCust(e.target.value)}>
            <option value="">Semua Customer</option>
            {customers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Status PO</span>
          <select className="input py-2" value={state} onChange={(e) => setState(e.target.value as typeof state)}>
            <option value="">Semua Status</option>
            <option>Selesai</option>
            <option>On Progress</option>
            <option>Kekurangan</option>
            <option>Dikirim</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={IC.doc} tone="bg-blue-50 text-blue-600" title="Total PO" value={n0(rows.length)} sub="line item" />
        <Kpi icon={IC.target} tone="bg-blue-50 text-blue-600" title="Total Target" value={n0(target)} unit="pcs" sub={`${n0(rows.reduce((s, r) => s + r.qtyBox, 0))} box`} />
        <Kpi icon={IC.layers} tone="bg-emerald-50 text-emerald-600" title="Total Output" value={n0(output)} unit="pcs" sub={target ? pct(output / target) : "-"} />
        <Kpi icon={IC.check} tone="bg-emerald-50 text-emerald-600" title="Selesai" value={n0(cnt("Selesai"))} sub={share(cnt("Selesai"))} />
        <Kpi icon={IC.clock} tone="bg-amber-50 text-amber-600" title="On Progress" value={n0(cnt("On Progress"))} sub={share(cnt("On Progress"))} />
        <Kpi icon={IC.alert} tone="bg-red-50 text-red-600" title="Kekurangan" value={n0(cnt("Kekurangan"))} sub={share(cnt("Kekurangan"))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-lg font-bold">Progress Produksi per Proses</h2>
          {PROCESSES.map((pr) => {
            const done = rows.reduce((s, r) => s + r.proc[pr].done, 0);
            const p = target ? done / target : 0;
            return (
              <div key={pr} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold">{pr}</span>
                  <span className="tabular-nums text-slate-500">
                    {n0(done)} / {n0(target)}
                  </span>
                </div>
                <div className="relative h-7 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md" style={{ width: `${Math.min(100, p * 100)}%`, background: PROC_COLOR[pr] }} />
                  <span className={`absolute inset-y-0 flex items-center text-sm font-bold ${p > 0.2 ? "text-white" : "text-slate-700"}`} style={{ left: p > 0.2 ? `calc(${Math.min(100, p * 100)}% - 4rem)` : `calc(${p * 100}% + 0.5rem)` }}>
                    {pct(p)}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500">Total Output = proses paling sedikit (barang jadi harus lewat Seiretsu, Senbetsu dan Washing).</p>
        </section>

        <section className="card flex flex-col gap-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Tren Output Harian</h2>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {PROCESSES.map((pr) => (
                <button key={pr} onClick={() => setProc(pr)} className={`rounded-md px-2 py-1 ${proc === pr ? "bg-white shadow" : "text-slate-500"}`} style={proc === pr ? { color: PROC_COLOR[pr] } : undefined}>
                  {pr}
                </button>
              ))}
            </div>
          </div>
          <TrendChart data={daily.map((d) => ({ label: tgl(d.date), output: d[proc] }))} target={Math.round(target / workDays)} color={PROC_COLOR[proc]} />
          <p className="text-xs text-slate-500">
            Batang = output {proc} per hari (dari input box). Garis putus = target harian ({n0(Math.round(target / workDays))} pcs = total target ÷ {workDays} hari kerja).
          </p>
        </section>

        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-lg font-bold">Ringkasan Status</h2>
          <div className="flex flex-wrap items-center gap-4">
            <StatusDonut total={rows.length} parts={(Object.keys(STATE) as State[]).map((k) => ({ name: k, value: cnt(k), color: STATE[k].color }))} />
            <ul className="flex flex-col gap-2 text-sm">
              {(Object.keys(STATE) as State[]).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: STATE[k].color }} />
                  {k}: <b>{cnt(k)}</b> <span className="text-slate-500">({share(cnt(k))})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-4">
            <h2 className="text-lg font-bold">Monitoring PO Customer</h2>
            <a className="btn-secondary h-9 px-3 text-sm" href={exportUrl}>
              <Ico d={IC.dl} className="h-4 w-4" /> Export Excel
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th rowSpan={2} className="px-2 py-2 text-center">No</th>
                  <th rowSpan={2} className="px-2 py-2 text-left">Customer</th>
                  <th rowSpan={2} className="px-2 py-2 text-left">PO No.</th>
                  <th rowSpan={2} className="px-2 py-2 text-left">Part</th>
                  <th rowSpan={2} className="px-2 py-2 text-right">Qty PO (pcs)</th>
                  <th colSpan={3} className="border-b border-slate-200 px-2 pt-2 text-center">Output (pcs)</th>
                  <th rowSpan={2} className="px-2 py-2 text-right">Total Output</th>
                  <th rowSpan={2} className="px-2 py-2 text-center">Progress</th>
                  <th rowSpan={2} className="px-2 py-2 text-right">Kekurangan (pcs)</th>
                  <th rowSpan={2} className="px-2 py-2 text-center">Delivery</th>
                  <th rowSpan={2} className="px-2 py-2 text-center">Status</th>
                  {manage && <th rowSpan={2} />}
                </tr>
                <tr>
                  {PROCESSES.map((pr) => (
                    <th key={pr} className="px-2 pb-2 text-right font-semibold">
                      {pr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <PoTableRow key={r.id} r={r} i={i} manage={manage} busy={busy} act={act} editing={edit === r.id} setEdit={setEdit} />
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right">
                      Total
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{n0(target)}</td>
                    {PROCESSES.map((pr) => (
                      <td key={pr} className="px-2 py-2 text-right tabular-nums">
                        {n0(rows.reduce((s, r) => s + r.proc[pr].done, 0))}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums">{n0(output)}</td>
                    <td className="px-2 py-2 text-center">{target ? pct(output / target) : "-"}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-700">{n0(rows.reduce((s, r) => s + r.short, 0))}</td>
                    <td colSpan={manage ? 3 : 2} />
                  </tr>
                </tfoot>
              )}
            </table>
            {!rows.length && <p className="p-6 text-center text-sm text-slate-500">Tidak ada PO dengan delivery di periode ini.</p>}
          </div>
        </section>

        <section className="card flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Ico d={IC.alert} className="h-5 w-5 text-amber-500" /> Alert &amp; Tindak Lanjut
          </h2>
          {alerts.length ? (
            <ul className="divide-y divide-slate-100">
              {alerts.map((r) => (
                <li key={r.id} className="flex gap-3 py-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATE[r.state].color }} />
                  <div className="min-w-0 text-sm">
                    <div className="font-bold">
                      {r.itemName} <span className="font-semibold text-slate-500">({r.customer})</span>
                    </div>
                    {r.noPo && <div className="text-xs text-slate-500">PO {r.noPo}</div>}
                    <div>
                      Kekurangan <b className="text-red-700">{n0(r.short)} pcs</b> ({n0(r.shortBox)} box)
                    </div>
                    <div className="text-xs text-slate-500">
                      Delivery {tglY(r.due)} · {sisaHari(r)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-700">Tidak ada PO yang kurang di periode ini.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function countWorkDays(from: string, to: string) {
  let n = 0;
  for (let d = from; d <= to && n < 400; d = addDays(d, 1)) {
    const w = new Date(d + "T00:00:00Z").getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

function PoTableRow({ r, i, manage, busy, act, editing, setEdit }: { r: PoRow; i: number; manage: boolean; busy: boolean; act: Act; editing: boolean; setEdit: (id: string | null) => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const num = (v: string | undefined) => Number((v ?? "").replace(/[.,\s]/g, ""));
  const start = () => {
    setF({ qty: String(r.qty), due: r.due, noPo: r.noPo, Seiretsu: String(r.box.Seiretsu), Senbetsu: String(r.box.Senbetsu), Washing: String(r.box.Washing) });
    setEdit(r.id);
  };
  const tone = r.state === "Kekurangan" ? "bg-red-50/60" : "";
  return (
    <>
      <tr className={tone}>
        <td className="px-2 py-2 text-center text-slate-500">{i + 1}</td>
        <td className="px-2 py-2">{r.customer}</td>
        <td className="px-2 py-2">{r.noPo || "-"}</td>
        <td className="px-2 py-2 font-semibold">{r.itemName}</td>
        <td className="px-2 py-2 text-right tabular-nums">
          {n0(r.qty)}
          <div className="text-xs font-normal text-slate-500">{n0(r.qtyBox)} box</div>
        </td>
        {PROCESSES.map((pr) => (
          <td key={pr} className="px-2 py-2 text-right tabular-nums">
            {n0(r.proc[pr].done)}
            <div className="text-xs text-slate-500">{n0(r.box[pr])} box</div>
          </td>
        ))}
        <td className="px-2 py-2 text-right font-semibold tabular-nums">{n0(r.output)}</td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-20 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, r.progress * 100)}%` }} />
            </div>
            <span className="tabular-nums text-xs font-semibold">{pct(r.progress)}</span>
          </div>
        </td>
        <td className={`px-2 py-2 text-right font-semibold tabular-nums ${r.short ? "text-red-700" : "text-emerald-600"}`}>
          {n0(r.short)}
          {r.short > 0 && <div className="text-xs font-normal">{n0(r.shortBox)} box</div>}
        </td>
        <td className="px-2 py-2 text-center">
          <div className="font-semibold">{tgl(r.due)}</div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.level]}`}>{sisaHari(r)}</span>
        </td>
        <td className="px-2 py-2 text-center">
          <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "Dikirim" ? "bg-slate-100 text-slate-600" : STATE[r.state].cls}`}>{r.status === "Dikirim" ? "Dikirim" : r.state}</span>
        </td>
        {manage && (
          <td className="px-1 py-2 text-right">
            <button className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => (editing ? setEdit(null) : start())} aria-label="Ubah PO" title="Ubah PO">
              ⋯
            </button>
          </td>
        )}
      </tr>
      {editing && (
        <tr>
          <td colSpan={14} className="bg-amber-50 px-3 py-3">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>
                <span className="label">Qty PO (pcs)</span>
                <input inputMode="numeric" className="input w-32 py-1.5" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
              </label>
              <label>
                <span className="label">Delivery</span>
                <input type="date" className="input py-1.5" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
              </label>
              <label>
                <span className="label">PO No.</span>
                <input className="input w-32 py-1.5" value={f.noPo} onChange={(e) => setF({ ...f, noPo: e.target.value })} />
              </label>
              {PROCESSES.map((pr) => (
                <label key={pr}>
                  <span className="label">Box {pr}</span>
                  <input inputMode="numeric" className="input w-20 py-1.5" value={f[pr]} onChange={(e) => setF({ ...f, [pr]: e.target.value })} />
                </label>
              ))}
              <button
                className="btn-primary py-1.5"
                disabled={busy}
                onClick={async () =>
                  (await act({ action: "updatePo", row: r.row, id: r.id, qty: num(f.qty), due: f.due, noPo: f.noPo, box: Object.fromEntries(PROCESSES.map((pr) => [pr, num(f[pr])])) }, "PO diperbarui.")) && setEdit(null)
                }
              >
                Simpan
              </button>
              <button className="btn-secondary py-1.5" disabled={busy} onClick={async () => (await act({ action: "updatePo", row: r.row, id: r.id, status: r.status === "Open" ? "Dikirim" : "Open" }, r.status === "Open" ? `${r.itemName} ditandai sudah dikirim.` : "PO dibuka lagi.")) && setEdit(null)}>
                {r.status === "Open" ? "Sudah dikirim" : "Buka lagi"}
              </button>
              <button className="px-2 py-1.5 font-semibold text-red-600" disabled={busy} onClick={async () => confirm(`Hapus PO ${r.customer} ${r.itemName}?`) && (await act({ action: "updatePo", row: r.row, id: r.id, status: "Dihapus" }, "PO dihapus.")) && setEdit(null)}>
                Hapus
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// =================== Input Progress per proses ===================

export function PoInput({ initial, today, process, operator }: { initial: PoState; today: string; process: Process; operator: boolean }) {
  const { data, busy, msg, refresh, act } = usePoData(initial);
  const [cust, setCust] = useState("");
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const all = useMemo(() => rowsOf(data.pos, today).filter((r) => r.status === "Open"), [data.pos, today]);
  const customers = [...new Set(all.map((r) => r.customer))];
  const qq = q.trim().toLowerCase();
  const list = all
    .filter((r) => (!cust || r.customer === cust) && (showDone || r.proc[process].short > 0) && (!qq || r.itemName.toLowerCase().includes(qq) || r.noPo.toLowerCase().includes(qq)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.customer.localeCompare(b.customer));
  const shortBox = all.reduce((s, r) => s + r.proc[process].shortBox, 0);
  const todayBox = data.log.filter((l) => l.date === today && l.process === process).reduce((s, l) => s + l.box, 0);

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-16 pt-5 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Input Progress</div>
          <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: PROC_COLOR[process] }}>
            {process}
          </h1>
          <p className="text-sm text-slate-500">Tekan + setiap 1 box selesai. Sisa PO berkurang otomatis.</p>
        </div>
        <button className="btn-secondary h-10" onClick={refresh} disabled={busy}>
          Muat ulang
        </button>
      </div>
      {operator && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {PROCESSES.map((pr) => (
            <a key={pr} href={`/po?p=${pr}`} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold ${pr === process ? "bg-white shadow" : "text-slate-600"}`} style={pr === process ? { color: PROC_COLOR[pr] } : undefined}>
              {pr}
            </a>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={IC.alert} tone="bg-red-50 text-red-600" title={`${process} kurang`} value={n0(shortBox)} unit="box" />
        <Kpi icon={IC.check} tone="bg-emerald-50 text-emerald-600" title="Input hari ini" value={n0(todayBox)} unit="box" />
      </div>
      <Msg msg={msg} />
      <div className="flex flex-wrap items-center gap-2">
        {["", ...customers].map((c) => (
          <button key={c || "all"} onClick={() => setCust(c)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cust === c ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {c || "Semua"}
          </button>
        ))}
        <input className="input ml-auto h-9 w-44 py-1 text-sm" placeholder="Cari part / PO No." value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Tampilkan yang lengkap
        </label>
      </div>
      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {list.map((r) => (
          <InputLine key={r.id} r={r} pr={process} busy={busy} act={act} />
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-slate-500">{all.length ? `Semua PO sudah lengkap untuk ${process}.` : "Belum ada PO."}</li>}
      </ul>
    </main>
  );
}

function InputLine({ r, pr, busy, act }: { r: PoRow; pr: Process; busy: boolean; act: Act }) {
  const p = r.proc[pr];
  const add = (delta: number) => act({ action: "box", row: r.row, id: r.id, process: pr, delta }, `${pr} ${r.itemName}: ${delta > 0 ? "+" : ""}${delta} box. Sisa kurang ${n0(Math.max(0, p.shortBox - delta))} box.`);
  const pctDone = r.qty ? Math.min(100, (p.done / r.qty) * 100) : 0;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-[10rem] flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r.customer}</div>
        <div className="text-lg font-bold">{r.itemName}</div>
        <div className="text-xs text-slate-500">
          {r.noPo ? `PO ${r.noPo} · ` : ""}1 box = {n0(r.pcsPerBox)} pcs
        </div>
      </div>
      <div className="text-center">
        <div className="font-semibold">{tgl(r.due)}</div>
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.level]}`}>{sisaHari(r)}</span>
      </div>
      <div className="flex w-full flex-col gap-1 sm:w-auto">
        <div className="flex items-center gap-2">
          <button className="h-12 w-12 rounded-xl border border-slate-300 text-xl font-bold text-slate-600 disabled:opacity-40" disabled={busy || r.box[pr] <= 0} onClick={() => confirm(`Kurangi 1 box ${pr} ${r.itemName}?`) && add(-1)} aria-label="Kurangi 1 box">
            −
          </button>
          <button
            className="min-w-[5.5rem] rounded-lg px-1 text-center tabular-nums"
            disabled={busy}
            title="Tambah banyak box sekaligus"
            onClick={() => {
              const v = Math.round(Number(prompt(`Tambah berapa box ${pr} untuk ${r.itemName}?`, "1")));
              if (v > 0) add(v);
            }}
          >
            <span className="text-2xl font-bold">{n0(r.box[pr])}</span>
            <span className="text-sm text-slate-500"> / {n0(r.qtyBox)} box</span>
          </button>
          <button className="h-12 w-16 rounded-xl text-2xl font-bold text-white shadow active:scale-95 disabled:opacity-40" style={{ background: PROC_COLOR[pr] }} disabled={busy} onClick={() => add(1)} aria-label="Tambah 1 box">
            +
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full" style={{ width: `${pctDone}%`, background: PROC_COLOR[pr] }} />
        </div>
        <span className={`text-xs font-semibold ${p.short ? "text-red-700" : "text-emerald-600"}`}>{p.short ? `kurang ${n0(p.shortBox)} box · ${n0(p.short)} pcs` : "lengkap"}</span>
      </div>
    </li>
  );
}

// ---------- Input PO: seperti lembar PO customer, cukup isi qty ----------

function AddPo({ data, today, busy, act, onClose }: { data: PoState; today: string; busy: boolean; act: Act; onClose: () => void }) {
  const customers = useMemo(() => [...new Set(data.items.map((i) => i.customer))], [data.items]);
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
      onClose();
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Input PO baru</h2>
        <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800" onClick={onClose}>
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

