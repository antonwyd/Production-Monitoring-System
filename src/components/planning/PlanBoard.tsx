"use client";
// Rencana Hari Ini, versi klik-klik (masukan Anton 11 Nov):
//  1. Lantai produksi (animasi) di atas: siapa di mana, mengerjakan apa.
//  2. Estimasi hasil per bagian & type.
//  3. Manpower: ketuk nama -> proses -> type -> jam (dari - sampai) -> Simpan. Bisa dipindah kapan saja.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  assignRange,
  buildMaster,
  compute,
  dayEnd,
  extendOt,
  mcHolders,
  mcKey,
  normalEnd,
  release,
  spans,
  START,
  STEP_NAME,
  STEPS,
  toClock,
  type PlanState,
  type PMaster,
  type PPerson,
  type Result,
  type Row,
  type Status,
  type Step,
} from "@/lib/planning";
import type { PlanPage } from "@/lib/sheets/planning";
import FloorView from "./FloorView";

const ALASAN = ["Cuti", "Sakit", "Izin", "Alpa"];
const n0 = (v: number) => Math.round(v).toLocaleString("id-ID");
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return `${HARI[t.getUTCDay()]}, ${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}`;
};
const shift = (date: string, d: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const short = (name: string) => name.split(" ").slice(0, 2).join(" ");

/** Warna per bagian (sama di garis waktu & tombol). */
const COLOR: Record<Step, string> = { pf: "#3b82f6", seiretsu: "#f59e0b", senbetsu: "#10b981" };
const WORD: Record<Status, string> = { SAFE: "Cukup", WARNING: "Mepet", CRITICAL: "Kurang" };
const TEXT: Record<Status, string> = { SAFE: "text-emerald-700", WARNING: "text-amber-700", CRITICAL: "text-red-700" };

type Modal = { kind: "person"; name: string } | { kind: "hadir" } | { kind: "target"; row: Row } | null;

export default function PlanBoard({ page, today, nowMin, canSave }: { page: PlanPage; today: string; nowMin: number; canSave: boolean }) {
  const m = useMemo(() => buildMaster(page.raw), [page.raw]);
  const [st, setSt] = useState<PlanState>(page.state);
  const [modal, setModal] = useState<Modal>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(page.saved);
  const isToday = st.date === today;
  const now = isToday ? Math.max(START, nowMin) : START;
  const end = dayEnd(m, st.ot);
  const res = useMemo(() => compute(m, st, end, now), [m, st, end, now]);
  const update = (fn: (s: PlanState) => PlanState) => {
    setSt((s) => fn(s));
    setDirty(true);
    setMsg(null);
  };
  const changes = st.people.filter((p) => {
    const o = page.initial.people.find((x) => x.name === p.name);
    const sig = (x: PPerson, e: number) => JSON.stringify(spans(x, e).filter((s) => s.cat));
    return !o || sig(o, dayEnd(m, page.initial.ot)) !== sig(p, end) || !!o.absent !== !!p.absent;
  }).length;
  const errors = res.issues.filter((i) => i.level === "error");

  async function save() {
    if (errors.length && !confirm(`Ada ${errors.length} hal yang perlu dicek:\n\n${errors.map((e) => "• " + e.text).join("\n")}\n\nTetap simpan?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/planning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: st, status: "Dikonfirmasi" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan.");
      setSaved({ status: "Dikonfirmasi", by: "Anda", at: j.at });
      setDirty(false);
      setMsg({ kind: "ok", text: "Rencana tersimpan." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const absent = st.people.filter((p) => p.absent);
  // Kelompokkan orang menurut bagian yang sedang dikerjakan sekarang.
  const groups = useMemo(() => {
    const g: Record<string, PPerson[]> = { pf: [], seiretsu: [], senbetsu: [], pool: [], absent: [] };
    for (const p of st.people) {
      if (p.absent) {
        g.absent.push(p);
        continue;
      }
      const sp = spans(p, end);
      const cur = sp.find((s) => s.at <= now && now < s.to && s.cat) ?? sp.find((s) => s.cat && s.to > now) ?? sp.find((s) => s.cat);
      const step = cur && m.cats.find((c) => c.name === cur.cat)?.step;
      (step ? g[step] : g.pool).push(p);
    }
    return g;
  }, [st.people, end, now, m]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rencana manpower</div>
          <h1 className="text-2xl font-bold">{tgl(st.date)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link className="btn-secondary h-10 w-10 px-0" href={`/perencanaan?date=${shift(st.date, -1)}`} aria-label="Hari sebelumnya">
            ‹
          </Link>
          <Link className="btn-secondary h-10 w-10 px-0" href={`/perencanaan?date=${shift(st.date, 1)}`} aria-label="Hari berikutnya">
            ›
          </Link>
        </div>
      </header>

      {/* 1. Lantai produksi */}
      <section className="card p-3 sm:p-4">
        <FloorView m={m} st={st} initialAt={now} />
      </section>

      {/* 2. Estimasi hasil */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Estimasi hasil s/d {toClock(end)}</h2>
        <Estimasi m={m} res={res} onRow={(row) => setModal({ kind: "target", row })} />
      </section>

      {/* 3. Manpower */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Manpower</h2>
          <button className="text-sm font-semibold text-slate-600 underline" onClick={() => setModal({ kind: "hadir" })}>
            {st.people.length - absent.length} masuk{absent.length ? ` · ${absent.length} tidak masuk` : ""}
          </button>
        </div>
        <p className="-mt-2 text-sm text-slate-500">Ketuk nama untuk memberi atau memindah tugas.</p>
        {(["pf", "seiretsu", "senbetsu", "pool"] as const).map((g) =>
          groups[g].length ? (
            <div key={g}>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g === "pool" ? "#cbd5e1" : COLOR[g] }} />
                {g === "pool" ? "Belum ada tugas" : STEP_NAME[g]} · {groups[g].length}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groups[g].map((p) => (
                  <PersonCard key={p.name} m={m} p={p} end={end} onClick={() => setModal({ kind: "person", name: p.name })} />
                ))}
              </div>
            </div>
          ) : null,
        )}
      </section>

      {saved && !dirty && !msg && (
        <p className="text-center text-xs text-slate-400">
          Tersimpan oleh {saved.by} · {saved.at}
        </p>
      )}
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</div>}

      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-4 lg:pl-[calc(var(--sb-w)+1rem)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
            <span className="text-sm">{changes} orang diubah</span>
            {canSave ? (
              <button className="btn-primary h-10 px-5" disabled={busy} onClick={save}>
                {busy ? "Menyimpan…" : "Simpan rencana"}
              </button>
            ) : (
              <span className="text-xs text-slate-300">Hanya leader/admin yang bisa menyimpan</span>
            )}
          </div>
        </div>
      )}

      {modal?.kind === "person" && (
        <AssignSheet
          m={m}
          st={st}
          name={modal.name}
          from={isToday && nowMin > START ? Math.min(normalEnd(m) - 60, Math.floor(nowMin / 60) * 60) : START}
          onClose={() => setModal(null)}
          onApply={(fn) => {
            update(fn);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "hadir" && (
        <HadirSheet st={st} onClose={() => setModal(null)} onSet={(name, a) => update((s) => ({ ...s, people: s.people.map((p) => (p.name === name ? { ...p, absent: a || undefined } : p)) }))} />
      )}
      {modal?.kind === "target" && (
        <TargetSheet
          row={modal.row}
          onClose={() => setModal(null)}
          onSave={(v) => {
            const r = modal.row;
            update((s) => ({ ...s, targets: { ...s.targets, [r.key]: { ...s.targets[r.key], [r.step]: v } } }));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Estimasi: per bagian, per type ---------- */

function Estimasi({ m, res, onRow }: { m: PMaster; res: Result; onRow: (r: Row) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STEPS.map((step) => {
        const rows = res.rows.filter((r) => r.step === step).sort((a, b) => b.estEnd - a.estEnd);
        const s = res.steps.find((x) => x.step === step)!;
        const hasT = rows.some((r) => r.need > 0);
        return (
          <div key={step} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-3 w-3 rounded-full" style={{ background: COLOR[step] }} />
                {STEP_NAME[step]}
              </div>
              <div className="text-sm text-slate-500">
                {s.people} orang{step === "pf" ? ` · ${s.mcs} MC` : ""}
                {hasT && <b className={`ml-2 ${TEXT[s.status]}`}>{WORD[s.status]}</b>}
              </div>
            </div>
            <div className="divide-y divide-slate-100 px-4 pb-2 pt-1">
              {rows.length === 0 && <div className="py-3 text-sm text-slate-400">Belum ada yang ditugaskan.</div>}
              {rows.map((r) => (
                <button key={r.key} onClick={() => onRow(r)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{r.label}</span>
                    <span className="ml-1.5 text-xs text-slate-400">{step === "pf" ? `${r.mcs.length} MC` : `${r.people.length} org`}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold">{n0(r.estEnd)}</span>
                    {r.need > 0 ? (
                      <span className={`block text-xs font-semibold ${TEXT[r.status]}`}>
                        {Math.round((r.estEnd / r.need) * 100)}% dari {n0(r.need)}
                      </span>
                    ) : (
                      <span className="block text-xs text-slate-400">+ target</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-slate-400 md:col-span-3">pcs = standar Master Data × efisiensi 30 hari terakhir. Ketuk type untuk isi target.</p>
    </div>
  );
}

/* ---------- Kartu orang dengan garis waktu ---------- */

function partText(m: PMaster, s: { cat: string; part?: string; mcs?: string[] }) {
  if (s.mcs?.length) return s.mcs.map((x) => x.replace("MC ", "MC")).join(", ");
  return m.parts.find((p) => p.id === s.part)?.label ?? "";
}

function PersonCard({ m, p, end, onClick }: { m: PMaster; p: PPerson; end: number; onClick: () => void }) {
  const sp = spans(p, end).filter((s) => s.cat);
  const span = end - START;
  return (
    <button onClick={onClick} className="card lift flex flex-col gap-1.5 p-3 text-left">
      <div className="font-semibold">{p.name}</div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
        {sp.map((s, i) => {
          const step = m.cats.find((c) => c.name === s.cat)?.step;
          return <span key={i} className="absolute inset-y-0" style={{ left: `${((s.at - START) / span) * 100}%`, width: `${((s.to - s.at) / span) * 100}%`, background: step ? COLOR[step] : "#94a3b8" }} />;
        })}
      </div>
      <div className="text-xs leading-relaxed text-slate-500">
        {sp.length === 0
          ? "Belum ada tugas"
          : sp.map((s, i) => (
              <div key={i}>
                <span className="tabular-nums">
                  {toClock(s.at)}–{toClock(s.to)}
                </span>{" "}
                <b className="text-slate-700">{s.cat}</b> {partText(m, s)}
              </div>
            ))}
      </div>
    </button>
  );
}

/* ---------- Lembar ---------- */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-secondary h-9 w-9 px-0" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Chip = ({ on, onClick, children, color, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; disabled?: boolean }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition disabled:opacity-30 ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
    style={on && color ? { background: color, borderColor: color } : undefined}
  >
    {children}
  </button>
);

/** Ketuk nama -> proses -> type -> jam -> Simpan. */
function AssignSheet({ m, st, name, from: from0, onClose, onApply }: { m: PMaster; st: PlanState; name: string; from: number; onClose: () => void; onApply: (fn: (s: PlanState) => PlanState) => void }) {
  const p = st.people.find((x) => x.name === name)!;
  const end = dayEnd(m, st.ot);
  const nEnd = normalEnd(m);
  const hasWork = spans(p, end).some((s) => s.cat);
  const [cat, setCat] = useState("");
  const [part, setPart] = useState("");
  const [mcs, setMcs] = useState<string[]>([]);
  const [from, setFrom] = useState(hasWork ? from0 : START);
  const [until, setUntil] = useState(nEnd);
  const c = m.cats.find((x) => x.name === cat);
  const limit = c ? (m.maxMc[c.name] ?? 3) : 0;
  const holders = mcHolders(st, m, from, name);

  // Type yang bisa dikerjakan di proses ini (yang ada standarnya).
  const parts = m.parts.filter((x) => x.category === cat && x.rate > 0);
  // MC untuk type terpilih: yang biasa/boleh menjalankan type itu.
  const mcsFor = (pid: string) => m.machines.filter((x) => x.category === cat && (st.machines[mcKey(cat, x.mc)] === pid || x.opts.includes(pid)));
  const pickPart = (pid: string) => {
    setPart(pid);
    if (c?.mc) {
      const free = mcsFor(pid)
        .filter((x) => !holders.get(mcKey(cat, x.mc)))
        .sort((a, b) => Number(st.machines[mcKey(cat, b.mc)] === pid) - Number(st.machines[mcKey(cat, a.mc)] === pid));
      setMcs(free.slice(0, limit).map((x) => x.mc));
    }
  };
  const fromOpts = [7, 8, 9, 10, 11, 13, 14, 15].map((h) => h * 60).filter((x) => x < nEnd);
  const untilOpts = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => h * 60).filter((x) => x > from && x <= nEnd + m.otLimitMin);
  const ready = !!cat && (c?.mc ? mcs.length > 0 && !!part : !!part);

  function simpan() {
    onApply((s) => {
      let s2 = until > dayEnd(m, s.ot) ? extendOt(m, s, until - nEnd) : s;
      const e = dayEnd(m, s2.ot);
      const seg = c!.mc ? { at: from, cat, mcs } : { at: from, cat, part };
      const machines = c!.mc ? { ...s2.machines, ...Object.fromEntries(mcs.map((x) => [mcKey(cat, x), part])) } : s2.machines;
      s2 = { ...s2, machines, people: s2.people.map((x) => (x.name === name ? assignRange({ ...x, absent: undefined }, seg, until, e) : x)) };
      return s2;
    });
  }

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {hasWork
            ? spans(p, end)
                .filter((s) => s.cat)
                .map((s) => `${toClock(s.at)}–${toClock(s.to)} ${s.cat} ${partText(m, s)}`)
                .join(" · ")
            : p.absent
              ? `Tidak masuk (${p.absent})`
              : "Belum ada tugas"}
        </div>

        <div>
          <div className="mb-2 text-sm font-bold">1. Proses</div>
          <div className="grid grid-cols-2 gap-2">
            {m.cats.map((x) => (
              <Chip
                key={x.name}
                on={cat === x.name}
                color={COLOR[x.step]}
                onClick={() => {
                  setCat(x.name);
                  setPart("");
                  setMcs([]);
                }}
              >
                {x.name}
              </Chip>
            ))}
          </div>
        </div>

        {c && (
          <div>
            <div className="mb-2 text-sm font-bold">2. Type</div>
            <div className="flex flex-wrap gap-2">
              {parts.map((x) => (
                <Chip key={x.id} on={part === x.id} color={COLOR[c.step]} onClick={() => pickPart(x.id)}>
                  {x.label}
                </Chip>
              ))}
              {parts.length === 0 && <span className="text-sm text-slate-400">Belum ada type dengan standar di Master Data.</span>}
            </div>
          </div>
        )}

        {c?.mc && part && (
          <div>
            <div className="mb-2 text-sm font-bold">
              MC <span className="font-normal text-slate-500">(maks {limit}, sudah dipilih otomatis)</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {m.machines
                .filter((x) => x.category === cat)
                .map((x) => {
                  const k = mcKey(cat, x.mc);
                  const on = mcs.includes(x.mc);
                  const other = holders.get(k);
                  return (
                    <button
                      key={k}
                      disabled={!!other || (!on && mcs.length >= limit)}
                      title={other ? `Dipegang ${other}` : ""}
                      onClick={() => setMcs(on ? mcs.filter((y) => y !== x.mc) : [...mcs, x.mc])}
                      className={`rounded-lg border py-2 text-xs font-bold disabled:opacity-25 ${on ? "border-transparent text-white" : "border-slate-200 bg-white"}`}
                      style={on ? { background: COLOR[c.step] } : undefined}
                    >
                      {x.mc.replace("MC ", "")}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {c && (
          <div>
            <div className="mb-2 text-sm font-bold">3. Jam</div>
            <div className="mb-1 text-xs text-slate-500">Dari</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {fromOpts.map((x) => (
                <Chip
                  key={x}
                  on={from === x}
                  onClick={() => {
                    setFrom(x);
                    if (until <= x) setUntil(nEnd);
                  }}
                >
                  {toClock(x)}
                </Chip>
              ))}
            </div>
            <div className="mb-1 text-xs text-slate-500">Sampai</div>
            <div className="flex flex-wrap gap-1.5">
              {untilOpts.map((x) => (
                <Chip key={x} on={until === x} onClick={() => setUntil(x)}>
                  {toClock(x)}
                  {x > nEnd ? " ⏱" : ""}
                </Chip>
              ))}
            </div>
            {until > nEnd && <p className="mt-1.5 text-xs text-amber-700">Lembur {(until - nEnd) / 60} jam.</p>}
          </div>
        )}

        <button className="btn-primary h-12 text-base" disabled={!ready} onClick={simpan}>
          {ready ? `Tugaskan ${toClock(from)}–${toClock(until)}` : "Pilih proses dan type"}
        </button>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {hasWork && (
            <button className="btn-secondary h-10 text-sm" onClick={() => onApply((s) => ({ ...s, people: s.people.map((x) => (x.name === name ? release(x, from) : x)) }))}>
              Kosongkan mulai {toClock(from)}
            </button>
          )}
          {ALASAN.map((a) => (
            <button
              key={a}
              className={`h-10 rounded-lg px-3 text-sm font-semibold ${p.absent === a ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}
              onClick={() => onApply((s) => ({ ...s, people: s.people.map((x) => (x.name === name ? { ...x, absent: p.absent === a ? undefined : a } : x)) }))}
            >
              {p.absent === a ? `${a} ✕` : a}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function HadirSheet({ st, onClose, onSet }: { st: PlanState; onClose: () => void; onSet: (name: string, alasan: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const list = [...st.people].sort((a, b) => (a.absent ? 0 : 1) - (b.absent ? 0 : 1) || a.name.localeCompare(b.name));
  return (
    <Sheet title="Siapa yang tidak masuk?" onClose={onClose}>
      <div className="flex flex-col divide-y divide-slate-100">
        {list.map((p) => (
          <div key={p.name} className="py-2">
            <button className="flex w-full items-center justify-between text-left text-sm" onClick={() => (p.absent ? onSet(p.name, "") : setPick(pick === p.name ? null : p.name))}>
              <span className={p.absent ? "font-semibold text-red-700" : ""}>{p.name}</span>
              <span className={`text-xs font-semibold ${p.absent ? "text-red-600" : "text-emerald-600"}`}>{p.absent ? `${p.absent} · batalkan` : "Masuk"}</span>
            </button>
            {pick === p.name && !p.absent && (
              <div className="mt-2 flex gap-1.5">
                {ALASAN.map((a) => (
                  <button
                    key={a}
                    className="flex-1 rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
                    onClick={() => {
                      onSet(p.name, a);
                      setPick(null);
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function TargetSheet({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (v: number) => void }) {
  const [qty, setQty] = useState(row.need ? n0(row.need) : "");
  return (
    <Sheet title={`Target ${STEP_NAME[row.step]} ${row.label}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-500">
          Estimasi sekarang {n0(row.estEnd)} pcs ({row.people.map(short).join(", ") || "belum ada orang"}).
        </p>
        <input className="input text-lg" inputMode="numeric" placeholder="Target hari ini (pcs)" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <button className="btn-primary" onClick={() => onSave(num(qty))}>
          Simpan target
        </button>
      </div>
    </Sheet>
  );
}
