"use client";
// Rencana Hari Ini, versi sederhana (masukan Anton 11 Nov): satu pertanyaan per layar.
//  Beranda: 3 kartu bagian (PF, Seiretsu, Senbetsu) -> Cukup / Mepet / Kurang.
//  Ketuk bagian: daftar part (target vs perkiraan). Ketuk part: siapa yang mengerjakan, isi target, tambah orang.
//  Ketuk orang: "Pindahkan ke ..." (mulai sekarang / sepanjang hari). Simpan lewat bar bawah.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  assign,
  buildMaster,
  compute,
  dayEnd,
  describe,
  mcHolders,
  mcKey,
  release,
  spans,
  START,
  suggest,
  type Suggestion,
  STEP_NAME,
  STEPS,
  toClock,
  type PlanState,
  type PMaster,
  type PPerson,
  type Result,
  type Row,
  type Seg,
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

/** Status dalam bahasa sehari-hari. Tanpa target = netral. */
type Tone = Status | "NONE";
const WORD: Record<Tone, string> = { SAFE: "Cukup", WARNING: "Mepet", CRITICAL: "Kurang", NONE: "Belum ada target" };
const TONE: Record<Tone, { bg: string; text: string; dot: string; bar: string }> = {
  SAFE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  WARNING: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", bar: "bg-amber-500" },
  CRITICAL: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", bar: "bg-red-500" },
  NONE: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-300", bar: "bg-slate-300" },
};
const toneOf = (r: Row): Tone => (r.need > 0 ? r.status : "NONE");
const STEP_TITLE: Record<Step, string> = { pf: "PF (mesin)", seiretsu: "Seiretsu", senbetsu: "Senbetsu" };

type View = { kind: "home" } | { kind: "step"; step: Step; open?: string };
type Modal = { kind: "pool" } | { kind: "move"; name: string } | { kind: "mc"; key: string } | { kind: "hadir" } | { kind: "lantai" } | { kind: "target"; step: Step } | null;

export default function PlanBoard({ page, today, nowMin, canSave }: { page: PlanPage; today: string; nowMin: number; canSave: boolean }) {
  const m = useMemo(() => buildMaster(page.raw), [page.raw]);
  const [st, setSt] = useState<PlanState>(page.state);
  const [view, setView] = useState<View>({ kind: "home" });
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
  const setPerson = (name: string, fn: (p: PPerson) => PPerson) => update((s) => ({ ...s, people: s.people.map((p) => (p.name === name ? fn(p) : p)) }));
  const setTarget = (key: string, step: Step, v: number) => update((s) => ({ ...s, targets: { ...s.targets, [key]: { ...s.targets[key], [step]: v } } }));
  const changes = st.people.filter((p) => {
    const o = page.initial.people.find((x) => x.name === p.name);
    return !o || describe(m, o, end) !== describe(m, p, end) || !!o.absent !== !!p.absent;
  }).length;
  const errors = res.issues.filter((i) => i.level === "error");
  const sugg = useMemo(() => suggest(m, st, res, now), [m, st, res, now]);
  const apply = (list: Suggestion[]) => update((s) => ({ ...s, people: s.people.map((p) => { const g = list.find((x) => x.who === p.name); return g ? assign({ ...p, absent: undefined }, g.seg) : p; }) }));

  async function save() {
    if (errors.length && !confirm(`Ada ${errors.length} hal yang perlu dicek:\n\n${errors.map((e) => "• " + e.text).join("\n")}\n\nTetap simpan?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/planning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: st, status: "Dikonfirmasi" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan.");
      setSaved({ status: "Dikonfirmasi", by: "Anda", at: j.at });
      setDirty(false);
      setMsg({ kind: "ok", text: "Rencana tersimpan. Leader lain bisa membuka rencana yang sama." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const absent = st.people.filter((p) => p.absent).length;
  const present = st.people.length - absent;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-5 sm:px-6">
      {/* Kepala: tanggal + kehadiran + lantai */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rencana hari ini</div>
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
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal({ kind: "hadir" })} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold hover:border-slate-400">
            👥 {present} masuk{absent ? <span className="text-red-600"> · {absent} tidak masuk</span> : ""} ›
          </button>
          {res.pool.length > 0 && (
            <button onClick={() => setModal({ kind: "pool" })} className="rounded-full bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700">
              {res.pool.length} belum ada tugas ›
            </button>
          )}
          <button onClick={() => setModal({ kind: "lantai" })} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold hover:border-slate-400">
            ▶ Lihat lantai
          </button>
        </div>
      </header>

      {view.kind === "home" ? (
        <Home m={m} res={res} onOpen={(step) => setView({ kind: "step", step })} />
      ) : (
        <StepView
          m={m}
          st={st}
          res={res}
          step={view.step}
          open={view.open}
          end={end}
          onBack={() => setView({ kind: "home" })}
          onToggle={(k) => setView({ kind: "step", step: view.step, open: view.open === k ? undefined : k })}
          onPerson={(name) => setModal({ kind: "move", name })}
          onMc={(key) => setModal({ kind: "mc", key })}
          onTarget={setTarget}
          onAddTarget={() => setModal({ kind: "target", step: view.step })}
          sugg={sugg}
          onApply={apply}
        />
      )}

      {saved && !dirty && !msg && (
        <p className="text-center text-xs text-slate-400">
          Tersimpan oleh {saved.by} · {saved.at}
        </p>
      )}
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</div>}

      {/* Bar simpan: hanya muncul kalau ada perubahan */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-4 lg:pl-[calc(var(--sb-w)+1rem)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
            <span className="text-sm">
              {changes} perubahan{errors.length ? <span className="text-amber-300"> · {errors.length} perlu dicek</span> : ""}
            </span>
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

      {modal?.kind === "move" && (
        <MoveSheet
          m={m}
          st={st}
          res={res}
          name={modal.name}
          now={isToday && nowMin > START ? Math.min(end - 30, Math.ceil(nowMin / 30) * 30) : START}
          end={end}
          onClose={() => setModal(null)}
          onSave={(fn) => {
            setPerson(modal.name, fn);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "mc" && (
        <McSheet
          m={m}
          st={st}
          k={modal.key}
          holder={mcHolders(st, m, now).get(modal.key)}
          onClose={() => setModal(null)}
          onSave={(part) => {
            update((s) => ({ ...s, machines: { ...s.machines, [modal.key]: part } }));
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "pool" && (
        <Sheet title="Belum ada tugas" onClose={() => setModal(null)}>
          <p className="mb-3 text-sm text-slate-500">Ketuk nama untuk memberi tugas.</p>
          <div className="flex flex-col gap-1.5">
            {res.pool.map((n) => (
              <button key={n} onClick={() => setModal({ kind: "move", name: n })} className="rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold">
                {n}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {modal?.kind === "hadir" && <HadirSheet st={st} onClose={() => setModal(null)} onSet={(name, a) => setPerson(name, (p) => ({ ...p, absent: a || undefined }))} />}
      {modal?.kind === "target" && (
        <TargetSheet
          m={m}
          step={modal.step}
          onClose={() => setModal(null)}
          onAdd={(key, v) => {
            setTarget(key, modal.step, v);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "lantai" && (
        <Sheet title="Lantai produksi" wide onClose={() => setModal(null)}>
          <FloorView m={m} st={st} initialAt={now} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Beranda: 3 kartu bagian ---------- */

function stepTone(res: Result, step: Step): Tone {
  const rs = res.rows.filter((r) => r.step === step && r.need > 0);
  if (!rs.length) return "NONE";
  return res.steps.find((s) => s.step === step)!.status;
}

function Home({ m, res, onOpen }: { m: PMaster; res: Result; onOpen: (s: Step) => void }) {
  const tones = STEPS.map((s) => stepTone(res, s));
  const bad = STEPS.filter((_, i) => tones[i] === "CRITICAL").map((s) => STEP_NAME[s]);
  const noTarget = tones.every((t) => t === "NONE");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-slate-700">
        {noTarget ? (
          <>Isi target dulu supaya bisa dicek cukup atau tidak. Ketuk salah satu bagian.</>
        ) : bad.length ? (
          <>
            <b className="text-red-700">{bad.join(" & ")}</b> kurang orang. Ketuk untuk mengatur.
          </>
        ) : (
          <>Semua bagian cukup untuk target hari ini.</>
        )}
      </p>
      {STEPS.map((step, i) => {
        const s = res.steps.find((x) => x.step === step)!;
        const t = tones[i];
        const mcs = step === "pf" ? m.machines.length : 0;
        const ot = Math.ceil(Math.max(0, ...res.rows.filter((r) => r.step === step && r.need > 0).map((r) => r.extraHours)) * 2) / 2;
        return (
          <button key={step} onClick={() => onOpen(step)} className={`card lift flex items-center gap-4 p-4 text-left sm:p-5`}>
            <span className={`h-14 w-1.5 shrink-0 rounded-full ${TONE[t].dot}`} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">{STEP_TITLE[step]}</div>
              <div className="text-sm text-slate-500">
                {s.people} orang{step === "pf" ? ` · ${s.mcs} dari ${mcs} MC jalan` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-base font-bold ${TONE[t].text}`}>{WORD[t]}</div>
              <div className="text-xs text-slate-500">
                {t === "CRITICAL" && s.extraUnits > 0
                  ? `perlu +${s.extraUnits} ${step === "pf" ? "MC" : "orang"}`
                  : t === "WARNING" && ot > 0
                    ? `perlu lembur ±${ot.toLocaleString("id-ID")} jam`
                    : s.surplus > 0
                      ? `lebih ${s.surplus} orang`
                      : ""}
              </div>
            </div>
            <span className="text-xl text-slate-300">›</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Satu bagian: daftar part ---------- */

function StepView(props: {
  m: PMaster;
  st: PlanState;
  res: Result;
  step: Step;
  open?: string;
  end: number;
  onBack: () => void;
  onToggle: (k: string) => void;
  onPerson: (n: string) => void;
  onMc: (k: string) => void;
  onTarget: (key: string, step: Step, v: number) => void;
  onAddTarget: () => void;
  sugg: Suggestion[];
  onApply: (s: Suggestion[]) => void;
}) {
  const { m, st, res, step, open, end } = props;
  const rows = res.rows.filter((r) => r.step === step).sort((a, b) => rank(b) - rank(a) || a.label.localeCompare(b.label));
  const idle = step === "pf" ? res.idleMcs : [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button className="btn-secondary h-9 px-3 text-sm" onClick={props.onBack}>
          ‹ Semua bagian
        </button>
        <h2 className="text-xl font-bold">{STEP_TITLE[step]}</h2>
      </div>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Belum ada yang dikerjakan di bagian ini.</p>}
      {rows.map((r) => {
        const k = `${r.key}#${r.step}`;
        const t = toneOf(r);
        const isOpen = open === k;
        const pctv = r.need ? Math.min(100, (r.estEnd / r.need) * 100) : 0;
        return (
          <div key={k} className="card overflow-hidden">
            <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => props.onToggle(k)} aria-expanded={isOpen}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold">{r.label}</span>
                  <span className={`text-sm font-bold ${TONE[t].text}`}>{r.need ? WORD[t] : ""}</span>
                </div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {r.people.length === 0 ? <span className="font-semibold text-red-600">Belum ada orang</span> : step === "pf" ? `${r.mcs.length} MC · ${r.people.length} orang` : `${r.people.length} orang`}
                </div>
                {r.need > 0 ? (
                  <div className="mt-2">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${TONE[t].bar}`} style={{ width: `${pctv}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
                      <span>Perkiraan s/d {toClock(end)}: {n0(r.estEnd)}</span>
                      <span>Target {n0(r.need)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-400 tabular-nums">Perkiraan s/d {toClock(end)}: {n0(r.estEnd)} pcs · belum ada target</div>
                )}
              </div>
              <span className={`text-lg text-slate-300 transition ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 p-4">
                {r.short > 0 && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    Kurang {n0(r.short)} pcs.{" "}
                    {r.extraUnits > 0 && (
                      <>
                        Tambah <b>{r.extraUnits} {step === "pf" ? "MC" : "orang"}</b>
                      </>
                    )}
                    {r.rateEnd > 0 && (
                      <>
                        {r.extraUnits > 0 ? " atau " : ""}lembur <b>{(Math.ceil(r.extraHours * 2) / 2).toLocaleString("id-ID")} jam</b>
                      </>
                    )}
                    .
                    {(() => {
                      const g = props.sugg.filter((x) => x.row === k);
                      return g.length ? (
                        <button className="mt-2 block w-full rounded-lg bg-white px-3 py-2 text-left font-semibold text-red-800 ring-1 ring-red-200" onClick={() => props.onApply(g)}>
                          + Pindahkan {g.map((x) => x.who.split(" ")[0]).join(", ")} ke sini (mulai {toClock(g[0].seg.at)})
                        </button>
                      ) : null;
                    })()}
                  </div>
                )}
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{step === "pf" ? "Operator · ketuk untuk pindah" : "Yang mengerjakan · ketuk untuk pindah"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.people.map((n) => (
                      <button key={n} onClick={() => props.onPerson(n)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-brand-600">
                        {n}
                      </button>
                    ))}
                    {r.people.length === 0 && <span className="text-sm text-slate-400">Belum ada.</span>}
                  </div>
                </div>
                {step === "pf" && r.mcs.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">MC · ketuk untuk ganti part</div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.mcs.map((id) => {
                        const cat = r.cats.find((c) => m.machines.some((x) => x.category === c && x.mc === id)) ?? r.cats[0];
                        return (
                          <button key={id} onClick={() => props.onMc(mcKey(cat, id))} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800">
                            {id.replace("MC ", "MC")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-600">Target hari ini</span>
                  <input
                    className="input h-9 w-32 py-1 text-right"
                    inputMode="numeric"
                    defaultValue={r.need ? n0(r.need) : ""}
                    placeholder="pcs"
                    onBlur={(e) => num(e.target.value) !== r.need && props.onTarget(r.key, r.step, num(e.target.value))}
                  />
                  <span className="text-slate-400">pcs</span>
                </label>
              </div>
            )}
          </div>
        );
      })}
      <button className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400" onClick={props.onAddTarget}>
        + Target part lain
      </button>
      {idle.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">{idle.length} MC tidak jalan (tanpa operator)</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {idle.map((k) => (
              <button key={k} onClick={() => props.onMc(k)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-500">
                {k.replace("|", " ").replace("PF Iron Cage", "Iron").replace("PF Plastik", "Plastik").replace("Drum PF", "Drum")}
              </button>
            ))}
          </div>
        </details>
      )}
      <p className="text-xs text-slate-400">
        Perkiraan = standar Master Data × efisiensi 30 hari terakhir. {st.ot ? `Lembur ${st.ot / 60} jam.` : ""}
      </p>
    </div>
  );
}
const rank = (r: Row) => (r.need > 0 ? { SAFE: 1, WARNING: 2, CRITICAL: 3 }[r.status] : 0);

/* ---------- Lembar (modal) ---------- */

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-5xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
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

/** Pindahkan orang: pilih tujuan (yang kurang orang di atas), mulai kapan. */
function MoveSheet({ m, st, res, name, now, end, onClose, onSave }: { m: PMaster; st: PlanState; res: Result; name: string; now: number; end: number; onClose: () => void; onSave: (fn: (p: PPerson) => PPerson) => void }) {
  const p = st.people.find((x) => x.name === name)!;
  const has = spans(p, end).some((x) => x.cat);
  const [when, setWhen] = useState<"all" | "now">(has && now > START ? "now" : "all");
  const at = when === "all" ? START : now;
  const [dest, setDest] = useState<string>(""); // "row:<key>#<step>" | "cat:<kategori>" | "pool"
  const [cat, setCat] = useState("");
  const [part, setPart] = useState("");
  const [mcs, setMcs] = useState<string[]>([]);

  // Tujuan cepat: part yang punya target dan belum cukup, lalu part lain yang sedang dikerjakan.
  const quick = res.rows
    .filter((r) => r.step !== "pf" && !r.people.includes(name))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6);
  const partFor = (r: Row) => m.parts.find((x) => x.key === r.key && m.cats.find((c) => c.name === x.category)?.step === r.step);
  const c = m.cats.find((x) => x.name === cat);
  const holders = mcHolders(st, m, at, name);
  const limit = c ? (m.maxMc[c.name] ?? 3) : 0;

  let seg: Seg | null | undefined;
  if (dest.startsWith("row:")) {
    const r = quick.find((x) => `row:${x.key}#${x.step}` === dest);
    const pp = r && partFor(r);
    seg = pp ? { at, cat: pp.category, part: pp.id } : undefined;
  } else if (dest === "other" && c) seg = c.mc ? (mcs.length ? { at, cat, mcs } : undefined) : part ? { at, cat, part } : undefined;
  else if (dest === "pool") seg = null;

  return (
    <Sheet title={`Pindahkan ${name.split(" ").slice(0, 2).join(" ")}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Sekarang: {describe(m, p, end)}</div>
        {has && now > START && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {(["now", "all"] as const).map((w) => (
              <button key={w} onClick={() => setWhen(w)} className={`rounded-md py-2 ${when === w ? "bg-white shadow-sm" : "text-slate-500"}`}>
                {w === "now" ? `Mulai ${toClock(now)}` : "Sepanjang hari"}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pindah ke</div>
          {quick.map((r) => {
            const t = toneOf(r);
            const k = `row:${r.key}#${r.step}`;
            return (
              <button key={k} onClick={() => setDest(k)} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${dest === k ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`}>
                <span>
                  <b>{STEP_NAME[r.step]}</b> · {r.label}
                </span>
                {r.need > 0 && <span className={`text-xs font-bold ${TONE[t].text}`}>{WORD[t]}</span>}
              </button>
            );
          })}
          <button onClick={() => setDest("other")} className={`rounded-lg border px-3 py-2.5 text-left text-sm ${dest === "other" ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`}>
            Bagian / part lain (termasuk PF)…
          </button>
          {dest === "other" && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <select
                className="input"
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setPart("");
                  setMcs([]);
                }}
              >
                <option value="">Pilih bagian…</option>
                {m.cats.map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.name}
                  </option>
                ))}
              </select>
              {c && !c.mc && (
                <select className="input" value={part} onChange={(e) => setPart(e.target.value)}>
                  <option value="">Pilih part…</option>
                  {m.parts
                    .filter((x) => x.category === cat)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                </select>
              )}
              {c?.mc && (
                <>
                  <div className="text-xs text-slate-500">Pilih MC (maks {limit}). Abu-abu = dipegang orang lain.</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {m.machines
                      .filter((x) => x.category === cat)
                      .map((x) => {
                        const k = mcKey(cat, x.mc);
                        const other = holders.get(k);
                        const on = mcs.includes(x.mc);
                        const full = !on && mcs.length >= limit;
                        return (
                          <button
                            key={k}
                            disabled={!!other || full}
                            onClick={() => setMcs(on ? mcs.filter((y) => y !== x.mc) : [...mcs, x.mc])}
                            title={other ? `Dipegang ${other}` : (m.parts.find((q) => q.id === st.machines[k])?.label ?? "")}
                            className={`rounded-md border py-2 text-xs font-bold disabled:opacity-30 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white"}`}
                          >
                            {x.mc.replace("MC ", "")}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}
          {has && (
            <button onClick={() => setDest("pool")} className={`rounded-lg border px-3 py-2.5 text-left text-sm ${dest === "pool" ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`}>
              Tidak ditugaskan (cadangan)
            </button>
          )}
        </div>
        <button
          className="btn-primary"
          disabled={seg === undefined}
          onClick={() => onSave((x) => (seg ? assign({ ...x, absent: undefined }, seg) : release(x, at)))}
        >
          Pindahkan
        </button>
        {spans(p, end).filter((x) => x.cat).length > 1 && (
          <button className="text-sm font-semibold text-slate-500 underline" onClick={() => onSave((x) => ({ ...x, segs: [x.segs.slice().sort((a, b) => a.at - b.at)[0]] }))}>
            Batalkan pindahan, kembali ke tugas awal
          </button>
        )}
      </div>
    </Sheet>
  );
}

function McSheet({ m, st, k, holder, onClose, onSave }: { m: PMaster; st: PlanState; k: string; holder?: string; onClose: () => void; onSave: (part: string) => void }) {
  const mc = m.machines.find((x) => mcKey(x.category, x.mc) === k)!;
  const [part, setPart] = useState(st.machines[k] ?? "");
  const all = m.parts.filter((p) => p.category === mc.category);
  const opts = mc.opts.length ? all.filter((p) => mc.opts.includes(p.id)) : all;
  return (
    <Sheet title={`${mc.category} ${mc.mc}`} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="text-slate-600">{holder ? `Operator: ${holder}` : "Belum ada operator, jadi MC ini tidak jalan."}</div>
        <div className="flex flex-col gap-1.5">
          {opts.map((p) => (
            <button key={p.id} onClick={() => setPart(p.id)} className={`rounded-lg border px-3 py-2.5 text-left ${part === p.id ? "border-brand-600 bg-brand-50 font-semibold" : "border-slate-200 bg-white"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => onSave(part)}>
          Simpan part
        </button>
      </div>
    </Sheet>
  );
}

function HadirSheet({ st, onClose, onSet }: { st: PlanState; onClose: () => void; onSet: (name: string, alasan: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const list = [...st.people].sort((a, b) => (a.absent ? 0 : 1) - (b.absent ? 0 : 1) || a.name.localeCompare(b.name));
  return (
    <Sheet title="Siapa yang tidak masuk?" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">Ketuk nama yang tidak masuk. Tugasnya otomatis tidak dihitung.</p>
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

function TargetSheet({ m, step, onClose, onAdd }: { m: PMaster; step: Step; onClose: () => void; onAdd: (key: string, v: number) => void }) {
  const opts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of m.parts) if (m.cats.find((c) => c.name === p.category)?.step === step && p.rate && !seen.has(p.key)) seen.set(p.key, p.label);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [m, step]);
  const [key, setKey] = useState("");
  const [qty, setQty] = useState("");
  return (
    <Sheet title={`Target ${STEP_NAME[step]}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <select className="input" value={key} onChange={(e) => setKey(e.target.value)}>
          <option value="">Pilih part…</option>
          {opts.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input className="input" inputMode="numeric" placeholder="Target hari ini (pcs)" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button className="btn-primary" disabled={!key || !num(qty)} onClick={() => onAdd(key, num(qty))}>
          Simpan target
        </button>
      </div>
    </Sheet>
  );
}
