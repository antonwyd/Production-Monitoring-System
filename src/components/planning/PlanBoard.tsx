"use client";
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
  STEP_NAME,
  STEPS,
  suggest,
  toClock,
  type PlanState,
  type PMaster,
  type PPerson,
  type Row,
  type Seg,
  type Status,
  type Step,
} from "@/lib/planning";
import type { PlanPage } from "@/lib/sheets/planning";
import FloorView from "./FloorView";

const ALASAN = ["Cuti", "Sakit", "Izin", "Alpa"];
const n0 = (v: number) => Math.round(v).toLocaleString("id-ID");
const n1 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const ST_CLS: Record<Status, string> = {
  SAFE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  WARNING: "bg-amber-50 text-amber-800 ring-amber-200",
  CRITICAL: "bg-red-50 text-red-700 ring-red-200",
};
const ST_HELP: Record<Status, string> = {
  SAFE: "Aman: estimasi s/d akhir hari ≥ target + 10%",
  WARNING: "Mepet: cadangan < 10%, atau baru tercapai dengan lembur",
  CRITICAL: "Kritis: tidak tercapai walau lembur maksimal, atau belum ada yang mengerjakan",
};
function Badge({ s, small }: { s: Status; small?: boolean }) {
  return (
    <span title={ST_HELP[s]} className={`inline-flex items-center rounded-full font-bold tracking-wide ring-1 ring-inset ${ST_CLS[s]} ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      {s}
    </span>
  );
}

/** Pilihan jam mulai: 07:00 lalu tiap 30 menit sampai akhir hari. */
function slots(end: number) {
  const out: number[] = [START];
  for (let t = 7 * 60 + 30; t < end; t += 30) if (t < 12 * 60 || t >= 13 * 60) out.push(t);
  return out;
}

type Edit = { kind: "person"; name: string } | { kind: "mc"; key: string } | null;

export default function PlanBoard({ page, today, nowMin, canSave }: { page: PlanPage; today: string; nowMin: number; canSave: boolean }) {
  const m = useMemo(() => buildMaster(page.raw), [page.raw]);
  const [st, setSt] = useState<PlanState>(page.state);
  const [at, setAt] = useState(16 * 60);
  const [edit, setEdit] = useState<Edit>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"papan" | "lantai">("papan");
  const [saved, setSaved] = useState(page.saved);
  const isToday = st.date === today;
  const now = isToday ? Math.max(START, nowMin) : START;
  const end = dayEnd(m, st.ot);
  const res = useMemo(() => compute(m, st, at, now), [m, st, at, now]);
  const sug = useMemo(() => suggest(m, st, res, now), [m, st, res, now]);
  const errors = res.issues.filter((i) => i.level === "error");
  const update = (fn: (s: PlanState) => PlanState) => {
    setSt((s) => fn(s));
    setDirty(true);
    setMsg(null);
  };
  const setPerson = (name: string, fn: (p: PPerson) => PPerson) => update((s) => ({ ...s, people: s.people.map((p) => (p.name === name ? fn(p) : p)) }));

  const stepOfCat = (cat: string) => m.cats.find((c) => c.name === cat)?.step;
  const stepOfPerson = (p: PPerson): Step | "pool" => {
    const sp = spans(p, end).filter((x) => x.cat);
    const s = sp.find((x) => x.at <= Math.max(now, START) && Math.max(now, START) < x.to) ?? sp[0];
    return (s && stepOfCat(s.cat)) || "pool";
  };

  async function save(status: "Draft" | "Dikonfirmasi") {
    if (status === "Dikonfirmasi" && errors.length && !confirm(`Masih ada ${errors.length} masalah merah. Tetap konfirmasi rencana?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/planning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: st, status }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan.");
      setSaved({ status, by: "Anda", at: j.at });
      setDirty(false);
      setMsg({ kind: "ok", text: status === "Dikonfirmasi" ? "Rencana dikonfirmasi dan tersimpan di tab Rencana Harian. Tanda tidak masuk ikut tersimpan di tab Kehadiran." : "Draft tersimpan." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const present = st.people.filter((p) => !p.absent);
  const changes = st.people.filter((p) => {
    const o = page.initial.people.find((x) => x.name === p.name);
    return !o || describe(m, o, end) !== describe(m, p, end);
  });
  const hourChips = [10 * 60, 12 * 60, 13 * 60, 14 * 60, 16 * 60, ...(st.ot > 0 ? [end] : [])];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
      {/* Kepala + ringkasan status yang selalu terlihat */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Perencanaan</div>
          <h1 className="text-2xl font-bold">Rencana Hari Ini</h1>
          <p className="text-sm text-slate-500">
            Dasar penugasan awal: laporan {page.basis ? `hari kerja terakhir (s/d ${page.basis})` : "belum ada"}.{" "}
            {saved ? (
              <span className="font-semibold text-slate-700">
                {saved.status} oleh {saved.by} · {saved.at}
              </span>
            ) : (
              "Belum disimpan."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary h-10 w-10 px-0" href={`/perencanaan?date=${shift(st.date, -1)}`} aria-label="Hari sebelumnya">
            ‹
          </Link>
          <input
            type="date"
            className="input h-10 w-auto"
            value={st.date}
            onChange={(e) => e.target.value && (window.location.href = `/perencanaan?date=${e.target.value}`)}
            aria-label="Tanggal rencana"
          />
          <Link className="btn-secondary h-10 w-10 px-0" href={`/perencanaan?date=${shift(st.date, 1)}`} aria-label="Hari berikutnya">
            ›
          </Link>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <div className="flex flex-wrap items-center gap-2">
          {res.steps.map((s) => (
            <a key={s.step} href="#kapasitas" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
              <span className="font-semibold">{STEP_NAME[s.step]}</span>
              <Badge s={s.status} small />
            </a>
          ))}
          <span className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${errors.length ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"}`}>{errors.length} masalah merah{res.issues.length > errors.length ? ` · ${res.issues.length - errors.length} peringatan` : ""}</span>
          <nav className="ml-auto hidden gap-1 text-sm md:flex">
            {[
              ["#hadir", "1 Kehadiran"],
              ["#alokasi", "2 Alokasi"],
              ["#kapasitas", "3 Kapasitas & PO"],
              ["#konfirmasi", "4 Konfirmasi"],
            ].map(([h, l]) => (
              <a key={h} href={h} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
                {l}
              </a>
            ))}
          </nav>
          {canSave && (
            <button className="btn-primary h-9 px-3 text-sm" disabled={busy} onClick={() => save("Dikonfirmasi")}>
              Konfirmasi
            </button>
          )}
        </div>
      </div>

      {/* 1 Kehadiran */}
      <Section id="hadir" n={1} title="Kehadiran" sub={`${present.length} masuk · ${res.absent} tidak masuk · ${res.pool.length} cadangan (belum ditugaskan)`}>
        <p className="text-sm text-slate-500">Semua member QA dianggap masuk. Ketuk nama yang tidak masuk. Penugasannya otomatis tidak dihitung.</p>
        <div className="flex flex-wrap gap-1.5">
          {st.people.map((p) => (
            <button
              key={p.name}
              onClick={() => setEdit({ kind: "person", name: p.name })}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${p.absent ? "border-red-200 bg-red-50 text-red-700 line-through decoration-red-300" : "border-slate-200 bg-white hover:border-slate-400"}`}
              title={describe(m, p, end)}
            >
              {p.name}
              {p.absent && <span className="ml-1 text-xs no-underline">({p.absent})</span>}
            </button>
          ))}
        </div>
      </Section>

      {/* 2 Alokasi */}
      <Section id="alokasi" n={2} title="Alokasi orang & mesin" sub="Ketuk orang untuk memindah (mulai jam berapa, ke mana). Ketuk MC untuk mengganti part.">
        <div className="flex gap-1 self-start rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="tablist">
          {(["papan", "lantai"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {v === "papan" ? "Papan" : "Tampilan lantai"}
            </button>
          ))}
        </div>
        {view === "lantai" ? (
          <FloorView m={m} st={st} initialAt={now} />
        ) : (
          <>
        <div className="grid gap-4 lg:grid-cols-3">
          {STEPS.map((step) => {
            const sum = res.steps.find((s) => s.step === step)!;
            const ppl = present.filter((p) => stepOfPerson(p) === step);
            return (
              <div key={step} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{step === "pf" ? "PF (mesin)" : `${STEP_NAME[step]} (manual)`}</div>
                    <div className="text-xs text-slate-500">
                      {sum.people} orang{step === "pf" ? ` · ${sum.mcs} MC jalan` : ""}
                      {sum.extraUnits > 0 && <span className="font-semibold text-red-700"> · kurang {sum.extraUnits} {step === "pf" ? "MC" : "orang"}</span>}
                      {sum.surplus > 0 && <span className="font-semibold text-sky-700"> · lebih {sum.surplus} orang</span>}
                    </div>
                  </div>
                  <Badge s={sum.status} />
                </div>
                {step === "pf" &&
                  m.cats
                    .filter((c) => c.mc)
                    .map((c) => <McGrid key={c.name} m={m} st={st} cat={c.name} at={now} onPick={(key) => setEdit({ kind: "mc", key })} />)}
                <div className="flex flex-col gap-1.5">
                  {ppl.length === 0 && <div className="text-sm text-slate-400">Belum ada orang.</div>}
                  {ppl.map((p) => (
                    <PersonCard key={p.name} m={m} p={p} end={end} onClick={() => setEdit({ kind: "person", name: p.name })} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <div className="mb-2 text-sm font-semibold">Cadangan ({res.pool.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {res.pool.length === 0 && <span className="text-sm text-slate-400">Semua yang masuk sudah ditugaskan.</span>}
            {res.pool.map((n) => (
              <button key={n} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-brand-600" onClick={() => setEdit({ kind: "person", name: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
          </>
        )}
      </Section>

      {/* 3 Kapasitas & PO */}
      <Section id="kapasitas" n={3} title="Kapasitas & target hari ini" sub="Estimasi dari Master Data (STKI per orang, Std MC per mesin) dikali efisiensi 30 hari terakhir. Jam efektif 07:20–12:00 dan 13:00–16:00.">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Estimasi s/d jam</span>
          {hourChips.map((h) => (
            <button key={h} onClick={() => setAt(h)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${at === h ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
              {toClock(h)}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm">
            Lembur
            <select className="input h-9 w-auto py-1" value={st.ot} onChange={(e) => update((s) => ({ ...s, ot: Number(e.target.value) }))}>
              {Array.from({ length: Math.floor(m.otLimitMin / 30) + 1 }, (_, i) => i * 30).map((v) => (
                <option key={v} value={v}>
                  {v ? `${n1(v / 60)} jam (s/d ${toClock(dayEnd(m, v))})` : "Tidak"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {res.steps.map((s) => (
            <div key={s.step} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  {STEP_NAME[s.step]} s/d {toClock(Math.min(at, end))}
                </span>
                <Badge s={s.status} small />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{n0(s.est)}</div>
              <div className="text-xs text-slate-500">
                pcs · target {n0(s.need)}
                {s.short > 0 && <span className="font-semibold text-red-700"> · kurang {n0(s.short)} di akhir hari</span>}
              </div>
            </div>
          ))}
        </div>
        <RowsTable m={m} st={st} res={res.rows} at={Math.min(at, end)} end={end} onTarget={(key, step, v) => update((s) => ({ ...s, targets: { ...s.targets, [key]: { ...s.targets[key], [step]: v } } }))} />
        <AddTarget m={m} onAdd={(key, step, v) => update((s) => ({ ...s, targets: { ...s.targets, [key]: { ...s.targets[key], [step]: v } } }))} />
        {sug.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="mb-2 text-sm font-bold text-amber-900">Saran pindah</div>
            <ul className="flex flex-col gap-2">
              {sug.map((x, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{x.text}</span>
                  <button className="btn-secondary h-8 px-3 text-sm" onClick={() => setPerson(x.who, (p) => assign(p, x.seg))}>
                    Terapkan
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* 4 Konfirmasi */}
      <Section id="konfirmasi" n={4} title="Konfirmasi" sub="Periksa perubahan dan masalah, lalu simpan supaya leader bisa membuka rencana yang sama.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold">Perubahan dari penugasan awal ({changes.length})</div>
            {changes.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada perubahan.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {changes.map((p) => (
                  <li key={p.name} className="px-3 py-2">
                    <b>{p.name}</b>: {describe(m, p, end)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Masalah ({res.issues.length})</div>
            {res.issues.length === 0 ? (
              <p className="text-sm text-emerald-700">Tidak ada masalah alokasi.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {res.issues.map((i, k) => (
                  <li key={k} className={`rounded-lg px-3 py-2 ${i.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                    {i.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</div>}
        {canSave ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={busy} onClick={() => save("Draft")}>
              Simpan draft
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => save("Dikonfirmasi")}>
              {busy ? "Menyimpan…" : "Konfirmasi rencana"}
            </button>
            {dirty && <span className="self-center text-sm text-amber-700">Ada perubahan yang belum disimpan.</span>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Anda bisa mencoba simulasi. Menyimpan dan mengonfirmasi rencana hanya untuk leader/admin.</p>
        )}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Dasar hitung</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {m.cats.map((c) => (
              <li key={c.name}>
                {c.name}: efisiensi {pct(m.eff[c.name] ?? 1)} ({page.source[`eff|${c.name}`] ?? "default 100%"})
                {c.mc && (
                  <>
                    , maks {m.maxMc[c.name]} MC/operator ({page.source[`max|${c.name}`] ?? "default"})
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2">Bisa diganti di Master Data &gt; Setting dengan baris &quot;Planning efficiency - Kategori&quot; atau &quot;Max MC per operator - Kategori&quot;.</p>
        </details>
      </Section>

      {edit?.kind === "person" && (
        <PersonSheet
          m={m}
          st={st}
          name={edit.name}
          defaultAt={isToday && nowMin > START ? Math.min(end - 30, Math.ceil(nowMin / 30) * 30) : START}
          end={end}
          onClose={() => setEdit(null)}
          onSave={(fn) => {
            setPerson(edit.name, fn);
            setEdit(null);
          }}
        />
      )}
      {edit?.kind === "mc" && (
        <McSheet
          m={m}
          st={st}
          k={edit.key}
          holder={mcHolders(st, m, now).get(edit.key)}
          onClose={() => setEdit(null)}
          onSave={(part) => {
            update((s) => ({ ...s, machines: { ...s.machines, [edit.key]: part } }));
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function shift(date: string, d: number) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}

function Section({ id, n, title, sub, children }: { id: string; n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card flex scroll-mt-20 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-500">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PersonCard({ m, p, end, onClick }: { m: PMaster; p: PPerson; end: number; onClick: () => void }) {
  const moved = spans(p, end).length > 1;
  return (
    <button onClick={onClick} className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition hover:border-brand-600 ${moved ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-white"}`}>
      <span className="font-semibold">{p.name}</span>
      <span className="text-xs text-slate-500">{describe(m, p, end)}</span>
    </button>
  );
}

function McGrid({ m, st, cat, at, onPick }: { m: PMaster; st: PlanState; cat: string; at: number; onPick: (k: string) => void }) {
  const holders = mcHolders(st, m, at);
  const list = m.machines.filter((x) => x.category === cat);
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-600">
        {cat} · {list.filter((x) => holders.has(mcKey(cat, x.mc))).length}/{list.length} MC berjalan (jam {toClock(at)})
      </div>
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
        {list.map((x) => {
          const k = mcKey(cat, x.mc);
          const who = holders.get(k);
          const part = m.parts.find((p) => p.id === st.machines[k]);
          return (
            <button
              key={k}
              onClick={() => onPick(k)}
              title={`${x.mc} · ${part?.label ?? "part belum diatur"} · ${who ?? "tanpa operator (tidak jalan)"}`}
              className={`rounded-md border px-1 py-1 text-left text-[11px] leading-tight ${who ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}
            >
              <div className="font-bold">{x.mc.replace("MC ", "")}</div>
              <div className="truncate">{part?.label ?? "-"}</div>
              <div className="truncate">{who?.split(" ")[0] ?? "kosong"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RowsTable({ m, st, res, at, end, onTarget }: { m: PMaster; st: PlanState; res: Row[]; at: number; end: number; onTarget: (key: string, step: Step, v: number) => void }) {
  if (!res.length) return <p className="py-4 text-center text-sm text-slate-400">Belum ada yang dikerjakan atau target.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm tabular-nums">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-2 py-2">Part</th>
            <th className="px-2 py-2">Proses</th>
            <th className="px-2 py-2">Dikerjakan oleh</th>
            <th className="px-2 py-2 text-right">Estimasi s/d {toClock(at)}</th>
            <th className="px-2 py-2 text-right">Target hari ini</th>
            <th className="px-2 py-2 text-right">Kurang s/d {toClock(end)}</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Saran</th>
          </tr>
        </thead>
        <tbody>
          {res.map((r) => (
            <tr key={`${r.key}#${r.step}`} className="border-b border-slate-100 align-top">
              <td className="px-2 py-2 font-semibold">{r.label}</td>
              <td className="px-2 py-2">{STEP_NAME[r.step]}</td>
              <td className="px-2 py-2 text-xs">
                {r.people.length === 0 ? (
                  <span className="font-semibold text-red-700">belum ada</span>
                ) : r.step === "pf" ? (
                  <>
                    {r.mcs.length} MC ({r.mcs.map((x) => x.replace("MC ", "")).join(", ")}) · {r.people.join(", ")}
                  </>
                ) : (
                  <>
                    {r.people.length} orang · {r.people.join(", ")}
                  </>
                )}
              </td>
              <td className="px-2 py-2 text-right font-bold">{n0(r.est)}</td>
              <td className="px-2 py-2 text-right">
                <input
                  className="input h-8 w-24 px-2 py-1 text-right text-sm"
                  inputMode="numeric"
                  defaultValue={r.need ? n0(r.need) : ""}
                  placeholder="0"
                  onBlur={(e) => num(e.target.value) !== r.need && onTarget(r.key, r.step, num(e.target.value))}
                  aria-label={`Target ${r.label} ${STEP_NAME[r.step]}`}
                />
              </td>
              <td className={`px-2 py-2 text-right ${r.short ? "font-semibold text-red-700" : "text-emerald-700"}`}>{r.short ? n0(r.short) : "0"}</td>
              <td className="px-2 py-2">
                <Badge s={r.status} small />
              </td>
              <td className="px-2 py-2 text-xs">{saran(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  function saran(r: Row) {
    if (!r.need) return <span className="text-slate-400">Isi target untuk menilai</span>;
    if (!r.short) return r.surplus ? <span className="text-sky-700">Bisa lepas {r.surplus} orang</span> : "Cukup";
    const parts: string[] = [];
    if (r.rateEnd) parts.push(`+${n1(r.extraHours)} jam lembur dengan susunan ini`);
    if (r.extraUnits) parts.push(`atau +${r.extraUnits} ${r.step === "pf" ? "MC" : "orang"} mulai sekarang`);
    if (!r.rateEnd) parts.unshift("Belum ada yang mengerjakan");
    if (r.estMaxOt < r.need) parts.push(`lembur maksimal pun kurang ${n0(r.need - r.estMaxOt)}`);
    void st;
    void m;
    return parts.join(", ");
  }
}

function AddTarget({ m, onAdd }: { m: PMaster; onAdd: (key: string, step: Step, v: number) => void }) {
  const options = useMemo(() => {
    const seen = new Map<string, { key: string; step: Step; label: string }>();
    for (const p of m.parts) {
      const step = m.cats.find((c) => c.name === p.category)?.step;
      if (!step || !p.rate) continue;
      const k = `${p.key}#${step}`;
      if (!seen.has(k)) seen.set(k, { key: p.key, step, label: `${p.label} · ${STEP_NAME[step]} (${p.category.replace(/ Cage$/, "")})` });
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [m]);
  const [sel, setSel] = useState("");
  const [qty, setQty] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
      <label className="flex min-w-60 flex-1 flex-col text-sm">
        <span className="label">Tambah target part lain</span>
        <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Pilih part & proses…</option>
          {options.map((o) => (
            <option key={`${o.key}#${o.step}`} value={`${o.key}#${o.step}`}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-36 flex-col text-sm">
        <span className="label">Qty (pcs)</span>
        <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      <button
        className="btn-secondary"
        disabled={!sel || !num(qty)}
        onClick={() => {
          const [key, step] = sel.split("#") as [string, Step];
          onAdd(key, step, num(qty));
          setSel("");
          setQty("");
        }}
      >
        Tambah
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
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

function PersonSheet({ m, st, name, defaultAt, end, onClose, onSave }: { m: PMaster; st: PlanState; name: string; defaultAt: number; end: number; onClose: () => void; onSave: (fn: (p: PPerson) => PPerson) => void }) {
  const p = st.people.find((x) => x.name === name)!;
  const cur = spans(p, end).filter((x) => x.cat);
  const [absent, setAbsent] = useState(p.absent ?? "");
  const [at, setAt] = useState(cur.length ? defaultAt : START);
  const first = cur[cur.length - 1];
  const [cat, setCat] = useState(first?.cat ?? "");
  const [part, setPart] = useState(first?.part ?? "");
  const [mcs, setMcs] = useState<string[]>(first?.mcs ?? []);
  const c = m.cats.find((x) => x.name === cat);
  const holders = mcHolders(st, m, at, name);
  const limit = c ? (m.maxMc[c.name] ?? 3) : 0;
  const seg: Seg | null = !cat ? null : c?.mc ? { at, cat, mcs } : { at, cat, part };

  // Dampak sebelum -> sesudah pada baris yang tersentuh.
  const preview = useMemo(() => {
    if (absent) return null;
    const after: PPerson = seg ? assign(p, seg) : release(p, at);
    const st2 = { ...st, people: st.people.map((x) => (x.name === name ? { ...after, absent: undefined } : x)) };
    const a = compute(m, st, end);
    const b = compute(m, st2, end);
    const keys = new Set([...a.rows, ...b.rows].filter((r) => r.people.includes(name)).map((r) => `${r.key}#${r.step}`));
    return [...keys].map((k) => ({ before: a.rows.find((r) => `${r.key}#${r.step}` === k), after: b.rows.find((r) => `${r.key}#${r.step}` === k) }));
  }, [absent, seg, p, at, st, name, m, end]);

  const parts = m.parts.filter((x) => x.category === cat);
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="label">Kehadiran</div>
          <div className="flex flex-wrap gap-1.5">
            {["", ...ALASAN].map((a) => (
              <button key={a || "masuk"} onClick={() => setAbsent(a)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${absent === a ? (a ? "bg-red-600 text-white" : "bg-emerald-600 text-white") : "border border-slate-200 bg-white"}`}>
                {a || "Masuk"}
              </button>
            ))}
          </div>
        </div>
        {!absent && (
          <>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Sekarang: </span>
              {describe(m, p, end)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="label">Mulai jam</span>
                <select className="input" value={at} onChange={(e) => setAt(Number(e.target.value))}>
                  {slots(end).map((t) => (
                    <option key={t} value={t}>
                      {toClock(t)}
                      {t === START ? " (sepanjang hari)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="label">Kerjakan di</span>
                <select
                  className="input"
                  value={cat}
                  onChange={(e) => {
                    setCat(e.target.value);
                    setPart("");
                    setMcs([]);
                  }}
                >
                  <option value="">Cadangan (tidak ditugaskan)</option>
                  {m.cats.map((x) => (
                    <option key={x.name} value={x.name}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {c && !c.mc && (
              <label className="flex flex-col text-sm">
                <span className="label">Part</span>
                <select className="input" value={part} onChange={(e) => setPart(e.target.value)}>
                  <option value="">Pilih part…</option>
                  {parts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label} · {n0(x.rate * (m.eff[x.category] ?? 1))} pcs/jam
                    </option>
                  ))}
                </select>
              </label>
            )}
            {c?.mc && (
              <div>
                <div className="label">
                  MC yang dipegang ({mcs.length}/{limit} maks)
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {m.machines
                    .filter((x) => x.category === cat)
                    .map((x) => {
                      const k = mcKey(cat, x.mc);
                      const other = holders.get(k);
                      const on = mcs.includes(x.mc);
                      const full = !on && mcs.length >= limit;
                      const part = m.parts.find((q) => q.id === st.machines[k]);
                      return (
                        <button
                          key={k}
                          disabled={!!other || full}
                          onClick={() => setMcs(on ? mcs.filter((y) => y !== x.mc) : [...mcs, x.mc])}
                          title={other ? `Dipegang ${other} jam ${toClock(at)}` : full ? `Batas ${limit} MC per operator` : (part?.label ?? "")}
                          className={`rounded-md border px-1 py-1.5 text-left text-[11px] leading-tight disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white"}`}
                        >
                          <div className="font-bold">{x.mc.replace("MC ", "MC")}</div>
                          <div className="truncate">{other ? other.split(" ")[0] : (part?.label ?? "-")}</div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
            {preview && preview.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-1 font-semibold">Dampak s/d {toClock(end)}</div>
                {preview.map((x, i) => {
                  const r = x.after ?? x.before!;
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                      <span>
                        {STEP_NAME[r.step]} {r.label}
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        {n0(x.before?.estEnd ?? 0)} → <b>{n0(x.after?.estEnd ?? 0)}</b> pcs
                        {x.after && <Badge s={x.after.status} small />}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary flex-1"
            disabled={!absent && !!cat && (c?.mc ? !mcs.length : !part)}
            onClick={() =>
              onSave((x) => {
                if (absent) return { ...x, absent };
                const y = { ...x, absent: undefined };
                return seg ? assign(y, seg) : release(y, at);
              })
            }
          >
            {absent ? "Simpan kehadiran" : at > START && cur.length ? `Pindah mulai ${toClock(at)}` : "Simpan"}
          </button>
          {cur.length > 1 && !absent && (
            <button className="btn-secondary" onClick={() => onSave((x) => ({ ...x, segs: [x.segs.slice().sort((a, b) => a.at - b.at)[0]] }))}>
              Hapus jadwal pindah
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function McSheet({ m, st, k, holder, onClose, onSave }: { m: PMaster; st: PlanState; k: string; holder?: string; onClose: () => void; onSave: (part: string) => void }) {
  const mc = m.machines.find((x) => mcKey(x.category, x.mc) === k)!;
  const [part, setPart] = useState(st.machines[k] ?? "");
  const all = m.parts.filter((p) => p.category === mc.category);
  const opts = mc.opts.length ? all.filter((p) => mc.opts.includes(p.id)) : all;
  const others = all.filter((p) => !opts.includes(p));
  return (
    <Sheet title={`${mc.category} ${mc.mc}`} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="text-slate-600">Operator: {holder ?? <span className="font-semibold text-slate-400">tidak ada (MC tidak jalan). Tugaskan operator lewat kartu orang.</span>}</div>
        <label className="flex flex-col">
          <span className="label">Part di MC ini</span>
          <select className="input" value={part} onChange={(e) => setPart(e.target.value)}>
            <option value="">Belum diatur</option>
            <optgroup label="Part utama / Bisa ganti ke (Master Data)">
              {opts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {n0(p.rate * (m.eff[p.category] ?? 1))} pcs/jam
                </option>
              ))}
            </optgroup>
            {others.length > 0 && mc.opts.length > 0 && (
              <optgroup label="Lainnya (di luar Master Data, akan diberi peringatan)">
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button className="btn-primary" onClick={() => onSave(part)}>
          Simpan
        </button>
      </div>
    </Sheet>
  );
}
