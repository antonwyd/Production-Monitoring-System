"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildProducts,
  computePlan,
  dayProd,
  dayName,
  findProduct,
  finishText,
  normalEnd,
  parsePoText,
  productLabel,
  STEP_NAME,
  toClock,
  toMin,
  workDates,
  type PlanMaster,
  type PoLine,
  type Product,
  type StationResult,
  type StationSet,
} from "@/lib/overtime";
import type { SavedPlan } from "@/lib/sheets/overtime";

/** Isian halaman yang disimpan ke tab "Rencana Lembur" (JSON). */
type PlanData = {
  start: string;
  from: string;
  nDays: number;
  sat: boolean;
  target: string;
  sched: { start: string; breakAt: string; breakMin: number; routineMin: number };
  pool: number;
  senbetsu: boolean;
  lines: PoLine[];
  stations: Record<string, StationSet>;
};

const n0 = (v: number) => Math.round(v).toLocaleString("id-ID");
const n1 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const jamMenit = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h && m ? `${h} jam ${m} mnt` : h ? `${h} jam` : `${m} mnt`;
};
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

/** Jam sekarang di Jakarta dibulatkan ke atas per 30 menit. */
function nowSlot(): string {
  const t = new Date(Date.now() + 7 * 3600_000);
  const m = Math.ceil((t.getUTCHours() * 60 + t.getUTCMinutes()) / 30) * 30;
  return toClock(m);
}

function initial(master: PlanMaster, today: string): PlanData {
  const pfIron = master.machines["PF Iron Cage"] ?? 0;
  const ops = master.recent["PF Iron Cage#members"];
  return {
    start: today,
    from: nowSlot(),
    nDays: 2,
    sat: false,
    target: "14:00",
    sched: { start: "07:00", breakAt: "12:00", breakMin: 60, routineMin: 20 },
    pool: Math.round(master.recent["#pool"] ?? 28) || 28,
    senbetsu: true,
    lines: [],
    stations: { "iron:pf": { units: pfIron || null, members: ops ? Math.round(ops) : 0, otMin: 0 } },
  };
}

const STATUS: Record<StationResult["status"], { text: string; cls: string }> = {
  aman: { text: "Aman tanpa lembur", cls: "bg-emerald-100 text-emerald-800" },
  lembur: { text: "Perlu lembur", cls: "bg-amber-100 text-amber-800" },
  kurang: { text: "Tidak terkejar", cls: "bg-red-100 text-red-800" },
  penuh: { text: "PF penuh, sisa ke Seiretsu", cls: "bg-sky-100 text-sky-800" },
  kosong: { text: "Belum ada beban", cls: "bg-slate-100 text-slate-600" },
};

function Stepper({ value, onChange, min = 0, max, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number | null; label: string }) {
  const clamp = (v: number) => Math.max(min, max != null ? Math.min(max, v) : v);
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn-secondary h-10 w-10 px-0" onClick={() => onChange(clamp(value - 1))} aria-label={`Kurangi ${label}`}>
        −
      </button>
      <input inputMode="numeric" className="input h-10 w-16 px-1 text-center font-bold tabular-nums" value={value} onChange={(e) => onChange(clamp(Math.round(num(e.target.value))))} aria-label={label} />
      <button type="button" className="btn-secondary h-10 w-10 px-0" onClick={() => onChange(clamp(value + 1))} aria-label={`Tambah ${label}`}>
        +
      </button>
    </div>
  );
}

function Chips<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${o.v === value ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function OvertimePlanner({ master, saved, today, canSave }: { master: PlanMaster; saved: SavedPlan[]; today: string; canSave: boolean }) {
  const router = useRouter();
  const products = useMemo(() => buildProducts(master), [master]);
  const byKey = useMemo(() => new Map(products.map((p) => [p.key, p])), [products]);
  const [d, setD] = useState<PlanData>(() => initial(master, today));
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string; busy?: boolean }>({});
  const [pick, setPick] = useState("");
  const [paste, setPaste] = useState<string | null>(null);
  const [pasteInfo, setPasteInfo] = useState<string[]>([]);
  const [pasteDate, setPasteDate] = useState("");
  const set = (p: Partial<PlanData>) => setD((x) => ({ ...x, ...p }));
  const setStation = (key: string, p: Partial<StationSet>) => setD((x) => ({ ...x, stations: { ...x.stations, [key]: { ...(x.stations[key] ?? { units: null }), ...p } } }));

  const dates = useMemo(() => workDates(d.start, d.nDays, d.sat), [d.start, d.nDays, d.sat]);
  const schedule = useMemo(
    () => ({
      start: toMin(d.sched.start),
      breakAt: toMin(d.sched.breakAt),
      breakMin: d.sched.breakMin,
      routineMin: d.sched.routineMin,
      normalMin: master.normalMin,
      otMaxMin: master.otLimitHrs * 60,
      firstFrom: toMin(d.from),
    }),
    [d.sched, d.from, master.normalMin, master.otLimitHrs],
  );
  const target = toMin(d.target);
  const res = useMemo(
    () => computePlan({ dates, target, schedule, pool: d.pool, senbetsu: d.senbetsu, lines: d.lines, stations: d.stations }, products, master),
    [dates, target, schedule, d.pool, d.senbetsu, d.lines, d.stations, products, master],
  );
  const pulang = toClock(normalEnd(schedule));
  const fin = (f: StationResult["finish"]) => finishText(f, dates, d.sat);
  const otDayNames = (x: StationResult) => dates.slice(0, x.otDays).map((t) => (t === today ? "hari ini" : dayName(t)));

  // ---------- PO ----------
  function addLine(p: Product, qtys: Record<string, number>) {
    setD((x) => {
      const i = x.lines.findIndex((l) => l.key === p.key);
      if (i < 0) return { ...x, lines: [...x.lines, { key: p.key, qty: qtys }] };
      const lines = [...x.lines];
      const q = { ...lines[i].qty };
      for (const [k, v] of Object.entries(qtys)) q[k] = (q[k] ?? 0) + v;
      lines[i] = { ...lines[i], qty: q };
      return { ...x, lines };
    });
  }
  function addPicked() {
    const p = products.find((x) => optionLabel(x) === pick.trim()) ?? findProduct(products, pick.replace(/\s+(D\d)$/i, ""), pick.match(/\s(D\d)$/i)?.[1] ?? "");
    if (!p) {
      setPasteInfo([`"${pick}" tidak ada di Master Data.`]);
      return;
    }
    addLine(p, {});
    setPick("");
    setPasteInfo([]);
  }
  function applyPaste() {
    const rows = parsePoText(paste ?? "");
    const miss: string[] = [];
    const first = Math.max(0, dates.indexOf(pasteDate));
    for (const r of rows) {
      const p = findProduct(products, r.name, r.type);
      if (!p) {
        miss.push(r.raw);
        continue;
      }
      const q: Record<string, number> = {};
      r.qtys.forEach((v, i) => {
        const t = dates[first + i];
        if (t && v > 0) q[t] = v;
      });
      addLine(p, q);
    }
    setPasteInfo([`${rows.length - miss.length} baris masuk.`, ...miss.map((m) => `Tidak dikenali: ${m}`)]);
    if (!miss.length) setPaste(null);
  }
  const setQty = (key: string, date: string, v: number) => setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, qty: { ...l.qty, [date]: v } } : l)) }));
  const removeLine = (key: string) => setD((x) => ({ ...x, lines: x.lines.filter((l) => l.key !== key) }));
  const familyName = (p: Product) => (p.family === "plastik" ? "Plastik" : p.family === "shield" ? "Shield" : "Iron");
  const optionLabel = (p: Product) => `${productLabel(p)} · ${familyName(p)}`;
  const offDates = d.lines.filter((l) => Object.entries(l.qty).some(([t, v]) => v > 0 && !dates.includes(t)));

  // ---------- Simpan ----------
  async function save() {
    setMsg({ busy: true });
    try {
      const r = await fetch("/api/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, data: d }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? "Gagal menyimpan.");
      setMsg({ ok: `Tersimpan sebagai "${name}".` });
      router.refresh();
    } catch (e) {
      setMsg({ err: (e as Error).message });
    }
  }
  async function remove() {
    if (!confirm(`Hapus rencana "${name}"?`)) return;
    await fetch(`/api/overtime?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setName("");
    setMsg({ ok: "Dihapus." });
    router.refresh();
  }
  function load(n: string) {
    const p = saved.find((x) => x.name === n);
    if (!p) return;
    setD({ ...initial(master, today), ...(p.data as PlanData) });
    setName(p.name);
    setMsg({ ok: `Rencana "${p.name}" dibuka (${p.by}, ${p.updated}).` });
  }

  // ---------- Tampilan ----------
  const verdict =
    !res.totalQty
      ? null
      : res.status === "aman"
        ? { cls: "border-emerald-300 bg-emerald-50 text-emerald-900", head: "Aman, semua PO selesai sebelum jam target tanpa lembur." }
        : res.status === "lembur"
          ? { cls: "border-amber-300 bg-amber-50 text-amber-900", head: `Perlu lembur total ${n1(res.otHrs)} jam supaya semua PO selesai sebelum jam ${d.target}.` }
          : { cls: "border-red-300 bg-red-50 text-red-900", head: "Belum terkejar. Tambah orang/mesin atau jam PF (lihat kotak merah di bawah)." };
  const memberParts = [
    ...res.stations.filter((x) => x.members > 0).map((x) => ({ label: `${STEP_NAME[x.step]} ${x.family.name}`, v: x.members, cls: x.step === "pf" ? "bg-sky-600" : x.step === "seiretsu" ? "bg-brand-600" : "bg-amber-500" })),
  ];

  return (
    <main className="flex w-full flex-col gap-5 px-4 pb-16 pt-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Rencana Lembur</h1>
          <p className="text-sm text-slate-500">Input PO per tanggal, setting orang & mesin, langsung kelihatan selesai jam berapa dan butuh lembur berapa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved.length > 0 && (
            <select className="input h-10 w-56 py-1" value="" onChange={(e) => load(e.target.value)} aria-label="Buka rencana tersimpan">
              <option value="">Buka rencana tersimpan…</option>
              {saved.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {p.updated.slice(0, 16)}
                </option>
              ))}
            </select>
          )}
          {canSave && (
            <>
              <input className="input h-10 w-48 py-1" placeholder="Nama rencana, mis. PO 30 Okt" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-primary h-10" disabled={!name.trim() || msg.busy} onClick={save}>
                {msg.busy ? "Menyimpan…" : "Simpan"}
              </button>
              {saved.some((p) => p.name === name) && (
                <button className="btn-secondary h-10" onClick={remove}>
                  Hapus
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {(msg.ok || msg.err) && <p className={`text-sm font-semibold ${msg.err ? "text-red-700" : "text-emerald-700"}`}>{msg.err ?? msg.ok}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* ---------- Kiri: isian ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="text-lg font-bold">1. Waktu</h2>
            <div className="grid gap-4">
              <div>
                <span className="label">Mulai dikerjakan</span>
                <div className="flex flex-wrap gap-2">
                  <input type="date" className="input w-44" value={d.start} onChange={(e) => e.target.value && set({ start: e.target.value })} />
                  <input type="time" step={1800} className="input w-36" value={d.from} onChange={(e) => set({ from: e.target.value })} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Hari pertama sisa {jamMenit(dayProd(schedule, 0))} kerja sampai pulang {pulang}.
                </p>
              </div>
              <div>
                <span className="label">Target selesai tiap tanggal PO</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Chips value={d.target} onChange={(v) => set({ target: v })} options={["13:00", "14:00", "15:00", pulang].filter((v, i, a) => a.indexOf(v) === i).map((v) => ({ v, label: v }))} />
                  <input type="time" step={1800} className="input h-9 w-36 py-1" value={d.target} onChange={(e) => set({ target: e.target.value })} aria-label="Target jam lain" />
                </div>
              </div>
            </div>
            <div>
              <span className="label">Periode (hari kerja)</span>
              <div className="flex flex-wrap items-center gap-3">
                <Chips value={d.nDays} onChange={(v) => set({ nDays: v })} options={[1, 2, 3, 4].map((v) => ({ v, label: `${v} hari` })).concat([{ v: d.sat ? 6 : 5, label: "1 minggu" }])} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.sat} onChange={(e) => set({ sat: e.target.checked })} /> Sabtu masuk
                </label>
              </div>
              <p className="mt-2 text-sm text-slate-600">{dates.map((t) => (t === today ? `Hari ini (${dayName(t)})` : dayName(t))).join(" · ")}</p>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-slate-600">
                Jam kerja: masuk {d.sched.start}, istirahat {d.sched.breakAt} ({d.sched.breakMin} mnt), pulang {pulang}, lembur maks {master.otLimitHrs} jam
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label>
                  <span className="label">Jam masuk</span>
                  <input type="time" className="input" value={d.sched.start} onChange={(e) => set({ sched: { ...d.sched, start: e.target.value } })} />
                </label>
                <label>
                  <span className="label">Istirahat mulai</span>
                  <input type="time" className="input" value={d.sched.breakAt} onChange={(e) => set({ sched: { ...d.sched, breakAt: e.target.value } })} />
                </label>
                <label>
                  <span className="label">Lama istirahat (mnt)</span>
                  <input inputMode="numeric" className="input" value={d.sched.breakMin} onChange={(e) => set({ sched: { ...d.sched, breakMin: num(e.target.value) } })} />
                </label>
                <label>
                  <span className="label">5S, briefing, input (mnt)</span>
                  <input inputMode="numeric" className="input" value={d.sched.routineMin} onChange={(e) => set({ sched: { ...d.sched, routineMin: num(e.target.value) } })} />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">Jam kerja normal {master.normalMin} menit dan batas lembur dari Master Data. Kecepatan: PF pakai Std MC per mesin, Seiretsu & Senbetsu pakai STKI per orang.</p>
            </details>
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">2. PO per tanggal</h2>
              <button className="btn-secondary h-9 px-3 text-sm" onClick={() => (setPaste(paste === null ? "" : null), setPasteDate(dates[0]))}>
                Tempel dari Excel
              </button>
            </div>
            {paste !== null && (
              <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Copy dari Excel: kolom Part, Type, lalu Qty. Bisa beberapa kolom Qty berurutan per tanggal.</p>
                <textarea className="input min-h-28 font-mono text-sm" placeholder={"627-J\tD1\t50000\t40000\n629-J\tD2\t30000"} value={paste} onChange={(e) => setPaste(e.target.value)} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  Qty pertama untuk
                  <select className="input h-9 w-auto py-1" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)}>
                    {dates.map((t) => (
                      <option key={t} value={t}>
                        {dayName(t)}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary h-9 px-4" onClick={applyPaste}>
                    Masukkan
                  </button>
                </div>
              </div>
            )}
            {pasteInfo.length > 0 && (
              <ul className="text-xs">
                {pasteInfo.map((t, i) => (
                  <li key={i} className={t.startsWith("Tidak") || t.includes("tidak ada") ? "text-red-700" : "text-emerald-700"}>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-2">Part / Type</th>
                    {dates.map((t) => (
                      <th key={t} className="px-1 py-2 text-right">
                        {dayName(t)}
                      </th>
                    ))}
                    <th className="px-1 py-2 text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => {
                    const p = byKey.get(l.key);
                    const tot = dates.reduce((a, t) => a + (l.qty[t] ?? 0), 0);
                    return (
                      <tr key={l.key} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">
                          <div className="font-semibold">{p ? productLabel(p) : l.key}</div>
                          <div className="text-xs text-slate-500">{p ? familyName(p) : "tidak ada di Master Data"}</div>
                        </td>
                        {dates.map((t) => (
                          <td key={t} className="px-1 py-1.5">
                            <input
                              inputMode="numeric"
                              className="input h-9 w-24 px-2 py-1 text-right tabular-nums"
                              value={l.qty[t] ? n0(l.qty[t]) : ""}
                              placeholder="0"
                              onChange={(e) => setQty(l.key, t, Math.round(num(e.target.value)))}
                              aria-label={`Qty ${p ? productLabel(p) : ""} ${dayName(t)}`}
                            />
                          </td>
                        ))}
                        <td className="px-1 text-right font-semibold tabular-nums">{n0(tot)}</td>
                        <td className="pl-1">
                          <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => removeLine(l.key)} aria-label="Hapus baris">
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!d.lines.length && (
                    <tr>
                      <td colSpan={dates.length + 3} className="py-6 text-center text-slate-400">
                        Belum ada PO. Pilih part di bawah atau tempel dari Excel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {offDates.length > 0 && <p className="text-xs text-amber-700">Ada qty di tanggal di luar periode ini (tidak dihitung). Perpanjang periode untuk melihatnya.</p>}
            <div className="flex gap-2">
              <input list="ot-parts" className="input h-10" placeholder="Cari part, mis. 627-J D1" value={pick} onChange={(e) => setPick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pick && addPicked()} />
              <datalist id="ot-parts">
                {products.map((p) => (
                  <option key={p.key} value={optionLabel(p)} />
                ))}
              </datalist>
              <button className="btn-secondary h-10 whitespace-nowrap" disabled={!pick.trim()} onClick={addPicked}>
                + Tambah
              </button>
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">3. Member</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.senbetsu} onChange={(e) => set({ senbetsu: e.target.checked })} /> Hitung Senbetsu
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">Total member hadir</span>
              <Stepper value={d.pool} onChange={(v) => set({ pool: v })} label="Total member" />
            </div>
            <div className="flex h-7 overflow-hidden rounded-lg bg-slate-100 text-xs font-semibold text-white">
              {memberParts.map((x) => (
                <div key={x.label} className={`${x.cls} flex items-center justify-center overflow-hidden whitespace-nowrap px-1`} style={{ width: `${(x.v / Math.max(d.pool, res.usedMembers, 1)) * 100}%` }} title={`${x.label}: ${x.v}`}>
                  {x.v}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {memberParts.map((x) => (
                <span key={x.label} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${x.cls}`} />
                  {x.label}: <b>{x.v}</b>
                </span>
              ))}
              <span className={`font-bold ${res.freeMembers < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {res.freeMembers < 0 ? `Kurang ${-res.freeMembers} member` : `Sisa ${res.freeMembers} member`}
              </span>
            </div>
          </section>
        </div>

        {/* ---------- Kanan: hasil ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          {verdict ? (
            <div className={`rounded-xl border-2 p-4 ${verdict.cls}`}>
              <div className="text-lg font-bold">{verdict.head}</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="opacity-70">Total PO</div>
                  <div className="text-xl font-bold tabular-nums">{n0(res.totalQty)} pcs</div>
                </div>
                <div>
                  <div className="opacity-70">Masuk PF</div>
                  <div className="text-xl font-bold tabular-nums">{n0(res.pfQty)} pcs</div>
                </div>
                <div>
                  <div className="opacity-70">Sisa ke Seiretsu</div>
                  <div className="text-xl font-bold tabular-nums">{n0(res.restQty)} pcs</div>
                </div>
                <div>
                  <div className="opacity-70">Member terpakai</div>
                  <div className="text-xl font-bold tabular-nums">
                    {res.usedMembers} / {d.pool}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-slate-500">Isi PO dulu, hasil perhitungan muncul di sini.</div>
          )}

          {res.stations.filter((x) => x.status !== "kosong" || x.units > 0).map((x) => (
            <StationCard
              key={x.key}
              x={x}
              set={d.stations[x.key]}
              onSet={(p) => setStation(x.key, p)}
              fin={fin}
              otDayNames={otDayNames(x)}
              target={d.target}
              recent={master.recent}
              otMaxHrs={master.otLimitHrs}
              today={today}
            />
          ))}

          {res.lines.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-lg font-bold">Detail per type</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-right text-xs text-slate-500">
                      <th className="py-2 pr-2 text-left">Part / Type</th>
                      <th className="px-2">PO (pcs)</th>
                      <th className="px-2">PF (pcs)</th>
                      <th className="px-2">Jam mesin PF</th>
                      <th className="px-2">Seiretsu (pcs)</th>
                      <th className="px-2">Jam orang Seiretsu</th>
                      {d.senbetsu && <th className="px-2">Jam orang Senbetsu</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {res.lines.map((l) => (
                      <tr key={l.key} className="border-b border-slate-100 text-right">
                        <td className="py-1.5 pr-2 text-left font-semibold">{l.product ? productLabel(l.product) : l.key}</td>
                        <td className="px-2">{n0(l.qty)}</td>
                        <td className="px-2">{l.product?.rate.pf ? n0(l.pfQty) : <span className="text-xs text-slate-400">tidak ada Std PF</span>}</td>
                        <td className="px-2">{l.hrs.pf ? n1(l.hrs.pf) : "-"}</td>
                        <td className="px-2">{n0(l.restQty)}</td>
                        <td className="px-2">{l.hrs.seiretsu ? n1(l.hrs.seiretsu) : l.restQty > 0 && !l.product?.rate.seiretsu ? <span className="text-xs text-red-700">tidak ada STKI</span> : "-"}</td>
                        {d.senbetsu && <td className="px-2">{l.hrs.senbetsu ? n1(l.hrs.senbetsu) : "-"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function StationCard({
  x,
  set,
  onSet,
  fin,
  otDayNames,
  target,
  recent,
  otMaxHrs,
  today,
}: {
  x: StationResult;
  set: StationSet | undefined;
  onSet: (p: Partial<StationSet>) => void;
  fin: (f: StationResult["finish"]) => string;
  otDayNames: string[];
  target: string;
  recent: Record<string, number>;
  otMaxHrs: number;
  today: string;
}) {
  const st = STATUS[x.status];
  const pf = x.step === "pf";
  const unit = pf ? "mesin" : "orang";
  const avg = recent[`${x.category}#${pf ? "machines" : "members"}`];
  const red = x.status === "kurang";
  return (
    <section className={`card p-5 ${red ? "border-red-300 ring-2 ring-red-100" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">
            {STEP_NAME[x.step]} <span className="font-medium text-slate-500">· {x.category}</span>
          </h3>
          <p className="text-sm text-slate-500">
            {n0(x.qty)} pcs · {n1(x.loadHrs)} jam-{unit}
            {pf && x.pfShare !== undefined && x.pfShare < 1 && ` · terkejar ${Math.round(x.pfShare * 100)}% PO`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${st.cls}`}>{st.text}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="label">Jumlah {unit}</div>
          <Stepper value={x.units} max={x.maxUnits} min={0} onChange={(v) => onSet({ units: v })} label={`Jumlah ${unit}`} />
          <div className="mt-1 text-xs text-slate-500">
            {x.auto ? "Otomatis (minimum)" : x.maxUnits != null ? `maks ${x.maxUnits} mesin aktif` : ""}
            {avg ? ` · rata-rata 2 minggu ${n1(avg)}` : ""}
          </div>
        </div>
        {pf && (
          <>
            <div>
              <div className="label">Member operator PF</div>
              <Stepper value={set?.members ?? 0} onChange={(v) => onSet({ members: v })} label="Member operator PF" />
            </div>
            <div>
              <div className="label">Lembur mesin PF / hari</div>
              <select className="input h-10 w-32 py-1" value={set?.otMin ?? 0} onChange={(e) => onSet({ otMin: Number(e.target.value) })}>
                {Array.from({ length: otMaxHrs * 2 + 1 }, (_, i) => i * 30).map((m) => (
                  <option key={m} value={m}>
                    {m ? jamMenit(m) : "Tanpa lembur"}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {!x.auto && x.needNoOt > 0 && x.needNoOt !== x.units && (
          <button className="btn-secondary h-10 px-3 text-sm" onClick={() => onSet({ units: x.maxUnits != null ? Math.min(x.maxUnits, x.needNoOt) : x.needNoOt })}>
            Pakai minimum ({x.needNoOt})
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Selesai semua</div>
          <div className="text-lg font-bold">{fin(x.finish)}</div>
          <div className="text-xs text-slate-500">
            {jamMenit(x.perUnitMin)} kerja per {unit}
          </div>
        </div>
        <div className={`rounded-lg p-3 ${x.otPerDay ? "bg-amber-50" : "bg-slate-50"}`}>
          <div className="text-xs text-slate-500">Lembur {pf ? "mesin" : "per orang"}</div>
          <div className="text-lg font-bold">{x.otPerDay && x.otDays ? `${jamMenit(x.otPerDay)} / hari` : "Tidak perlu"}</div>
          {x.otPerDay > 0 && x.otDays > 0 && (
            <div className="text-xs text-slate-600">
              {otDayNames.join(", ")} · total {n1(x.otHrs)} jam-{unit}
            </div>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Minimal {unit} supaya tepat {target}</div>
          <div className="text-lg font-bold">
            {x.needNoOt} {unit} <span className="text-sm font-medium text-slate-500">tanpa lembur</span>
          </div>
          {x.needWithOt != null && x.needWithOt !== x.needNoOt && (
            <div className="text-xs text-slate-600">
              {x.needWithOt} {unit} bila lembur maks {otMaxHrs} jam
            </div>
          )}
        </div>
      </div>

      {x.perDate.length > 0 && (
        <div className="mt-3 text-sm">
          {x.perDate.map((r) => (
            <div key={r.date} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-slate-100 py-1.5">
              <span>
                PO {r.date === today ? "hari ini" : dayName(r.date)} · <b className="tabular-nums">{n0(r.qty)} pcs</b>
              </span>
              <span>
                selesai {fin(r.finish)}{" "}
                <b className={`whitespace-nowrap ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{r.ok ? `✓ sebelum ${target}` : `✗ lewat ${target}`}</b>
              </span>
            </div>
          ))}
        </div>
      )}
      {pf && x.status === "penuh" && <p className="mt-2 text-sm text-sky-800">Mesin PF sudah terpakai penuh sampai jam {target}. Sisa PO dihitung di Seiretsu. Tambah mesin atau lembur PF untuk mengurangi sisa.</p>}
      {x.missingRate.length > 0 && (
        <p className="mt-2 text-sm text-red-700">
          Belum ada {pf ? "Std MC / STKI PF" : "STKI"} di Master Data untuk: {x.missingRate.join(", ")}
          {pf ? " (semua qty-nya dihitung ke Seiretsu)." : " (belum ikut dihitung)."}
        </p>
      )}
    </section>
  );
}
