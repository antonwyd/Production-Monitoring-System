"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { daysBetween, parsePoPaste, PROCESSES, shortFor, summarize, type CustItem, type Po, type PoRow, type PoState, type Process } from "@/lib/po";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d: string) => (d ? `${+d.slice(8, 10)} ${BULAN[+d.slice(5, 7) - 1]}` : "-");
const boxText = (pcs: number, per: number) => (per > 0 ? `${n0(Math.ceil(pcs / per))} box` : "-");

const LEVEL = {
  late: { label: "Terlambat", cls: "bg-red-600 text-white" },
  urgent: { label: "Mendesak", cls: "bg-red-100 text-red-700" },
  soon: { label: "Minggu ini", cls: "bg-amber-100 text-amber-800" },
  ok: { label: "Aman", cls: "bg-emerald-50 text-emerald-700" },
  done: { label: "Lengkap", cls: "bg-slate-100 text-slate-500" },
} as const;

function sisaHari(d: number) {
  if (d < 0) return `lewat ${-d} hari`;
  if (d === 0) return "hari ini";
  if (d === 1) return "besok";
  return `${d} hari lagi`;
}

type Tab = "kurang" | "input" | "po" | "riwayat";
type Msg = { ok: boolean; text: string } | null;

const LS = "qa:po";
function remember(): { process?: Process; customer?: string } {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "{}");
  } catch {
    return {};
  }
}
function save(v: { process?: Process; customer?: string }) {
  try {
    localStorage.setItem(LS, JSON.stringify({ ...remember(), ...v }));
  } catch {}
}

export default function PoTracker({ initial, today, user, manage }: { initial: PoState; today: string; user: string; manage: boolean }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>(manage ? "kurang" : "input");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const sum = useMemo(() => summarize(data, today), [data, today]);
  const customers = useMemo(() => [...new Set(data.items.map((i) => i.customer))], [data.items]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/po", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  // Realtime sederhana: muat ulang tiap 30 detik selama halaman terbuka.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !busy) refresh();
    }, 30_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [busy, refresh]);

  async function act(body: Record<string, unknown>, okText?: string): Promise<PoState | null> {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: j.error ?? `Gagal (${r.status}).` });
        return null;
      }
      setData(j);
      if (okText) setMsg({ ok: true, text: okText });
      return j as PoState;
    } catch {
      setMsg({ ok: false, text: "Tidak ada koneksi. Coba lagi." });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const tabs: { k: Tab; label: string }[] = [
    { k: "kurang", label: "Kekurangan" },
    { k: "input", label: "Input Box" },
    ...(manage ? [{ k: "po" as Tab, label: "Input PO" }] : []),
    { k: "riwayat", label: "Riwayat Box" },
  ];

  return (
    <main className="flex w-full flex-col gap-4 px-4 pb-16 pt-5 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Pantau PO Customer</h1>
          <p className="text-sm text-slate-500">Sisa PO berkurang otomatis setiap Seiretsu / Senbetsu input box. Data per {data.asOf.slice(11, 16)}.</p>
        </div>
        <button className="btn-secondary h-10" onClick={refresh} disabled={busy}>
          Muat ulang
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.k}
            role="tab"
            aria-selected={tab === t.k}
            onClick={() => {
              setTab(t.k);
              setMsg(null);
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.k ? "bg-white text-brand-600 shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div role="status" className={`rounded-lg border px-4 py-3 text-sm font-medium ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {tab === "kurang" && <Shortage sum={sum} />}
      {tab === "input" && <BoxInput data={data} sum={sum} customers={customers} today={today} user={user} manage={manage} busy={busy} act={act} />}
      {tab === "po" && manage && <PoInput data={data} sum={sum} customers={customers} today={today} busy={busy} act={act} />}
      {tab === "riwayat" && <History data={data} today={today} user={user} manage={manage} busy={busy} act={act} />}
    </main>
  );
}

// ---------------- Kekurangan ----------------

function Bar({ done, qty }: { done: number; qty: number }) {
  const p = qty > 0 ? Math.min(100, (done / qty) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function ShortCell({ r, pr }: { r: PoRow; pr: Process }) {
  const p = r.proc[pr];
  return (
    <td className="px-3 py-2 align-top">
      {p.short > 0 ? (
        <div className="font-bold tabular-nums text-red-700">
          {n0(p.short)} <span className="text-xs font-semibold">pcs</span>
          <div className="text-xs font-semibold text-red-600">{r.pcsPerBox > 0 ? `${n0(p.shortBox)} box` : "Pcs/Box kosong"}</div>
        </div>
      ) : (
        <div className="font-semibold text-emerald-600">Lengkap</div>
      )}
      <div className="mt-1 w-24">
        <Bar done={p.done} qty={r.qty} />
      </div>
    </td>
  );
}

function Shortage({ sum }: { sum: ReturnType<typeof summarize> }) {
  const [cust, setCust] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = sum.rows.filter((r) => r.status === "Open");
  const tot = (pr: Process) => ({ pcs: open.reduce((s, r) => s + r.proc[pr].short, 0), box: open.reduce((s, r) => s + r.proc[pr].shortBox, 0) });
  const urgent = sum.rows.filter((r) => r.level === "late" || r.level === "urgent").length;
  const list = sum.customers.filter((c) => !cust || c.customer === cust);

  if (!sum.rows.length)
    return (
      <div className="card p-8 text-center text-slate-500">
        Belum ada PO. {`Leader/admin bisa input di tab "Input PO".`}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi title="Total PO aktif" value={`${n0(open.reduce((s, r) => s + r.qty, 0))} pcs`} sub={`${open.length} baris PO`} />
        {PROCESSES.map((pr) => (
          <Kpi key={pr} title={`${pr} kurang`} value={`${n0(tot(pr).pcs)} pcs`} sub={`${n0(tot(pr).box)} box`} tone={tot(pr).pcs > 0 ? "red" : "green"} />
        ))}
        <Kpi title="Mendesak / terlambat" value={String(urgent)} sub="delivery ≤ 2 hari, belum lengkap" tone={urgent ? "red" : "green"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["", ...sum.customers.map((c) => c.customer)].map((c) => (
          <button key={c || "all"} onClick={() => setCust(c)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cust === c ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
            {c || "Semua customer"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Tampilkan yang lengkap / dikirim
        </label>
      </div>

      {list.map((c) => {
        const rows = c.rows.filter((r) => showDone || r.open);
        return (
          <section key={c.customer} className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-lg font-bold">{c.customer}</h2>
              {PROCESSES.map((pr) => (
                <span key={pr} className={`text-sm ${c.short[pr].pcs > 0 ? "font-semibold text-red-700" : "text-emerald-700"}`}>
                  {pr}: {c.short[pr].pcs > 0 ? `kurang ${n0(c.short[pr].pcs)} pcs · ${n0(c.short[pr].box)} box` : "lengkap"}
                </span>
              ))}
              {c.nextDue && <span className="text-sm text-slate-600">Delivery terdekat {tgl(c.nextDue)}</span>}
            </div>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Part</th>
                      <th className="px-3 py-2">Delivery</th>
                      <th className="px-3 py-2 text-right">Qty PO</th>
                      {PROCESSES.map((pr) => (
                        <th key={pr} className="px-3 py-2">
                          {pr} kurang
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className={r.open ? "" : "text-slate-400"}>
                        <td className="px-3 py-2 align-top">
                          <div className="font-semibold text-slate-900">{r.itemName}</div>
                          <div className="text-xs text-slate-500">
                            {r.itemId}
                            {r.noPo && ` · PO ${r.noPo}`}
                            {r.status !== "Open" && ` · ${r.status}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-semibold">{tgl(r.due)}</div>
                          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[r.level].cls}`}>{r.open ? sisaHari(r.daysLeft) : LEVEL[r.level].label}</span>
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums">
                          <div className="font-semibold">{n0(r.qty)}</div>
                          <div className="text-xs text-slate-500">{boxText(r.qty, r.pcsPerBox)}</div>
                        </td>
                        {PROCESSES.map((pr) => (
                          <ShortCell key={pr} r={r} pr={pr} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-emerald-700">Semua PO customer ini sudah lengkap.</p>
            )}
          </section>
        );
      })}

      {sum.surplus.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Hasil box tanpa PO / lebih dari PO ({sum.surplus.length})</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {sum.surplus.map((x) => (
              <li key={`${x.customer}|${x.itemId}|${x.process}`}>
                {x.customer} · {x.itemName} · {x.process}: <b>{n0(x.pcs)} pcs</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: "red" | "green" }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
      <span className={`text-2xl font-bold tabular-nums ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : "text-slate-900"}`}>{value}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </div>
  );
}

// ---------------- Input Box ----------------

type ActFn = (body: Record<string, unknown>, okText?: string) => Promise<PoState | null>;

function itemsSorted(items: CustItem[], customer: string, sum: ReturnType<typeof summarize>, process: Process) {
  return items
    .filter((i) => i.customer === customer && i.active)
    .map((i) => ({ i, s: shortFor(sum, i.customer, i.itemId, process) }))
    .sort((a, b) => (b.s.pcs > 0 ? 1 : 0) - (a.s.pcs > 0 ? 1 : 0) || (a.s.next?.due ?? "9").localeCompare(b.s.next?.due ?? "9") || a.i.itemName.localeCompare(b.i.itemName));
}

function BoxInput({ data, sum, customers, today, user, manage, busy, act }: { data: PoState; sum: ReturnType<typeof summarize>; customers: string[]; today: string; user: string; manage: boolean; busy: boolean; act: ActFn }) {
  const [process, setProcess] = useState<Process>("Seiretsu");
  const [customer, setCustomer] = useState(customers[0] ?? "");
  const [itemId, setItemId] = useState("");
  const [box, setBox] = useState(1);
  const [extra, setExtra] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [okText, alertOk] = useState("");

  useEffect(() => {
    const r = remember();
    if (r.process && PROCESSES.includes(r.process)) setProcess(r.process);
    if (r.customer && customers.includes(r.customer)) setCustomer(r.customer);
  }, [customers]);

  const list = itemsSorted(data.items, customer, sum, process);
  const item = list.find((x) => x.i.itemId === itemId)?.i;
  const cur = item ? shortFor(sum, item.customer, item.itemId, process) : null;
  const pcs = item ? box * item.pcsPerBox + extra : 0;
  const mine = data.entries.filter((e) => e.date === today && e.by === user).slice(-8).reverse();

  async function submit() {
    if (!item) return;
    const st = await act({ action: "addBox", process, customer, itemId: item.itemId, box, extra, date, note });
    if (!st) return;
    const after = shortFor(summarize(st, today), item.customer, item.itemId, process);
    const text = `Tersimpan: ${process} ${item.itemName} +${n0(box)} box (${n0(pcs)} pcs). ${after.pcs > 0 ? `Sisa kurang ${n0(after.pcs)} pcs · ${n0(after.box)} box.` : "PO untuk part ini sudah lengkap."}`;
    alertOk(text);
    setBox(1);
    setExtra(0);
    setNote("");
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <section className="card flex flex-col gap-4 p-5">
        <div>
          <span className="label">Proses</span>
          <div className="grid grid-cols-2 gap-2">
            {PROCESSES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProcess(p);
                  save({ process: p });
                }}
                className={`rounded-xl border-2 px-4 py-3 text-base font-bold transition ${process === p ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="label">Customer</span>
          <select
            className="input"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setItemId("");
              save({ customer: e.target.value });
            }}
          >
            {customers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Part</span>
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Pilih part…</option>
            {list.map(({ i, s }) => (
              <option key={i.itemId} value={i.itemId}>
                {i.itemName} {s.pcs > 0 ? `· kurang ${n0(s.box)} box` : "· tidak ada kekurangan"}
              </option>
            ))}
          </select>
        </label>
        {item && cur && (
          <div className={`rounded-lg px-3 py-2 text-sm ${cur.pcs > 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
            {cur.pcs > 0 ? (
              <>
                {process} kurang <b>{n0(cur.pcs)} pcs · {n0(cur.box)} box</b>
                {cur.next && ` · delivery terdekat ${tgl(cur.next.due)} (${sisaHari(daysBetween(today, cur.next.due))})`}
              </>
            ) : (
              "Tidak ada PO terbuka yang kurang untuk part ini."
            )}
            <div className="text-xs opacity-80">1 box = {n0(item.pcsPerBox)} pcs</div>
          </div>
        )}
        <div>
          <span className="label">Jumlah box selesai</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary h-14 w-14 px-0 text-2xl" onClick={() => setBox((v) => Math.max(manage ? -99 : 0, v - 1))} aria-label="Kurangi box">
              −
            </button>
            <input inputMode="numeric" className="input h-14 w-24 text-center text-2xl font-bold tabular-nums" value={box} onChange={(e) => setBox(Math.round(Number(e.target.value.replace(/[^\d-]/g, "")) || 0))} aria-label="Jumlah box" />
            <button type="button" className="btn-secondary h-14 w-14 px-0 text-2xl" onClick={() => setBox((v) => v + 1)} aria-label="Tambah box">
              +
            </button>
            {item && <span className="ml-2 text-sm text-slate-600">= {n0(pcs)} pcs</span>}
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">Box tidak penuh / tanggal lain / catatan</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">Pcs tambahan</span>
              <input inputMode="numeric" className="input" value={extra || ""} placeholder="0" onChange={(e) => setExtra(Math.round(Number(e.target.value.replace(/[^\d-]/g, "")) || 0))} />
            </label>
            <label>
              <span className="label">Tanggal</span>
              <input type="date" className="input" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
            <label>
              <span className="label">Catatan</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </details>
        <button className="btn-primary h-14 text-lg" disabled={!item || busy || (box === 0 && extra === 0)} onClick={submit}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        {okText && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{okText}</div>}
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-bold">Input saya hari ini</h2>
        {mine.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {mine.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {e.process} · {e.itemName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {e.customer} · {e.time} · {n0(e.box)} box{e.extra ? ` + ${n0(e.extra)} pcs` : ""} = {n0(e.pcs)} pcs
                  </div>
                </div>
                <DeleteBox row={e.row} id={e.id} busy={busy} act={act} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada.</p>
        )}
      </section>
    </div>
  );
}

function DeleteBox({ row, id, busy, act }: { row: number; id: string; busy: boolean; act: ActFn }) {
  return (
    <button className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={() => confirm("Hapus input box ini?") && act({ action: "deleteBox", row, id }, "Input box dihapus.")}>
      Hapus
    </button>
  );
}

// ---------------- Input PO ----------------

type Line = { itemId: string; qty: string; unit: "pcs" | "box"; due: string };

function PoInput({ data, sum, customers, today, busy, act }: { data: PoState; sum: ReturnType<typeof summarize>; customers: string[]; today: string; busy: boolean; act: ActFn }) {
  const [customer, setCustomer] = useState(customers[0] ?? "");
  const [noPo, setNoPo] = useState("");
  const blank = (): Line => ({ itemId: "", qty: "", unit: "pcs", due: "" });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [paste, setPaste] = useState("");
  const [pasteErr, setPasteErr] = useState<string[]>([]);
  const items = data.items.filter((i) => i.customer === customer);
  const per = (id: string) => items.find((i) => i.itemId === id)?.pcsPerBox ?? 0;
  const pcsOf = (l: Line) => {
    const q = Number(l.qty.replace(/[.,\s]/g, "")) || 0;
    return l.unit === "box" ? q * per(l.itemId) : q;
  };
  const valid = lines.filter((l) => l.itemId && pcsOf(l) > 0 && l.due);
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function submit() {
    const st = await act(
      { action: "addPos", customer, noPo, lines: valid.map((l) => ({ itemId: l.itemId, qty: pcsOf(l), due: l.due })) },
      `${valid.length} baris PO ${customer} tersimpan (${n0(valid.reduce((s, l) => s + pcsOf(l), 0))} pcs).`,
    );
    if (st) {
      setLines([blank()]);
      setNoPo("");
    }
  }

  function readPaste() {
    const r = parsePoPaste(paste, data.items, customer, today);
    setPasteErr(r.errors);
    if (r.ok.length) {
      setLines([...lines.filter((l) => l.itemId), ...r.ok.map((d) => ({ itemId: d.itemId, qty: String(d.qty), unit: "pcs" as const, due: d.due }))]);
      setPaste("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg font-bold">PO baru</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Customer</span>
            <select
              className="input"
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setLines([blank()]);
              }}
            >
              {customers.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">No PO (opsional)</span>
            <input className="input" value={noPo} onChange={(e) => setNoPo(e.target.value)} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1 pr-2">Part</th>
                <th className="py-1 pr-2">Qty</th>
                <th className="py-1 pr-2">Tgl delivery</th>
                <th className="py-1 pr-2 text-right">= pcs / box</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <select className="input py-2" value={l.itemId} onChange={(e) => setLine(i, { itemId: e.target.value })}>
                      <option value="">Pilih part…</option>
                      {items.map((it) => (
                        <option key={it.itemId} value={it.itemId}>
                          {it.itemName} ({it.itemId})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <div className="flex gap-1">
                      <input inputMode="numeric" className="input w-32 py-2" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} placeholder="0" />
                      <select className="input w-20 py-2" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value as Line["unit"] })}>
                        <option value="pcs">pcs</option>
                        <option value="box">box</option>
                      </select>
                    </div>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="date" className="input py-2" value={l.due} onChange={(e) => setLine(i, { due: e.target.value })} />
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums text-slate-600">
                    {l.itemId && pcsOf(l) > 0 ? (
                      <>
                        {n0(pcsOf(l))} pcs
                        <div className="text-xs">{boxText(pcsOf(l), per(l.itemId))}</div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-1">
                    <button className="rounded px-2 py-1 text-slate-400 hover:text-red-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blank()]))} aria-label="Hapus baris">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setLines((ls) => [...ls, { ...blank(), due: ls[ls.length - 1]?.due ?? "" }])}>
            + Tambah baris
          </button>
          <button className="btn-primary ml-auto" disabled={!valid.length || busy} onClick={submit}>
            Simpan {valid.length ? `${valid.length} PO · ${n0(valid.reduce((s, l) => s + pcsOf(l), 0))} pcs` : "PO"}
          </button>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">Tempel dari Excel</summary>
          <p className="mt-2 text-slate-500">
            Satu baris per PO untuk customer {customer}: <b>Part | Qty pcs | Tgl delivery | No PO</b> (No PO boleh kosong). Qty bisa ditulis &quot;5 box&quot;. Tanggal: 2026-11-05, 05/11/2026 atau 5-Nov.
          </p>
          <textarea className="input mt-2 h-32 font-mono text-sm" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"627-J D1\t216000\t05/11/2026\n629-J D2\t10 box\t7-Nov"} />
          <button className="btn-secondary mt-2" disabled={!paste.trim()} onClick={readPaste}>
            Baca tempelan
          </button>
          {pasteErr.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700">
              {pasteErr.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </details>
      </section>

      <PoList data={data} sum={sum} busy={busy} act={act} />
    </div>
  );
}

function PoList({ data, sum, busy, act }: { data: PoState; sum: ReturnType<typeof summarize>; busy: boolean; act: ActFn }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ qty: "", due: "", status: "Open", noPo: "" });
  const [all, setAll] = useState(false);
  const rows = sum.rows.filter((r) => all || r.status === "Open").sort((a, b) => a.customer.localeCompare(b.customer) || a.due.localeCompare(b.due));
  const batal = data.pos.filter((p) => p.status === "Batal");

  function start(p: Po) {
    setEdit(p.id);
    setForm({ qty: String(p.qty), due: p.due, status: p.status, noPo: p.noPo });
  }

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Daftar PO</h2>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Termasuk Selesai{batal.length ? ` (+${batal.length} batal tidak ditampilkan)` : ""}
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1">Customer</th>
              <th className="px-2 py-1">Part</th>
              <th className="px-2 py-1">No PO</th>
              <th className="px-2 py-1 text-right">Qty pcs</th>
              <th className="px-2 py-1">Delivery</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) =>
              edit === r.id ? (
                <tr key={r.id} className="bg-amber-50">
                  <td className="px-2 py-1">{r.customer}</td>
                  <td className="px-2 py-1 font-semibold">{r.itemName}</td>
                  <td className="px-2 py-1">
                    <input className="input w-28 py-1" value={form.noPo} onChange={(e) => setForm({ ...form, noPo: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input inputMode="numeric" className="input w-28 py-1 text-right" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="date" className="input py-1" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <select className="input py-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="Open">Open</option>
                      <option value="Selesai">Selesai (dikirim)</option>
                      <option value="Batal">Batal</option>
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right">
                    <button
                      className="btn-primary px-3 py-1 text-sm"
                      disabled={busy}
                      onClick={async () => {
                        const st = await act({ action: "updatePo", row: r.row, id: r.id, qty: Number(form.qty.replace(/[.,\s]/g, "")), due: form.due, status: form.status, noPo: form.noPo }, "PO diperbarui.");
                        if (st) setEdit(null);
                      }}
                    >
                      Simpan
                    </button>
                    <button className="ml-1 px-2 py-1 text-sm text-slate-500" onClick={() => setEdit(null)}>
                      Batal
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="px-2 py-1.5">{r.customer}</td>
                  <td className="px-2 py-1.5 font-semibold">{r.itemName}</td>
                  <td className="px-2 py-1.5">{r.noPo || "-"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{n0(r.qty)}</td>
                  <td className="px-2 py-1.5">{tgl(r.due)}</td>
                  <td className="px-2 py-1.5">{r.status}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button className="px-2 py-1 text-sm font-semibold text-brand-600" onClick={() => start(r)}>
                      Ubah
                    </button>
                    <button className="px-2 py-1 text-sm font-semibold text-red-600" disabled={busy} onClick={() => confirm(`Hapus PO ${r.itemName} ${n0(r.qty)} pcs?`) && act({ action: "deletePo", row: r.row, id: r.id }, "PO dihapus.")}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {!rows.length && <p className="py-4 text-sm text-slate-500">Belum ada PO.</p>}
      </div>
    </section>
  );
}

// ---------------- Riwayat ----------------

function History({ data, today, user, manage, busy, act }: { data: PoState; today: string; user: string; manage: boolean; busy: boolean; act: ActFn }) {
  const [proc, setProc] = useState("");
  const [cust, setCust] = useState("");
  const [days, setDays] = useState(7);
  const from = useMemo(() => {
    const t = new Date(today + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - days + 1);
    return t.toISOString().slice(0, 10);
  }, [today, days]);
  const rows = data.entries
    .filter((e) => e.date >= from && (!proc || e.process === proc) && (!cust || e.customer === cust))
    .sort((a, b) => b.date.localeCompare(a.date) || b.row - a.row);
  const custs = [...new Set(data.entries.map((e) => e.customer))];
  const total = (pr: Process) => rows.filter((e) => e.process === pr).reduce((s, e) => s + e.pcs, 0);

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Hari ini</option>
          <option value={7}>7 hari</option>
          <option value={30}>30 hari</option>
          <option value={3650}>Semua</option>
        </select>
        <select className="input w-auto py-2" value={proc} onChange={(e) => setProc(e.target.value)}>
          <option value="">Semua proses</option>
          {PROCESSES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="input w-auto py-2" value={cust} onChange={(e) => setCust(e.target.value)}>
          <option value="">Semua customer</option>
          {custs.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-600">
          {PROCESSES.map((p) => `${p} ${n0(total(p))} pcs`).join(" · ")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1">Tanggal</th>
              <th className="px-2 py-1">Proses</th>
              <th className="px-2 py-1">Customer</th>
              <th className="px-2 py-1">Part</th>
              <th className="px-2 py-1 text-right">Box</th>
              <th className="px-2 py-1 text-right">Pcs</th>
              <th className="px-2 py-1">Oleh</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 300).map((e) => (
              <tr key={e.id}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {tgl(e.date)} {e.time}
                </td>
                <td className="px-2 py-1.5">{e.process}</td>
                <td className="px-2 py-1.5">{e.customer}</td>
                <td className="px-2 py-1.5 font-semibold">
                  {e.itemName}
                  {e.note && <div className="text-xs font-normal text-slate-500">{e.note}</div>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {n0(e.box)}
                  {e.extra ? ` +${n0(e.extra)}` : ""}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{n0(e.pcs)}</td>
                <td className="px-2 py-1.5">{e.by}</td>
                <td className="px-2 py-1.5 text-right">{(manage || (e.by === user && e.date === today)) && <DeleteBox row={e.row} id={e.id} busy={busy} act={act} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-4 text-sm text-slate-500">Belum ada input box di periode ini.</p>}
      </div>
    </section>
  );
}

