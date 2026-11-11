"use client";
// Rencana manpower (papan). Masukan Anton 11 Nov:
//  - satu layar penuh, member belum bekerja di kiri, seret ke proses & type di kanan;
//  - animasi lantai di atas ikut berubah; target diisi langsung di rencana (tidak dari PO/Forecast).
// Semua perubahan berlaku mulai "jam" yang dipilih di bar atas (default jam sekarang).
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
const k0 = (v: number) => (v >= 10000 ? `${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: v >= 100000 ? 0 : 1 })}rb` : n0(v));
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return `${HARI[t.getUTCDay()]}, ${t.getUTCDate()} ${BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
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

/** Warna per proses: tegas untuk aksen, lembut untuk latar. */
const COLOR: Record<Step, string> = { pf: "#2563eb", seiretsu: "#d97706", senbetsu: "#059669" };
const TINT: Record<Step, string> = { pf: "#dbeafe", seiretsu: "#fef3c7", senbetsu: "#d1fae5" };
const SOFT: Record<Step, string> = { pf: "#f5f9ff", seiretsu: "#fffcf2", senbetsu: "#f3fdf8" };
const ICON: Record<Step, string> = { pf: "⚙", seiretsu: "≡", senbetsu: "◎" };
const WORD: Record<Status, string> = { SAFE: "Cukup", WARNING: "Mepet", CRITICAL: "Kurang" };
const PILL: Record<Status, string> = { SAFE: "bg-emerald-50 text-emerald-700 ring-emerald-200", WARNING: "bg-amber-50 text-amber-700 ring-amber-200", CRITICAL: "bg-red-50 text-red-700 ring-red-200" };

type Where = { cat: string; part: string; mcs: string[]; next?: string; ot?: number } | null;

export default function PlanBoard({ page, today, nowMin, canSave }: { page: PlanPage; today: string; nowMin: number; canSave: boolean }) {
  // Shield tidak direncanakan di sini.
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
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [floor, setFloor] = useState(true);
  const [focus, setFocus] = useState<{ cat: string; n: number } | undefined>();
  // Type hari kerja terakhir tampil sebagai tujuan kosong, supaya bisa langsung diseret.
  const [extra, setExtra] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    const add = (cat: string, pid: string) => pid && m.parts.some((p) => p.id === pid) && !(out[cat] ??= []).includes(pid) && out[cat].push(pid);
    for (const p of page.state.people) for (const g of p.segs) if (g.cat) g.mcs?.length ? g.mcs.forEach((x) => add(g.cat, page.state.machines[mcKey(g.cat, x)] ?? "")) : add(g.cat, g.part ?? "");
    return out;
  });
  const [sheet, setSheet] = useState<null | "dest" | "hadir" | "mc" | { addType: string }>(null);
  const [hist, setHist] = useState<PlanState[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(page.saved);
  const end = dayEnd(m, st.ot);
  const now = isToday ? Math.max(START, nowMin) : START;
  const res = useMemo(() => compute(m, st, end, now), [m, st, end, now]);

  const update = (fn: (s: PlanState) => PlanState) => {
    setHist((h) => [...h.slice(-40), st]);
    setSt((s) => fn(s));
    setDirty(true);
    setMsg(null);
  };

  // Posisi tiap orang pada jam `at`, plus perubahan berikutnya dan jam pulang bila lembur.
  const where = useMemo(() => {
    const out = new Map<string, Where>();
    for (const p of st.people) {
      if (p.absent) continue;
      const sp = spans(p, end);
      const s = sp.find((x) => x.at <= at && at < x.to);
      if (!s || !s.cat) {
        out.set(p.name, null);
        continue;
      }
      const part = s.mcs?.length ? (st.machines[mcKey(s.cat, s.mcs[0])] ?? "") : (s.part ?? "");
      const nx = sp.find((x) => x.at > at && (x.cat !== s.cat || (x.part ?? "") !== (s.part ?? "") || (x.mcs ?? []).join() !== (s.mcs ?? []).join()));
      const last = sp.filter((x) => x.cat).at(-1);
      let next: string | undefined;
      if (nx && nx.at < nEnd) {
        const c2 = m.cats.find((c) => c.name === nx.cat);
        next = nx.cat ? `${toClock(nx.at)} ${c2 ? STEP_NAME[c2.step] : nx.cat} ${nx.mcs?.length ? "" : partLabel(m, nx.part ?? "")}`.trim() : `${toClock(nx.at)} lepas`;
      }
      out.set(p.name, { cat: s.cat, part, mcs: s.mcs ?? [], next, ot: last && last.to > nEnd ? last.to : undefined });
    }
    return out;
  }, [st, end, at, m, nEnd]);

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
          const busyMc = mcHolders({ ...s, machines, people }, m, at, name);
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
  /** Lembur orang terpilih sampai jam `until` (16:00 = tidak lembur). */
  const setOt = (names: string[], until: number) => {
    update((s) => {
      const s2 = until > dayEnd(m, s.ot) ? extendOt(m, s, until - nEnd) : s;
      const e = dayEnd(m, s2.ot);
      return {
        ...s2,
        people: s2.people.map((p) => {
          if (!names.includes(p.name)) return p;
          const out = { ...p, segs: p.segs.filter((x) => !(x.at >= nEnd && !x.cat)) };
          return until < e ? release(out, until) : out;
        }),
      };
    });
    setSel([]);
  };
  const undo = () => {
    const prev = hist.at(-1);
    if (!prev) return;
    setHist((h) => h.slice(0, -1));
    setSt(prev);
    setSel([]);
    setMsg(null);
  };
  const setMcs = (name: string, cat: string, part: string, mcs: string[]) => {
    update((s) => ({
      ...s,
      machines: { ...s.machines, ...Object.fromEntries(mcs.filter((x) => !s.machines[mcKey(cat, x)]).map((x) => [mcKey(cat, x), part])) },
      people: s.people.map((p) => (p.name === name ? (mcs.length ? assign(p, { at, cat, mcs }) : release(p, at)) : p)),
    }));
    setSheet(null);
    setSel([]);
  };
  const setTarget = (key: string, step: Step, v: number) => update((s) => ({ ...s, targets: { ...s.targets, [key]: { ...s.targets[key], [step]: v } } }));
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

  // Lajur per proses -> kartu per type.
  const lanes = m.cats.map((c) => {
    const byPart = new Map<string, string[]>();
    for (const [name, w] of where) if (w && w.cat === c.name) byPart.set(w.part, [...(byPart.get(w.part) ?? []), name]);
    for (const pid of extra[c.name] ?? []) if (!byPart.has(pid)) byPart.set(pid, []);
    const groups = [...byPart.entries()]
      .map(([pid, names]) => ({ pid, names: names.sort(), row: rowFor(m, res, c, pid) }))
      .sort((a, b) => b.names.length - a.names.length || partLabel(m, a.pid).localeCompare(partLabel(m, b.pid)));
    const mcRun = c.mc ? countMc(st, m, c.name, at) : 0;
    return { c, groups, count: groups.reduce((s, g) => s + g.names.length, 0), mcRun, mcAll: m.machines.filter((x) => x.category === c.name).length };
  });
  const pool = [...where.entries()].filter(([, w]) => !w).map(([n]) => n).sort();
  const shown = q ? pool.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : pool;
  const absent = st.people.filter((p) => p.absent);
  const working = st.people.length - absent.length - pool.length;
  const otCount = [...where.values()].filter((w) => w?.ot).length;
  const hours: number[] = [];
  for (let t = START; t < end; t += 60) if (t !== 12 * 60) hours.push(t);
  const moving = sel.length > 0 || !!drag;

  const dropProps = (id: string, onDrop: (names: string[]) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!drag) return;
      e.preventDefault();
      if (over !== id) setOver(id);
    },
    onDragLeave: () => over === id && setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (drag) onDrop(sel.includes(drag) ? sel : [drag]);
      setDrag(null);
      setOver(null);
    },
  });

  const chip = (name: string, step?: Step, wide?: boolean) => {
    const on = sel.includes(name);
    const w = where.get(name);
    const hasSub = !!(w?.mcs.length || w?.ot || w?.next);
    return (
      <button
        key={name}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDrag(name);
        }}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          toggle(name);
        }}
        title={name}
        className={`group flex cursor-grab items-center gap-2 rounded-xl border bg-white py-1.5 pl-1.5 pr-3 text-left text-[13px] font-medium shadow-[0_1px_2px_rgba(15,23,42,.06)] transition hover:-translate-y-px hover:shadow-md active:cursor-grabbing ${wide ? "w-full" : ""} ${on ? "border-slate-900 ring-2 ring-slate-900/80" : "border-slate-200"} ${drag === name ? "opacity-40" : ""}`}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
          style={on ? { background: "#0f172a", color: "#fff" } : step ? { background: TINT[step], color: COLOR[step] } : { background: "#f1f5f9", color: "#475569" }}
        >
          {on ? "✓" : initials(name)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-slate-800">{wide ? name : first(name)}</span>
          {hasSub && (
            <span className="flex flex-wrap gap-x-1.5 text-[10.5px] font-semibold">
              {w?.mcs.length ? <span className="text-slate-500">MC {w.mcs.map((x) => x.replace("MC ", "")).join(",")}</span> : null}
              {w?.ot ? <span className="text-amber-600">⏱ {toClock(w.ot)}</span> : null}
              {w?.next ? <span className="text-violet-600">→ {w.next}</span> : null}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 px-3 pb-36 pt-3 sm:px-5 lg:h-[100dvh] lg:overflow-hidden lg:pb-3">
      {/* Bar atas: tanggal, jam berlaku, ringkasan, simpan */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <Link className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" href={`/perencanaan?date=${shift(st.date, -1)}`} aria-label="Hari sebelumnya">
            ‹
          </Link>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Rencana manpower</div>
            <h1 className="text-[15px] font-bold leading-tight text-slate-900">{tgl(st.date)}</h1>
          </div>
          <Link className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" href={`/perencanaan?date=${shift(st.date, 1)}`} aria-label="Hari berikutnya">
            ›
          </Link>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Berlaku mulai</span>
          <div className="flex gap-0.5 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => setAt(h)}
                className={`relative shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold tabular-nums transition ${at === h ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {toClock(h)}
                {h === nowSlot && isToday && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" title="Sekarang" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-[12px]">
          <Stat label="Bekerja" value={working} />
          <Stat label="Belum" value={pool.length} tone={pool.length ? "text-sky-600" : ""} />
          <Stat label="Tidak masuk" value={absent.length} tone={absent.length ? "text-red-600" : ""} />
          <Stat label="Lembur" value={otCount} tone={otCount ? "text-amber-600" : ""} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saved && !dirty && <span className="hidden text-[11px] text-slate-400 xl:inline">Tersimpan · {saved.by}</span>}
          <button className="h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={!hist.length} onClick={undo} title="Batalkan langkah terakhir">
            ↶ Batal
          </button>
          {canSave && (
            <button className="btn-primary h-9 px-4 text-sm" disabled={busy || !dirty} onClick={save}>
              {busy ? "Menyimpan…" : dirty ? `Simpan (${changes})` : "Tersimpan"}
            </button>
          )}
        </div>
      </header>
      {msg && <div className={`rounded-xl px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</div>}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Kiri: member belum bekerja */}
        <aside
          {...dropProps("pool", (names) => unassign(names))}
          className={`flex max-h-96 min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition lg:max-h-none ${over === "pool" ? "ring-2 ring-sky-400" : "ring-slate-200"}`}
        >
          <div className="px-4 pb-2 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold">Belum bekerja</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">{pool.length}</span>
            </div>
            <p className="text-[11.5px] leading-snug text-slate-500">Seret nama ke type di kanan. Bisa pilih beberapa sekaligus.</p>
            <input className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[13px] outline-none focus:border-slate-400 focus:bg-white" placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} />
            {!page.saved && pool.length === st.people.length - absent.length && page.state.people.some((p) => p.segs.length) && (
              <button className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-slate-500" onClick={() => update(() => okCat(page.state))}>
                ⟲ Isi seperti hari kerja terakhir
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
            {shown.map((n) => chip(n, undefined, true))}
            {!pool.length && (
              <div className="grid place-items-center gap-1 py-8 text-center text-sm text-slate-400">
                <span className="text-2xl">✓</span>Semua sudah dapat tugas
              </div>
            )}
          </div>
          <button className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left text-[12px] font-semibold hover:bg-slate-50" onClick={() => setSheet("hadir")}>
            <span className={absent.length ? "truncate text-red-600" : "text-slate-500"}>{absent.length ? `Tidak masuk: ${absent.map((p) => first(p.name)).join(", ")}` : "Atur yang tidak masuk"}</span>
            <span className="text-slate-400">›</span>
          </button>
        </aside>

        <div className="flex min-h-0 flex-col gap-3">
          {/* Lantai produksi */}
          <section className="shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between px-4 pt-2.5">
              <span className="text-[13px] font-bold text-slate-700">
                Lantai produksi <span className="font-normal text-slate-400">· jam {toClock(at)}</span>
              </span>
              <button className="text-[12px] font-semibold text-slate-500 hover:text-slate-800" onClick={() => setFloor(!floor)}>
                {floor ? "Sembunyikan ▴" : "Tampilkan ▾"}
              </button>
            </div>
            {floor && (
              <div className="p-3 pt-2">
                <FloorView key={`${at}`} m={m} st={st} initialAt={at} focus={focus} compact maxH={200} />
              </div>
            )}
            {!floor && <div className="h-2" />}
          </section>

          {/* Papan per proses */}
          <section className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map(({ c, groups, count, mcRun, mcAll }) => (
              <div key={c.name} className="flex min-h-0 flex-col overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200" style={{ background: SOFT[c.step] }}>
                <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white px-3.5 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl text-base font-bold text-white" style={{ background: COLOR[c.step] }}>
                    {ICON[c.step]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-slate-900">{c.name}</div>
                    <div className="text-[11.5px] text-slate-500">
                      <b className="text-slate-700">{count}</b> orang
                      {c.mc && (
                        <>
                          {" "}
                          · <b className="text-slate-700">{mcRun}</b>/{mcAll} MC
                        </>
                      )}
                    </div>
                  </div>
                  <button className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => setSheet({ addType: c.name })} title="Tambah type">
                    + Type
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                  {groups.length === 0 && (
                    <button className="rounded-xl border-2 border-dashed border-slate-300 py-8 text-center text-[13px] font-semibold text-slate-400 hover:border-slate-400" onClick={() => setSheet({ addType: c.name })}>
                      + Pilih type yang dikerjakan
                    </button>
                  )}
                  {groups.map(({ pid, names, row }) => {
                    const id = `${c.name}|${pid}`;
                    const hot = over === id;
                    const act = page.actual?.[id] ?? 0;
                    return (
                      <div
                        key={pid}
                        {...dropProps(id, (ns) => moveTo(ns, c.name, pid))}
                        onClick={() => sel.length && moveTo(sel, c.name, pid)}
                        className={`relative rounded-xl bg-white p-3 transition ${moving ? "cursor-pointer" : ""} ${hot ? "ring-2" : "ring-1 ring-slate-200"} ${moving && !hot ? "hover:ring-2" : ""}`}
                        style={hot || moving ? ({ "--tw-ring-color": hot ? COLOR[c.step] : undefined, boxShadow: hot ? `0 0 0 4px ${TINT[c.step]}` : undefined } as React.CSSProperties) : undefined}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="whitespace-nowrap text-[14px] font-bold text-slate-900">{partLabel(m, pid) || "Type belum diatur"}</span>
                          {moving ? (
                            <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: COLOR[c.step] }}>
                              Taruh di sini
                            </span>
                          ) : row?.need ? (
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${PILL[row.status]}`}>{WORD[row.status]}</span>
                          ) : null}
                        </div>
                        <Meter step={c.step} est={row?.estEnd ?? 0} target={row?.need ?? 0} actual={act} status={row?.need ? row.status : undefined} />
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 whitespace-nowrap text-[11.5px] text-slate-500">
                          <span>
                            Estimasi <b className="tabular-nums text-slate-800">{k0(row?.estEnd ?? 0)}</b>
                          </span>
                          <span>
                            Aktual <b className="tabular-nums text-slate-800">{act ? k0(act) : "–"}</b>
                          </span>
                          <TargetInline value={row?.need ?? 0} onSave={(v) => setTarget(m.parts.find((p) => p.id === pid)!.key, c.step, v)} />
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {names.map((n) => chip(n, c.step))}
                          {!names.length && <span className="w-full rounded-lg border border-dashed border-slate-200 py-2 text-center text-[11.5px] text-slate-400">Seret nama ke sini</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* Bar aksi: hanya saat ada nama terpilih */}
      {sel.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-5 lg:pl-[calc(var(--sb-w)+1rem)]">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span>
                <b>{sel.length === 1 ? sel[0] : `${sel.length} orang`}</b> <span className="text-slate-400">· ketuk type tujuan, berlaku mulai {toClock(at)}</span>
              </span>
              <button className="text-slate-400 hover:text-white" onClick={() => setSel([])}>
                ✕ Batal pilih
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              <Act strong onClick={() => setSheet("dest")}>
                Pindah ke…
              </Act>
              {sel.length === 1 && m.cats.find((c) => c.name === where.get(sel[0])?.cat)?.mc && (
                <Act strong onClick={() => setSheet("mc")}>
                  Atur MC
                </Act>
              )}
              <Act onClick={() => unassign(sel)}>Lepas tugas</Act>
              <span className="mx-1 w-px shrink-0 bg-white/15" />
              {[17, 18, 19].map((h) => (
                <Act key={h} onClick={() => setOt(sel, h * 60)}>
                  ⏱ s/d {h}:00
                </Act>
              ))}
              <Act onClick={() => setOt(sel, nEnd)}>Tanpa lembur</Act>
              <span className="mx-1 w-px shrink-0 bg-white/15" />
              {ALASAN.map((a) => (
                <Act key={a} danger onClick={() => setAbsent(sel, a)}>
                  {a}
                </Act>
              ))}
            </div>
          </div>
        </div>
      )}

      {sheet === "dest" && (
        <Sheet title={`Pindahkan ${sel.length === 1 ? first(sel[0]) : `${sel.length} orang`} · mulai ${toClock(at)}`} onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-4">
            {lanes.map(({ c, groups }) => {
              const cnt = (pid: string) => groups.find((g) => g.pid === pid)?.names.length ?? 0;
              return (
                <div key={c.name}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                    <span className="grid h-5 w-5 place-items-center rounded-md text-[10px] text-white" style={{ background: COLOR[c.step] }}>
                      {ICON[c.step]}
                    </span>
                    {c.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {typeOpts(m, c, groups.map((g) => g.pid)).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => moveTo(sel, c.name, p.id)}
                        className="rounded-lg border px-3 py-2 text-[13px] font-semibold transition hover:border-slate-900"
                        style={cnt(p.id) ? { background: TINT[c.step], borderColor: COLOR[c.step] } : { borderColor: "#e2e8f0" }}
                      >
                        {p.label}
                        {cnt(p.id) > 0 && <span className="ml-1.5 text-[11px] font-normal text-slate-600">{cnt(p.id)} org</span>}
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
        <Sheet title={`Tambah type · ${sheet.addType}`} onClose={() => setSheet(null)}>
          <div className="flex flex-wrap gap-1.5">
            {typeOpts(m, m.cats.find((c) => c.name === sheet.addType)!, []).map((p) => (
              <button
                key={p.id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-slate-900"
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
      {sheet === "mc" && sel.length === 1 && where.get(sel[0]) && (
        <McSheet m={m} st={st} at={at} name={sel[0]} w={where.get(sel[0])!} onClose={() => setSheet(null)} onSave={(mcs) => setMcs(sel[0], where.get(sel[0])!.cat, where.get(sel[0])!.part, mcs)} />
      )}
      {sheet === "hadir" && <HadirSheet st={st} onClose={() => setSheet(null)} onSet={(name, a) => setAbsent([name], a)} />}
    </div>
  );
}

const partLabel = (m: PMaster, pid: string) => m.parts.find((p) => p.id === pid)?.label ?? "";
const rowFor = (m: PMaster, res: Result, c: PCat, pid: string): Row | undefined => {
  const p = m.parts.find((x) => x.id === pid);
  return p ? res.rows.find((r) => r.key === p.key && r.step === c.step) : undefined;
};
const typeOpts = (m: PMaster, c: PCat, current: string[]): PPart[] => {
  const all = m.parts.filter((p) => p.category === c.name && p.rate > 0);
  return [...all.filter((p) => current.includes(p.id)), ...all.filter((p) => !current.includes(p.id))];
};
const countMc = (st: PlanState, m: PMaster, cat: string, at: number) => [...mcHolders(st, m, at).keys()].filter((k) => k.startsWith(cat + "|")).length;

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col items-start leading-none">
      <span className={`text-[17px] font-bold tabular-nums ${tone || "text-slate-900"}`}>{value}</span>
      <span className="mt-0.5 text-[10.5px] font-medium text-slate-400">{label}</span>
    </div>
  );
}

function Act({ children, onClick, strong, danger }: { children: React.ReactNode; onClick: () => void; strong?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${strong ? "bg-white text-slate-900 hover:bg-slate-100" : danger ? "bg-red-500/15 text-red-200 hover:bg-red-500/25" : "bg-white/10 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );
}

/** Satu batang: aktual (penuh), estimasi (muda), garis target. */
function Meter({ step, est, target, actual, status }: { step: Step; est: number; target: number; actual: number; status?: Status }) {
  const max = Math.max(est, target, actual, 1) * 1.08;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const col = status === "CRITICAL" ? "#ef4444" : status === "WARNING" ? "#f59e0b" : COLOR[step];
  return (
    <div className="relative mt-2.5 h-2.5 rounded-full bg-slate-100" title={`Aktual ${n0(actual)} · Estimasi ${n0(est)}${target ? ` · Target ${n0(target)}` : ""}`}>
      <div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: pct(est), background: col }} />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(actual), background: col }} />
      {target > 0 && <div className="absolute -top-1 h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-slate-900" style={{ left: pct(target) }} />}
    </div>
  );
}

/** Target diisi langsung di kartu (klik angka). */
function TargetInline({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState("");
  if (edit)
    return (
      <input
        autoFocus
        inputMode="numeric"
        className="h-6 w-20 rounded-md border border-slate-300 px-1.5 text-right text-[12px] font-bold tabular-nums outline-none focus:border-slate-900"
        value={v}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEdit(false);
          if (num(v) !== value) onSave(num(v));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEdit(false);
        }}
      />
    );
  return (
    <button
      className="rounded-md px-1 hover:bg-slate-100"
      onClick={(e) => {
        e.stopPropagation();
        setV(value ? n0(value) : "");
        setEdit(true);
      }}
      title="Klik untuk isi target"
    >
      Target <b className={`tabular-nums ${value ? "text-slate-900" : "text-sky-600"}`}>{value ? k0(value) : "+ isi"}</b>
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-bold">{title}</h3>
          <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function McSheet({ m, st, at, name, w, onClose, onSave }: { m: PMaster; st: PlanState; at: number; name: string; w: NonNullable<Where>; onClose: () => void; onSave: (mcs: string[]) => void }) {
  const [pick, setPick] = useState<string[]>(w.mcs);
  const holders = mcHolders(st, m, at, name);
  const limit = m.maxMc[w.cat] ?? 3;
  return (
    <Sheet title={`MC ${first(name)} · mulai ${toClock(at)}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        {w.cat} · maksimal {limit} MC per orang. Yang pudar sedang dipegang orang lain.
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {m.machines
          .filter((x) => x.category === w.cat)
          .map((x) => {
            const k = mcKey(w.cat, x.mc);
            const on = pick.includes(x.mc);
            const other = holders.get(k);
            return (
              <button
                key={k}
                disabled={!!other || (!on && pick.length >= limit)}
                title={other ? `Dipegang ${other}` : partLabel(m, st.machines[k] ?? "")}
                onClick={() => setPick(on ? pick.filter((y) => y !== x.mc) : [...pick, x.mc])}
                className={`flex flex-col items-center rounded-lg border py-1.5 text-xs font-bold transition disabled:opacity-30 ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}
              >
                {x.mc.replace("MC ", "")}
                <span className={`text-[9px] font-medium ${on ? "text-blue-100" : "text-slate-400"}`}>{other ? first(other) : partLabel(m, st.machines[k] ?? "").split(" ")[0]}</span>
              </button>
            );
          })}
      </div>
      <button className="btn-primary mt-4 w-full" onClick={() => onSave(pick)}>
        Simpan {pick.length} MC
      </button>
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
