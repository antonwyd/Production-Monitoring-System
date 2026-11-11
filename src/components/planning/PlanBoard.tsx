"use client";
// Rencana manpower (papan). Masukan Anton 11 Nov:
//  - satu layar penuh, member belum bekerja di kiri, seret ke proses & type di kanan;
//  - animasi lantai di atas ikut berubah; target diisi langsung di rencana (tidak dari PO/Forecast).
// Semua perubahan berlaku mulai "jam" yang dipilih di bar atas (default jam sekarang).
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  assign,
  balance,
  buildMaster,
  compute,
  dayEnd,
  extendOt,
  mcHolders,
  mcKey,
  normalEnd,
  parsePo,
  poTypes,
  prodBetween,
  release,
  spans,
  START,
  STEPS,
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
  type Move,
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
  const [tab, setTab] = useState<"hasil" | "lantai" | "tutup">("hasil");
  const [bigFloor, setBigFloor] = useState(false);
  const [until, setUntil] = useState(nEnd);
  const [focus, setFocus] = useState<{ cat: string; n: number } | undefined>();
  // Type hari kerja terakhir tampil sebagai tujuan kosong, supaya bisa langsung diseret.
  const [extra, setExtra] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    const add = (cat: string, pid: string) => pid && m.parts.some((p) => p.id === pid) && !(out[cat] ??= []).includes(pid) && out[cat].push(pid);
    for (const p of page.state.people) for (const g of p.segs) if (g.cat) g.mcs?.length ? g.mcs.forEach((x) => add(g.cat, page.state.machines[mcKey(g.cat, x)] ?? "")) : add(g.cat, g.part ?? "");
    return out;
  });
  // Kartu type yang sengaja dihapus dari papan (tombol ✕).
  const [hidden, setHidden] = useState<string[]>([]);
  // Tampilan utama: matriks PO (type × proses) atau papan per proses.
  const [view, setView] = useState<"matriks" | "papan">("matriks");
  const [plan, setPlan] = useState<{ moves: Move[]; pick: boolean[] } | null>(null);
  const [sheet, setSheet] = useState<null | "dest" | "hadir" | "mc" | "po" | "balance" | { addType: string }>(null);
  const [hist, setHist] = useState<PlanState[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(page.saved);
  const end = dayEnd(m, st.ot);
  const now = isToday ? Math.max(START, nowMin) : START;
  const res = useMemo(() => compute(m, st, end, now), [m, st, end, now]);
  // Hasil simulasi sampai jam tertentu (mis. "PO 800rb, sampai 14:00 baru 500rb?").
  const T = Math.min(until, end);
  const resT = useMemo(() => compute(m, st, T, now), [m, st, T, now]);

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
  /** Hapus kartu type dari papan; orang di kartu itu kembali ke "Belum bekerja" mulai jam `at`. */
  const removeCard = (cat: string, pid: string, names: string[]) => {
    if (names.length && !window.confirm(`Hapus ${partLabel(m, pid)} dari ${cat}?\n${names.length} orang kembali ke "Belum bekerja" mulai ${toClock(at)}.`)) return;
    if (names.length) unassign(names);
    setExtra((x) => ({ ...x, [cat]: (x[cat] ?? []).filter((p) => p !== pid) }));
    setHidden((h) => [...h, `${cat}|${pid}`]);
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
    // Type yang ada PO-nya selalu tampil sebagai tempat tujuan, walau belum ada orang.
    for (const p of m.parts) if (p.category === c.name && st.targets[p.key] && !byPart.has(p.id) && !hidden.includes(`${c.name}|${p.id}`)) byPart.set(p.id, []);
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
  // PO per type (disimpan sebagai target yang sama di setiap proses).
  const po = useMemo(() => {
    const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(st.targets)) {
      const q = Math.max(0, ...Object.values(v).map((x) => x ?? 0));
      if (q > 0) o[k] = q;
    }
    return o;
  }, [st.targets]);
  const setPoAll = (map: Record<string, number>) =>
    update((s) => {
      const targets: PlanState["targets"] = {};
      for (const [key, q] of Object.entries(map)) {
        if (!(q > 0)) continue;
        const t: Partial<Record<Step, number>> = {};
        for (const p of m.parts) if (p.key === key) t[m.cats.find((c) => c.name === p.category)!.step] = q;
        targets[key] = t;
      }
      return { ...s, targets };
    });
  const hasil = useMemo(() => {
    const left = prodBetween(m, st.ot, Math.max(now, at, START), T) / 60;
    const held = mcHolders(st, m, at, "");
    const out: Group[] = [];
    for (const t of poTypes(m)) {
      const q = po[t.key];
      if (!q) continue;
      const steps: Act[] = STEPS.flatMap((step) => {
        const r = resT.rows.find((x) => x.key === t.key && x.step === step);
        if (!r) return [];
        const gap = q - r.est;
        const add = gap > 0 && r.unit > 0 && left > 0 ? Math.ceil(gap / (r.unit * left)) : 0;
        const p = m.parts.find((x) => x.key === t.key && (r.cats.length ? r.cats.includes(x.category) : m.cats.find((c) => c.name === x.category)?.step === step));
        const cat = p?.category ?? "";
        const pid = p?.id ?? "";
        const free = m.machines.filter((x) => x.category === cat && !held.get(mcKey(cat, x.mc)) && (st.machines[mcKey(cat, x.mc)] === pid || x.opts.includes(pid))).length;
        return [{ step, est: r.est, gap, add, cat, pid, free, extraHours: r.extraHours, rateEnd: r.rateEnd, people: r.people.length }];
      });
      if (!steps.length) continue;
      const low = steps.reduce((a, b) => (b.est < a.est ? b : a));
      const status: Status = low.est >= q * 1.1 ? "SAFE" : low.est >= q ? "WARNING" : "CRITICAL";
      out.push({ key: t.key, label: t.label, po: q, hasil: low.est, gap: q - low.est, bottle: low.step, status, steps });
    }
    const R = { CRITICAL: 0, WARNING: 1, SAFE: 2 };
    return out.sort((a, b) => R[a.status] - R[b.status] || b.gap - a.gap);
  }, [resT, m, st, now, at, T, po]);
  const kurang = hasil.filter((h) => h.status === "CRITICAL").length;

  // Matriks: baris = type (yang ada PO atau ada orangnya), kolom = PF → Seiretsu → Senbetsu.
  const matrix = useMemo(() => {
    const catOf = new Map(m.cats.map((c) => [c.name, c]));
    const partOf = new Map(m.parts.map((p) => [p.id, p]));
    const cellPeople = new Map<string, string[]>();
    const busy = new Set<string>();
    for (const [name, w] of where) {
      const c = w && catOf.get(w.cat);
      const p = w && partOf.get(w.part);
      if (!c || !p) continue;
      const k = `${p.key}#${c.step}`;
      cellPeople.set(k, [...(cellPeople.get(k) ?? []), name]);
      busy.add(p.key);
    }
    return poTypes(m)
      .filter((t) => po[t.key] || busy.has(t.key))
      .map((t) => {
        const q = po[t.key] ?? 0;
        const cells = STEPS.map((step) => {
          const parts = m.parts.filter((p) => p.key === t.key && catOf.get(p.category)?.step === step);
          const names = (cellPeople.get(`${t.key}#${step}`) ?? []).sort();
          const r = resT.rows.find((x) => x.key === t.key && x.step === step);
          const tgt = parts.find((p) => names.some((n) => where.get(n)?.part === p.id)) ?? parts[0];
          const est = r?.est ?? 0;
          const status: Status | undefined = !q ? undefined : est >= q * 1.1 ? "SAFE" : est >= q ? "WARNING" : "CRITICAL";
          return { step, ok: parts.length > 0, names, est, mcs: r?.mcs.length ?? 0, cat: tgt?.category ?? "", pid: tgt?.id ?? "", status, mc: !!(tgt && catOf.get(tgt.category)?.mc) };
        });
        const live = cells.filter((c) => c.ok);
        const hasil = live.length ? Math.min(...live.map((c) => c.est)) : 0;
        return { ...t, po: q, cells, hasil, gap: q - hasil };
      })
      .sort((a, b) => Number(!a.po) - Number(!b.po));
  }, [m, po, where, resT]);
  const mxPo = matrix.filter((r) => r.po);
  const mxTot = { po: mxPo.reduce((a, r) => a + r.po, 0), hasil: mxPo.reduce((a, r) => a + Math.min(r.po, r.hasil), 0), kurang: mxPo.reduce((a, r) => a + Math.max(0, r.gap), 0) };
  const runBalance = () => {
    const moves = balance(m, st, Math.max(at, isToday ? now : START), T, now);
    setPlan({ moves, pick: moves.map(() => true) });
    setSheet("balance");
  };
  const applyBalance = () => {
    if (!plan) return;
    const from = Math.max(at, isToday ? now : START);
    const chosen = plan.moves.filter((_, i) => plan.pick[i]);
    update((s) => ({ ...s, people: s.people.map((p) => chosen.filter((x) => x.name === p.name).reduce((q, x) => assign({ ...q, absent: undefined }, { at: from, ...x.to }), p)) }));
    setFocus((f) => ({ cat: chosen[0]?.to.cat ?? "", n: (f?.n ?? 0) + 1 }));
    setSheet(null);
    setPlan(null);
    if (chosen.length) setMsg({ kind: "ok", text: `${chosen.length} pemindahan diterapkan mulai ${toClock(from)}. Tekan ↶ Batal untuk membatalkan.` });
  };

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

  function renderMatrix() {
    const deadlines = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => h * 60).filter((x) => x > START && x <= dayEnd(m, m.otLimitMin));
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 px-4 py-2.5">
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            PO harus selesai jam
            <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[14px] font-bold text-slate-900" value={until} onChange={(e) => setUntil(Number(e.target.value))}>
              {deadlines.map((x) => (
                <option key={x} value={x}>
                  {toClock(x)}
                  {x > nEnd ? " (lembur)" : ""}
                </option>
              ))}
            </select>
          </label>
          {mxPo.length > 0 && (
            <div className="flex items-baseline gap-4 text-[13px]">
              <span className="text-slate-500">
                PO <b className="text-[16px] tabular-nums text-slate-900">{k0(mxTot.po)}</b>
              </span>
              <span className="text-slate-500">
                Terkejar <b className="text-[16px] tabular-nums text-slate-900">{k0(mxTot.hasil)}</b>
              </span>
              <span className={mxTot.kurang ? "text-red-600" : "text-emerald-600"}>
                {mxTot.kurang ? (
                  <>
                    Kurang <b className="text-[16px] tabular-nums">{k0(mxTot.kurang)}</b>
                  </>
                ) : (
                  <b>✓ Semua PO terkejar</b>
                )}
              </span>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button className="h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => setBigFloor(true)}>
              ▶ Lantai
            </button>
            <button className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-30" disabled={!mxTot.kurang} onClick={runBalance}>
              ⚖ Seimbangkan
            </button>
          </div>
        </div>
        {!matrix.length ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div className="max-w-sm">
              <div className="text-3xl">📋</div>
              <p className="mt-2 font-bold">Mulai dari PO hari ini</p>
              <p className="mt-1 text-sm text-slate-500">Setiap type yang ada PO-nya jadi satu baris. Lalu seret orang ke proses PF, Seiretsu, atau Senbetsu di baris itu.</p>
              <button className="btn-primary mt-4 h-10 px-5" onClick={() => setSheet("po")}>
                Input PO
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[860px]">
              <div className="sticky top-0 z-10 grid grid-cols-[190px_repeat(3,minmax(0,1fr))_130px] gap-2 border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur">
                <span className="self-end text-[11px] font-bold uppercase tracking-wide text-slate-400">Type · PO</span>
                {STEPS.map((step) => (
                  <span key={step} className="flex items-center gap-2 text-[13px] font-bold" style={{ color: COLOR[step] }}>
                    <span className="grid h-6 w-6 place-items-center rounded-md text-[12px] text-white" style={{ background: COLOR[step] }}>
                      {ICON[step]}
                    </span>
                    {STEP_NAME[step]}
                    <span className="font-normal text-slate-400">{matrix.reduce((a, r) => a + r.cells.find((c) => c.step === step)!.names.length, 0)} orang</span>
                  </span>
                ))}
                <span className="self-end text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">Hasil vs PO</span>
              </div>
              {matrix.map((r, ri) => {
                const col = !r.po ? "#64748b" : r.gap <= 0 ? (r.hasil >= r.po * 1.1 ? "#059669" : "#d97706") : "#dc2626";
                return (
                  <div key={r.key}>
                    {ri > 0 && !r.po && matrix[ri - 1].po > 0 && <div className="px-4 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Dikerjakan, tanpa PO</div>}
                    <div className={`grid grid-cols-[190px_repeat(3,minmax(0,1fr))_130px] items-stretch gap-2 border-b border-slate-100 px-3 py-2 ${r.po && r.gap > 0 ? "bg-red-50/40" : ""}`}>
                      <div className="flex flex-col justify-center">
                        <span className="text-[16px] font-bold text-slate-900">{r.label}</span>
                        <span className="text-[12px] text-slate-500">{r.po ? `PO ${n0(r.po)}` : "tanpa PO"}</span>
                      </div>
                      {r.cells.map((c) => {
                        const id = `mx|${r.key}|${c.step}`;
                        const hot = over === id;
                        if (!c.ok) return <div key={c.step} className="grid place-items-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-300">tidak lewat proses ini</div>;
                        const can = moving && !!c.pid;
                        const pct = r.po ? Math.min(100, (c.est / r.po) * 100) : 0;
                        const cc = c.status === "CRITICAL" ? "#dc2626" : c.status === "WARNING" ? "#d97706" : c.status === "SAFE" ? "#059669" : "#94a3b8";
                        return (
                          <div
                            key={c.step}
                            {...dropProps(id, (ns) => moveTo(ns, c.cat, c.pid))}
                            onClick={() => can && moveTo(sel, c.cat, c.pid)}
                            className={`flex min-h-[86px] flex-col rounded-xl p-2 transition ${can ? "cursor-pointer" : ""} ${hot ? "ring-2" : "ring-1 ring-slate-200"}`}
                            style={{ background: hot ? TINT[c.step] : SOFT[c.step], ...(hot ? ({ "--tw-ring-color": COLOR[c.step] } as React.CSSProperties) : {}) }}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[15px] font-bold tabular-nums" style={{ color: cc }}>
                                {k0(c.est)}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {c.mc ? `${c.mcs} MC · ` : ""}
                                {r.po ? (c.est >= r.po ? `+${k0(c.est - r.po)}` : `−${k0(r.po - c.est)}`) : `${c.names.length} orang`}
                              </span>
                            </div>
                            {r.po > 0 && (
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cc }} />
                              </div>
                            )}
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {c.names.map((n) => chip(n, c.step))}
                              {!c.names.length && <span className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-center text-[11px] text-slate-400">{can ? "Taruh di sini" : "Seret orang ke sini"}</span>}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex flex-col items-end justify-center text-right">
                        <span className="text-[18px] font-extrabold tabular-nums" style={{ color: col }}>
                          {r.po ? (r.gap > 0 ? `−${n0(r.gap)}` : "✓") : k0(r.hasil)}
                        </span>
                        <span className="text-[11px] text-slate-500">{r.po ? (r.gap > 0 ? `terkejar ${k0(r.hasil)}` : `terkejar ${k0(r.hasil)}`) : "hasil"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button className="m-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-[13px] font-semibold text-slate-500 hover:border-slate-500" onClick={() => setSheet("po")}>
                + Tambah / ubah PO
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

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
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-semibold">
            {(
              [
                ["matriks", "▦ Matriks PO"],
                ["papan", "☰ Papan proses"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1.5 transition ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {l}
              </button>
            ))}
          </div>
          <button className="h-9 rounded-lg bg-sky-50 px-3 text-sm font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100" onClick={() => setSheet("po")}>
            📋 PO{Object.keys(po).length ? ` (${Object.keys(po).length})` : ""}
          </button>
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
          {view === "matriks" ? (
            renderMatrix()
          ) : (
          <>
          {/* Panel atas: hasil simulasi vs target, atau lantai produksi */}
          <section className="shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
              <div className="flex gap-0.5 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    ["hasil", "📊 PO vs Simulasi"],
                    ["lantai", "▶ Lantai produksi"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1 text-[13px] font-semibold transition ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    {l}
                    {k === "hasil" && kurang > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{kurang}</span>}
                  </button>
                ))}
              </div>
              {tab === "hasil" && (
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span>sampai jam</span>
                  <select className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[13px] font-semibold text-slate-900" value={until} onChange={(e) => setUntil(Number(e.target.value))}>
                    {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
                      .map((h) => h * 60)
                      .filter((x) => x > START && x <= dayEnd(m, m.otLimitMin))
                      .map((x) => (
                        <option key={x} value={x}>
                          {toClock(x)}
                          {x > nEnd ? " (lembur)" : ""}
                        </option>
                      ))}
                  </select>
                  {until > end && <span className="text-amber-600">· belum ada yang lembur sampai jam ini</span>}
                </div>
              )}
              {tab === "lantai" && (
                <button className="text-[12px] font-semibold text-slate-500 hover:text-slate-900" onClick={() => setBigFloor(true)}>
                  ⤢ Layar penuh
                </button>
              )}
              <button className="ml-auto text-[12px] font-semibold text-slate-400 hover:text-slate-800" onClick={() => setTab(tab === "tutup" ? "hasil" : "tutup")}>
                {tab === "tutup" ? "Tampilkan ▾" : "Sembunyikan ▴"}
              </button>
            </div>
            {tab === "lantai" && (
              <div className="p-3">
                <FloorView key={`${at}`} m={m} st={st} initialAt={at} focus={focus} compact maxH={300} />
              </div>
            )}
            {tab === "hasil" && <Hasil m={m} rows={hasil} T={T} pool={pool} onAdd={(names, cat, pid) => moveTo(names, cat, pid)} onPo={() => setSheet("po")} />}
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
                          ) : (
                            <span className="flex items-center gap-1">
                              {row?.need ? <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${PILL[row.status]}`}>{WORD[row.status]}</span> : null}
                              <button
                                className="grid h-6 w-6 place-items-center rounded-md text-[13px] text-slate-300 hover:bg-red-50 hover:text-red-600"
                                title="Hapus type ini dari papan"
                                aria-label={`Hapus ${partLabel(m, pid)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCard(c.name, pid, names);
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          )}
                        </div>
                        <Meter step={c.step} est={row?.estEnd ?? 0} target={row?.need ?? 0} actual={act} status={row?.need ? row.status : undefined} />
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 whitespace-nowrap text-[11.5px] text-slate-500">
                          <span>
                            Estimasi <b className="tabular-nums text-slate-800">{k0(row?.estEnd ?? 0)}</b>
                          </span>
                          <span>
                            Aktual <b className="tabular-nums text-slate-800">{act ? k0(act) : "–"}</b>
                          </span>
                          <span>
                            PO <b className="tabular-nums text-slate-800">{row?.need ? k0(row.need) : "–"}</b>
                          </span>
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
          </>
          )}
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
                  setHidden((h) => h.filter((k) => k !== `${sheet.addType}|${p.id}`));
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
      {bigFloor && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setBigFloor(false)}>
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <b>Lantai produksi · jam {toClock(at)}</b>
              <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setBigFloor(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <FloorView m={m} st={st} initialAt={at} focus={focus} maxH={typeof window !== "undefined" ? window.innerHeight - 260 : 600} />
          </div>
        </div>
      )}
      {sheet === "balance" && plan && (
        <Sheet title="Usulan pemindahan" onClose={() => (setSheet(null), setPlan(null))}>
          {plan.moves.length ? (
            <>
              <p className="mb-3 text-sm text-slate-500">
                Mulai jam {toClock(Math.max(at, isToday ? now : START))}. Hanya memindah orang dari type yang lebih (atau yang belum bekerja), operator MC tidak dipindah. Hilangkan centang yang tidak mau.
              </p>
              <div className="flex flex-col gap-1.5">
                {plan.moves.map((x, i) => (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-xl p-2.5 ring-1 ${plan.pick[i] ? "bg-slate-50 ring-slate-300" : "ring-slate-200 opacity-50"}`}>
                    <input type="checkbox" className="h-4 w-4" checked={plan.pick[i]} onChange={() => setPlan({ ...plan, pick: plan.pick.map((v, j) => (j === i ? !v : v)) })} />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b>{x.name}</b>
                      <span className="block text-slate-500">
                        {x.from ? `${partLabel(m, x.from.part)} ${STEP_NAME[m.cats.find((c) => c.name === x.from!.cat)!.step]}` : "Belum bekerja"} → <b className="text-slate-800">{partLabel(m, x.to.part)} {STEP_NAME[m.cats.find((c) => c.name === x.to.cat)!.step]}</b>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[11.5px] font-semibold text-emerald-700">kurang turun<br /><b className="text-[13px]">{k0(x.gain)}</b></span>
                  </label>
                ))}
              </div>
              <button className="btn-primary mt-4 w-full" disabled={!plan.pick.some(Boolean)} onClick={applyBalance}>
                Terapkan {plan.pick.filter(Boolean).length} pemindahan
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">Tidak ada pemindahan yang bisa mengurangi kekurangan: semua type sudah pas atau orangnya tidak cukup. Pilihannya: tambah orang (perbantuan), lembur, atau ganti MC di PF.</p>
          )}
        </Sheet>
      )}
      {sheet === "po" && <PoSheet m={m} po={po} onClose={() => setSheet(null)} onSave={(map) => (setPoAll(map), setSheet(null))} />}
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

type Act = { step: Step; est: number; gap: number; add: number; cat: string; pid: string; free: number; extraHours: number; rateEnd: number; people: number };
type Group = { key: string; label: string; po: number; hasil: number; gap: number; bottle: Step; status: Status; steps: Act[] };

/** PO vs hasil simulasi per type: yang kurang di atas, lengkap dengan apa yang harus diubah. */
function Hasil({ m, rows, T, pool, onAdd, onPo }: { m: PMaster; rows: Group[]; T: number; pool: string[]; onAdd: (names: string[], cat: string, pid: string) => void; onPo: () => void }) {
  if (!rows.length)
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-5 text-[13px] text-slate-500">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-lg">📋</span>
        <span>Input PO hari ini dulu. Setelah itu terlihat per type: PO, hasil simulasi, kurang berapa, dan siapa yang harus dipindah.</span>
        <button className="btn-primary h-9 px-4 text-sm" onClick={onPo}>
          Input PO
        </button>
      </div>
    );
  const cnt = (s: Status) => rows.filter((x) => x.status === s).length;
  const totPo = rows.reduce((a, r) => a + r.po, 0);
  const totGap = rows.reduce((a, r) => a + Math.max(0, r.gap), 0);
  return (
    <div className="max-h-[300px] overflow-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-4 py-2 text-[12px] font-semibold">
        <span className="text-red-600">● {cnt("CRITICAL")} kurang</span>
        <span className="text-amber-600">● {cnt("WARNING")} mepet</span>
        <span className="text-emerald-600">● {cnt("SAFE")} aman</span>
        <span className="text-slate-500">
          Total PO {n0(totPo)} · {totGap > 0 ? <b className="text-red-600">kurang {n0(totGap)}</b> : <b className="text-emerald-600">semua tercapai</b>}
        </span>
        <button className="ml-auto font-semibold text-sky-700 hover:underline" onClick={onPo}>
          Ubah PO
        </button>
      </div>
      <div className="flex min-w-[620px] flex-col">
        {rows.map((g) => {
          const col = g.status === "CRITICAL" ? "#ef4444" : g.status === "WARNING" ? "#f59e0b" : "#10b981";
          const pct = Math.min(100, (g.hasil / g.po) * 100);
          return (
            <div key={g.key} className={`grid grid-cols-[150px_110px_1fr_120px] items-start gap-3 border-t border-slate-100 px-4 py-2.5 ${g.status === "CRITICAL" ? "bg-red-50/50" : ""}`}>
              <div>
                <div className="text-[15px] font-bold text-slate-900">{g.label}</div>
                <div className="text-[11.5px] text-slate-500">PO {n0(g.po)}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold tabular-nums" style={{ color: col }}>
                  {n0(g.hasil)}
                </div>
                <div className="text-[11px] text-slate-400">simulasi s/d {toClock(T)}</div>
              </div>
              <div className="min-w-0">
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {g.steps.map((a) => {
                    const short = a.gap > 0;
                    const c = m.cats.find((x) => x.name === a.cat);
                    const per = c?.mc ? (m.maxMc[a.cat] ?? 3) : 1;
                    const mcAdd = c?.mc ? Math.min(a.add, a.free) : 0;
                    const ppl = c?.mc ? Math.ceil(mcAdd / per) : a.add;
                    const take = pool.slice(0, ppl);
                    return (
                      <div key={a.step} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                        <span className="inline-flex w-[118px] shrink-0 items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: COLOR[a.step] }} />
                          <b className="text-slate-700">{STEP_NAME[a.step]}</b>
                          <span className={`tabular-nums ${short ? "font-bold text-red-600" : "text-slate-500"}`}>{k0(a.est)}</span>
                        </span>
                        {!short ? (
                          <span className="text-emerald-700">✓ cukup</span>
                        ) : (
                          <>
                            <span className="font-semibold text-red-700">
                              {c?.mc ? `butuh +${a.add} MC` : `tambah ${a.add} orang`}
                              {a.rateEnd > 0 && T >= nEndOf(m) ? ` atau lembur ±${(Math.ceil(a.extraHours * 2) / 2).toLocaleString("id-ID")} jam` : ""}
                            </span>
                            {c?.mc && <span className="text-slate-500">{a.free ? `(MC kosong ${a.free})` : "(MC penuh: ganti MC lain ke type ini)"}</span>}
                            {take.length > 0 && a.cat && a.pid && (!c?.mc || mcAdd > 0) ? (
                              <button className="rounded-md bg-red-600 px-2 py-0.5 text-[11.5px] font-semibold text-white hover:bg-red-700" onClick={() => onAdd(take, a.cat, a.pid)}>
                                + {take.map(first).join(", ")}
                              </button>
                            ) : (
                              !c?.mc && <span className="text-slate-500">seret orang dari type yang aman</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-extrabold tabular-nums" style={{ color: col }}>
                  {g.gap > 0 ? `−${n0(g.gap)}` : `+${n0(-g.gap)}`}
                </div>
                <div className="text-[11px] text-slate-400">{g.gap > 0 ? `kurang · ${STEP_NAME[g.bottle]} paling sedikit` : "lebih dari PO"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const nEndOf = (m: PMaster) => normalEnd(m);

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

function PoSheet({ m, po, onClose, onSave }: { m: PMaster; po: Record<string, number>; onClose: () => void; onSave: (map: Record<string, number>) => void }) {
  const types = poTypes(m);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(po).map(([k, q]) => [k, n0(q)])));
  const [paste, setPaste] = useState("");
  const [miss, setMiss] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const read = () => {
    const r = parsePo(paste, m);
    setV((o) => ({ ...o, ...Object.fromEntries(Object.entries(r.po).map(([k, x]) => [k, n0(x)])) }));
    setMiss(r.miss);
    setPaste("");
  };
  const total = Object.values(v).reduce((a, x) => a + num(x), 0);
  const shown = types.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title="PO hari ini" onClose={onClose}>
      <p className="mb-2 text-sm text-slate-500">Tempel dari Excel/WA (satu baris: type + jumlah), atau isi langsung di daftar.</p>
      <textarea className="input h-20 w-full font-mono text-[13px]" placeholder={"627-J D1\t800000\n629-J D2\t300000"} value={paste} onChange={(e) => setPaste(e.target.value)} />
      <button className="btn-secondary mt-1.5 h-8 w-full text-sm" disabled={!paste.trim()} onClick={read}>
        Baca tempelan
      </button>
      {miss.length > 0 && <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[12px] text-amber-800">Tidak dikenali: {miss.join(" · ")}</p>}
      <input className="input mt-3 h-8 w-full text-sm" placeholder="Cari type…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-2 grid max-h-[38vh] grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto pr-1">
        {shown.map((t) => (
          <label key={t.key} className="flex items-center justify-between gap-2 text-sm">
            <span className={`truncate ${num(v[t.key] ?? "") ? "font-bold" : "text-slate-600"}`}>{t.label}</span>
            <input
              inputMode="numeric"
              className="h-8 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm tabular-nums outline-none focus:border-slate-900"
              value={v[t.key] ?? ""}
              placeholder="0"
              onChange={(e) => setV({ ...v, [t.key]: e.target.value })}
              onBlur={() => v[t.key] && setV({ ...v, [t.key]: num(v[t.key]) ? n0(num(v[t.key])) : "" })}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-secondary h-10 px-3 text-sm" onClick={() => setV({})}>
          Kosongkan
        </button>
        <button className="btn-primary h-10 flex-1" onClick={() => onSave(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x)])))}>
          Pakai PO · total {n0(total)}
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
