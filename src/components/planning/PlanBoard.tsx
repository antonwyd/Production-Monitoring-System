"use client";
// Rencana manpower, versi papan (masukan Anton 11 Nov): visualisasi lantai di atas, lalu papan per proses & type.
// Atur orang: ketuk nama (bisa beberapa) -> ketuk type tujuan. Di komputer bisa juga seret nama ke type.
// Semua perubahan berlaku mulai "jam" yang dipilih di atas papan (default sekarang).
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  assign,
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
  toClock,
  type PCat,
  type PlanState,
  type PMaster,
  type PPart,
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
const first = (name: string) => name.split(" ")[0];
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

const COLOR: Record<Step, string> = { pf: "#2563eb", seiretsu: "#d97706", senbetsu: "#059669" };
const SOFT: Record<Step, string> = { pf: "#eff6ff", seiretsu: "#fffbeb", senbetsu: "#ecfdf5" };
const WORD: Record<Status, string> = { SAFE: "Cukup", WARNING: "Mepet", CRITICAL: "Kurang" };
const PILL: Record<Status, string> = { SAFE: "bg-emerald-100 text-emerald-800", WARNING: "bg-amber-100 text-amber-800", CRITICAL: "bg-red-100 text-red-800" };
const BAR: Record<Status, string> = { SAFE: "bg-emerald-500", WARNING: "bg-amber-500", CRITICAL: "bg-red-500" };

type Where = { cat: string; part: string } | null;

export default function PlanBoard({ page, today, nowMin, canSave }: { page: PlanPage; today: string; nowMin: number; canSave: boolean }) {
  // Shield tidak direncanakan di sini (permintaan Anton 11 Nov).
  const m = useMemo(() => {
    const b = buildMaster(page.raw);
    const cats = b.cats.filter((c) => !/shield/i.test(c.name));
    const ok = new Set(cats.map((c) => c.name));
    return { ...b, cats, parts: b.parts.filter((p) => ok.has(p.category)), machines: b.machines.filter((x) => ok.has(x.category)) };
  }, [page.raw]);
  const okCat = (s: PlanState): PlanState => ({ ...s, people: s.people.map((p) => ({ ...p, segs: p.segs.filter((x) => !x.cat || m.cats.some((c) => c.name === x.cat)) })) });
  // Belum ada rencana tersimpan: semua orang mulai di panel kiri (belum bekerja).
  const base = useMemo(() => (page.saved ? okCat(page.state) : { ...page.state, people: page.state.people.map((p) => ({ ...p, segs: [] })) }), [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const [st, setSt] = useState<PlanState>(base);
  const isToday = st.date === today;
  const nEnd = normalEnd(m);
  const nowSlot = isToday && nowMin > START ? Math.min(nEnd - 60, Math.floor(nowMin / 60) * 60) : START;
  const [at, setAt] = useState(nowSlot);
  const [sel, setSel] = useState<string[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ cat: string; n: number } | undefined>();
  // Type yang dikerjakan di hari kerja terakhir tampil sebagai tempat tujuan (masih kosong), supaya bisa langsung diseret.
  const [extra, setExtra] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    const add = (cat: string, pid: string) => pid && m.parts.some((p) => p.id === pid) && !(out[cat] ??= []).includes(pid) && out[cat].push(pid);
    for (const p of page.state.people) for (const g of p.segs) if (g.cat) g.mcs?.length ? g.mcs.forEach((x) => add(g.cat, page.state.machines[mcKey(g.cat, x)] ?? "")) : add(g.cat, g.part ?? "");
    return out;
  });
  const [sheet, setSheet] = useState<null | "dest" | "hadir" | { addType: string } | { target: Row }>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(page.saved);
  const end = dayEnd(m, st.ot);
  const now = isToday ? Math.max(START, nowMin) : START;
  const res = useMemo(() => compute(m, st, end, now), [m, st, end, now]);

  const update = (fn: (s: PlanState) => PlanState) => {
    setSt((s) => fn(s));
    setDirty(true);
    setMsg(null);
  };

  // Posisi tiap orang pada jam `at`.
  const where = useMemo(() => {
    const out = new Map<string, Where>();
    for (const p of st.people) {
      if (p.absent) continue;
      const s = spans(p, end).find((x) => x.at <= at && at < x.to);
      if (!s || !s.cat) {
        out.set(p.name, null);
        continue;
      }
      const part = s.mcs?.length ? (st.machines[mcKey(s.cat, s.mcs[0])] ?? "") : (s.part ?? "");
      out.set(p.name, { cat: s.cat, part });
    }
    return out;
  }, [st, end, at]);

  /** Pindahkan orang-orang ke (kategori, type) mulai jam `at`. PF: MC dipilih otomatis. */
  function moveTo(names: string[], cat: string, part: string) {
    const c = m.cats.find((x) => x.name === cat)!;
    setFocus((f) => ({ cat, n: (f?.n ?? 0) + 1 }));
    update((s) => {
      let machines = s.machines;
      const people = [...s.people];
      for (const name of names) {
        const i = people.findIndex((x) => x.name === name);
        if (i < 0) continue;
        let seg;
        if (c.mc) {
          const tmp = { ...s, machines, people };
          const busyMc = mcHolders(tmp, m, at, name);
          const limit = m.maxMc[cat] ?? 3;
          const cand = m.machines
            .filter((x) => x.category === cat && !busyMc.get(mcKey(cat, x.mc)) && (machines[mcKey(cat, x.mc)] === part || x.opts.includes(part)))
            .sort((a, b) => Number(machines[mcKey(cat, b.mc)] === part) - Number(machines[mcKey(cat, a.mc)] === part))
            .slice(0, limit)
            .map((x) => x.mc);
          if (!cand.length) {
            setMsg({ kind: "err", text: `Tidak ada MC kosong untuk ${partLabel(m, part)} di ${cat}.` });
            continue;
          }
          machines = { ...machines, ...Object.fromEntries(cand.map((x) => [mcKey(cat, x), part])) };
          seg = { at, cat, mcs: cand };
        } else seg = { at, cat, part };
        people[i] = assign({ ...people[i], absent: undefined }, seg);
      }
      return { ...s, machines, people };
    });
    setSel([]);
    setSheet(null);
  }
  const unassign = (names: string[]) => {
    update((s) => ({ ...s, people: s.people.map((p) => (names.includes(p.name) ? release({ ...p, absent: undefined }, at) : p)) }));
    setSel([]);
  };
  const setAbsent = (names: string[], a: string) => {
    update((s) => ({ ...s, people: s.people.map((p) => (names.includes(p.name) ? { ...p, absent: a || undefined } : p)) }));
    setSel([]);
  };
  /** Lembur untuk orang terpilih sampai jam `until` (16:00 = tidak lembur). */
  const setOt = (names: string[], until: number) => {
    update((s) => {
      const s2 = until > dayEnd(m, s.ot) ? extendOt(m, s, until - nEnd) : s;
      const e = dayEnd(m, s2.ot);
      return {
        ...s2,
        people: s2.people.map((p) => {
          if (!names.includes(p.name)) return p;
          const segs = p.segs.filter((x) => !(x.at >= nEnd && !x.cat));
          const out = { ...p, segs };
          return until < e ? release(out, until) : out;
        }),
      };
    });
    setSel([]);
  };
  const toggle = (name: string) => setSel((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const changes = st.people.filter((p) => {
    const o = base.people.find((x) => x.name === p.name);
    const sig = (x: PPerson, e: number) => JSON.stringify(spans(x, e).filter((s) => s.cat));
    return !o || sig(o, dayEnd(m, base.ot)) !== sig(p, end) || !!o.absent !== !!p.absent;
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

  // Grup per kategori -> type.
  const lanes = m.cats.map((c) => {
    const byPart = new Map<string, string[]>();
    for (const [name, w] of where) if (w && w.cat === c.name) byPart.set(w.part, [...(byPart.get(w.part) ?? []), name]);
    for (const pid of extra[c.name] ?? []) if (!byPart.has(pid)) byPart.set(pid, []);
    const groups = [...byPart.entries()].map(([pid, names]) => ({ pid, names: names.sort(), row: rowFor(m, res, c, pid) })).sort((a, b) => b.names.length - a.names.length || partLabel(m, a.pid).localeCompare(partLabel(m, b.pid)));
    return { c, groups, count: groups.reduce((s, g) => s + g.names.length, 0) };
  });
  const pool = [...where.entries()].filter(([, w]) => !w).map(([n]) => n).sort();
  const absent = st.people.filter((p) => p.absent);
  const hours: number[] = [];
  for (let t = START; t < end; t += 60) if (t !== 12 * 60) hours.push(t);

  const dropProps = (cat: string, pid: string) => ({
    onDragOver: (e: React.DragEvent) => drag && e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (!drag) return;
      moveTo(sel.includes(drag) ? sel : [drag], cat, pid);
      setDrag(null);
    },
  });
  const chip = (name: string, color?: string, full?: boolean) => {
    const on = sel.includes(name);
    return (
      <button
        key={name}
        draggable
        onDragStart={() => setDrag(name)}
        onDragEnd={() => setDrag(null)}
        onClick={() => toggle(name)}
        className={`group flex items-center gap-1.5 rounded-full border bg-white py-1 pl-1 pr-3 text-left text-sm font-medium shadow-sm transition active:scale-95 ${full ? "w-full" : ""} ${on ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 hover:border-slate-400"}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: on ? "#0f172a" : (color ?? "#94a3b8") }}>
          {on ? "✓" : initials(name)}
        </span>
        <span className="truncate">{full ? name : first(name)}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-36 pt-4 sm:px-6 lg:h-[100dvh] lg:overflow-hidden lg:pb-3">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rencana manpower</div>
          <h1 className="text-xl font-bold tracking-tight">{tgl(st.date)}</h1>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">Mulai jam</span>
          <div className="flex gap-1 overflow-x-auto">
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => setAt(h)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums transition ${at === h ? "bg-slate-900 text-white shadow" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400"}`}
              >
                {toClock(h)}
                {h === nowSlot && isToday ? " •" : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link className="btn-secondary h-9 w-9 px-0" href={`/perencanaan?date=${shift(st.date, -1)}`} aria-label="Hari sebelumnya">
            ‹
          </Link>
          <Link className="btn-secondary h-9 w-9 px-0" href={`/perencanaan?date=${shift(st.date, 1)}`} aria-label="Hari berikutnya">
            ›
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Kiri: semua member yang belum bekerja */}
        <aside
          className={`flex max-h-80 min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 lg:max-h-none ${drag ? "ring-2 ring-slate-400" : "ring-slate-200"}`}
          onDragOver={(e) => drag && e.preventDefault()}
          onDrop={() => drag && (unassign(sel.includes(drag) ? sel : [drag]), setDrag(null))}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-bold">Belum bekerja</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{pool.length}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Seret atau ketuk nama, lalu ketuk type tujuan.</div>
            {!page.saved && pool.length === st.people.length - absent.length && page.state.people.some((p) => p.segs.length) && (
              <button className="mt-2 w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200" onClick={() => update(() => okCat(page.state))}>
                Isi seperti hari kerja terakhir
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
            {pool.length ? pool.map((n) => chip(n, undefined, true)) : <span className="py-6 text-center text-sm text-slate-400">Semua sudah bekerja</span>}
          </div>
          <button className="border-t border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setSheet("hadir")}>
            {absent.length ? <span className="text-red-600">{absent.length} tidak masuk: {absent.map((p) => first(p.name)).join(", ")}</span> : "Atur kehadiran (tidak masuk)"}
          </button>
        </aside>

        <div className="flex min-h-0 flex-col gap-3">
          <section className="card shrink-0 overflow-hidden p-3">
            <FloorView key={`${at}`} m={m} st={st} initialAt={at} focus={focus} compact maxH={230} />
          </section>

          <section className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map(({ c, groups, count }) => (
              <div key={c.name} className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex shrink-0 items-center justify-between px-4 py-2.5" style={{ background: SOFT[c.step], borderTop: `4px solid ${COLOR[c.step]}` }}>
                  <div>
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {count} orang{c.mc ? ` · ${countMc(st, m, c.name, at)} MC jalan` : ""}
                    </div>
                  </div>
                  <button className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-slate-200" onClick={() => setSheet({ addType: c.name })}>
                    + Type
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
                  {groups.length === 0 && (
                    <button className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400" onClick={() => setSheet({ addType: c.name })}>
                      + Pilih type
                    </button>
                  )}
                  {groups.map(({ pid, names, row }) => {
                    const target = sel.length > 0 || !!drag;
                    return (
                      <div
                        key={pid}
                        {...dropProps(c.name, pid)}
                        className={`rounded-xl border p-2.5 transition ${target ? "cursor-pointer border-slate-400 border-dashed bg-slate-50 hover:bg-slate-100" : "border-slate-100"}`}
                        onClick={(e) => {
                          if (sel.length && e.target === e.currentTarget) moveTo(sel, c.name, pid);
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2" onClick={() => sel.length && moveTo(sel, c.name, pid)}>
                          <span className="whitespace-nowrap font-semibold">{partLabel(m, pid) || "Type belum diatur"}</span>
                          {sel.length ? (
                            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">Pindah ke sini</span>
                          ) : (
                            row && (
                              <button
                                className="text-right text-xs tabular-nums text-slate-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSheet({ target: row });
                                }}
                              >
                                ≈ {n0(row.estEnd)} pcs
                                {row.need > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-semibold ${PILL[row.status]}`}>{WORD[row.status]}</span>}
                              </button>
                            )
                          )}
                        </div>
                        {row && row.need > 0 && (
                          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full ${BAR[row.status]}`} style={{ width: `${Math.min(100, (row.estEnd / row.need) * 100)}%` }} />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">{names.length ? names.map((n) => chip(n, COLOR[c.step])) : <span className="text-xs text-slate-400">Seret nama ke sini</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      {saved && !dirty && !msg && (
        <p className="text-center text-xs text-slate-400">
          Tersimpan oleh {saved.by} · {saved.at}
        </p>
      )}
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</div>}

      {/* Bar bawah: pilihan orang atau simpan */}
      {(sel.length > 0 || dirty) && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-4 lg:pl-[calc(var(--sb-w)+1rem)]">
          <div className="mx-auto max-w-3xl rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl">
            {sel.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <b>{sel.length} dipilih</b> · ketuk type tujuan, mulai {toClock(at)}
                  </span>
                  <button className="text-slate-300 underline" onClick={() => setSel([])}>
                    Batal
                  </button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto">
                  <button className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-900" onClick={() => setSheet("dest")}>
                    Pindah ke…
                  </button>
                  <button className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold" onClick={() => unassign(sel)}>
                    Lepas tugas
                  </button>
                  {[17, 18, 19].map((h) => (
                    <button key={h} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold" onClick={() => setOt(sel, h * 60)}>
                      Lembur s/d {h}:00
                    </button>
                  ))}
                  <button className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold" onClick={() => setOt(sel, nEnd)}>
                    Pulang 16:00
                  </button>
                  {ALASAN.map((a) => (
                    <button key={a} className="shrink-0 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200" onClick={() => setAbsent(sel, a)}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{changes} orang diubah</span>
                {canSave ? (
                  <button className="btn-primary h-10 px-5" disabled={busy} onClick={save}>
                    {busy ? "Menyimpan…" : "Simpan rencana"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">Hanya leader/admin yang bisa menyimpan</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {sheet === "dest" && (
        <Sheet title={`Pindahkan ${sel.length === 1 ? first(sel[0]) : `${sel.length} orang`} mulai ${toClock(at)}`} onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-4">
            {m.cats.map((c) => {
              const lane = lanes.find((l) => l.c.name === c.name)!;
              const opts = typeOpts(m, c, lane.groups.map((g) => g.pid));
              const cnt = (pid: string) => lane.groups.find((g) => g.pid === pid)?.names.length ?? 0;
              return (
                <div key={c.name}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[c.step] }} />
                    {c.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => moveTo(sel, c.name, p.id)}
                        className="rounded-xl border px-3 py-2 text-sm font-semibold hover:border-slate-900"
                        style={cnt(p.id) ? { background: SOFT[c.step], borderColor: COLOR[c.step] } : { borderColor: "#e2e8f0" }}
                      >
                        {p.label}
                        {cnt(p.id) > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">{cnt(p.id)} org</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
      {sheet && typeof sheet === "object" && "addType" in sheet && (
        <Sheet title={`Tambah type di ${sheet.addType}`} onClose={() => setSheet(null)}>
          <div className="flex flex-wrap gap-1.5">
            {typeOpts(m, m.cats.find((c) => c.name === sheet.addType)!, []).map((p) => (
              <button
                key={p.id}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-slate-900"
                onClick={() => {
                  if (sel.length) moveTo(sel, sheet.addType, p.id);
                  else setExtra((x) => ({ ...x, [sheet.addType]: [...(x[sheet.addType] ?? []), p.id] }));
                  setSheet(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet && typeof sheet === "object" && "target" in sheet && (
        <TargetSheet
          row={sheet.target}
          onClose={() => setSheet(null)}
          onSave={(v) => {
            const r = sheet.target;
            update((s) => ({ ...s, targets: { ...s.targets, [r.key]: { ...s.targets[r.key], [r.step]: v } } }));
            setSheet(null);
          }}
        />
      )}
      {sheet === "hadir" && <HadirSheet st={st} onClose={() => setSheet(null)} onSet={(name, a) => setAbsent([name], a)} />}
    </div>
  );
}

const partLabel = (m: PMaster, pid: string) => m.parts.find((p) => p.id === pid)?.label ?? "";
const rowFor = (m: PMaster, res: Result, c: PCat, pid: string) => {
  const p = m.parts.find((x) => x.id === pid);
  return p ? res.rows.find((r) => r.key === p.key && r.step === c.step) : undefined;
};
const typeOpts = (m: PMaster, c: PCat, current: string[]): PPart[] => {
  const all = m.parts.filter((p) => p.category === c.name && p.rate > 0);
  return [...all.filter((p) => current.includes(p.id)), ...all.filter((p) => !current.includes(p.id))];
};
const countMc = (st: PlanState, m: PMaster, cat: string, at: number) => [...mcHolders(st, m, at).keys()].filter((k) => k.startsWith(cat + "|")).length;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
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

function HadirSheet({ st, onClose, onSet }: { st: PlanState; onClose: () => void; onSet: (name: string, alasan: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const list = [...st.people].sort((a, b) => (a.absent ? 0 : 1) - (b.absent ? 0 : 1) || a.name.localeCompare(b.name));
  return (
    <Sheet title="Kehadiran" onClose={onClose}>
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
        <p className="text-sm text-slate-500">Estimasi sampai pulang: {n0(row.estEnd)} pcs.</p>
        <input className="input text-lg" inputMode="numeric" placeholder="Target hari ini (pcs)" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <button className="btn-primary" onClick={() => onSave(num(qty))}>
          Simpan target
        </button>
      </div>
    </Sheet>
  );
}
