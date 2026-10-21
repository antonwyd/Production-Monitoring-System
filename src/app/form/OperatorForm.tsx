"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Picker, { type PickerGroup } from "@/components/Picker";
import { computeTotals, groupMachines, normalizeMc, partLabel, validateSubmission } from "@/lib/rules";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import type { LostRowInput, MachineChoice, MasterData, PartRowInput, SubmissionInput, SubmissionView } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Icon from "@/components/Icon";

type PartRow = PartRowInput & { key: string; partName: string | null; ngOpen: boolean };
type LostRow = LostRowInput & { key: string };
type Draft = { workDate: string; memberId: number | null; parts: PartRow[]; lostTimes: LostRow[] };

const uid = () => Math.random().toString(36).slice(2, 10);
const emptyPart = (categoryId: number | null = null): PartRow => ({
  key: uid(),
  categoryId,
  partName: null,
  partId: null,
  machineId: null,
  qtyNormal: null,
  minNormal: null,
  qtyOt: null,
  minOt: null,
  lot: "",
  oiban: "",
  ng: Array(10).fill(null),
  ngOpen: false,
});
const emptyLost = (minutes: number | null = null): LostRow => ({ key: uid(), lostTimeTypeId: null, minutes, note: "" });

const toInt = (s: string): number | null => {
  const t = s.replace(/[^\d]/g, "");
  return t === "" ? null : Math.min(Number(t), 9_999_999);
};

export default function OperatorForm({
  master,
  today,
  userId,
  lockedMemberId,
}: {
  master: MasterData;
  today: string;
  userId: number;
  lockedMemberId: number | null;
}) {
  const DRAFT_KEY = `qa:draft:${userId}`;
  const LAST_MEMBER = `qa:lastMember:${userId}`;
  const [draft, setDraft] = useState<Draft>({ workDate: today, memberId: lockedMemberId, parts: [emptyPart()], lostTimes: [] });
  const [loaded, setLoaded] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [summary, setSummary] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [sentId, setSentId] = useState<string | null>(null);
  const [todayList, setTodayList] = useState<SubmissionView[] | null>(null);

  // Muat draft dari HP.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const lastMember = Number(localStorage.getItem(LAST_MEMBER)) || null;
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setDraft({ ...d, memberId: lockedMemberId ?? d.memberId ?? lastMember });
        if (d.lostTimes?.length) setLostOpen(true);
      } else if (!lockedMemberId && lastMember && master.members.some((m) => m.id === lastMember)) {
        setDraft((d) => ({ ...d, memberId: lastMember }));
      }
    } catch {}
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan draft otomatis.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (draft.memberId) localStorage.setItem(LAST_MEMBER, String(draft.memberId));
    } catch {}
  }, [draft, loaded, DRAFT_KEY, LAST_MEMBER]);

  const loadToday = useCallback(async () => {
    if (!draft.memberId || !draft.workDate) return setTodayList(null);
    try {
      const res = await fetch(`/api/submissions?date=${draft.workDate}&member=${draft.memberId}`);
      if (res.ok) setTodayList(await res.json());
    } catch {}
  }, [draft.memberId, draft.workDate]);
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const input: SubmissionInput = useMemo(
    () => ({
      workDate: draft.workDate,
      memberId: draft.memberId,
      parts: draft.parts.map(({ key: _k, partName: _p, ngOpen: _n, ...r }) => r),
      lostTimes: draft.lostTimes.map(({ key: _k, ...r }) => r),
    }),
    [draft],
  );
  const hasApproved = !!todayList?.some((s) => s.status === "approved");
  const result = useMemo(() => validateSubmission(input, master, { hasApprovedSameDay: hasApproved }), [input, master, hasApproved]);
  const totals = computeTotals(input, master.settings.normalMin);

  const setPart = (key: string, patch: Partial<PartRow>) =>
    setDraft((d) => ({ ...d, parts: d.parts.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const setLost = (key: string, patch: Partial<LostRow>) =>
    setDraft((d) => ({ ...d, lostTimes: d.lostTimes.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  function trySubmit() {
    setShowErrors(true);
    setServerErrors([]);
    if (result.errors.length) {
      if (totals.remaining > 0) setLostOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSummary(true);
  }

  async function send() {
    setSending(true);
    setServerErrors([]);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error), { errors: data.errors as string[] | undefined });
      setSentId(data.id);
      setSummary(false);
      setShowErrors(false);
      setLostOpen(false);
      setDraft((d) => ({ ...d, parts: [emptyPart(d.parts[0]?.categoryId ?? null)], lostTimes: [] }));
      loadToday();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const err = e as Error & { errors?: string[] };
      setServerErrors(err.errors ?? [err.message || "Gagal mengirim. Cek sinyal lalu coba lagi; isian tetap tersimpan di HP."]);
    } finally {
      setSending(false);
    }
  }

  const memberGroups: PickerGroup<number>[] = [
    { options: master.members.map((m) => ({ value: m.id, label: m.name, sub: m.nik, search: m.area })) },
  ];
  const member = master.members.find((m) => m.id === draft.memberId);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-52 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Laporan produksi</h1>
        <p className="mt-1 text-sm text-slate-500">Isian tersimpan otomatis di HP ini sampai dikirim.</p>
      </header>

      {sentId && (
        <div role="status" className="mb-4 flex animate-fade-in items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <Icon name="check" size={16} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Laporan terkirim</div>
            <div className="mt-0.5 text-sm text-emerald-800">
              ID <span className="num font-semibold">{sentId}</span> · menunggu persetujuan leader.
            </div>
          </div>
          <button className="-m-1 rounded-md p-1 text-emerald-700 hover:bg-emerald-100" onClick={() => setSentId(null)} aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {showErrors && result.errors.length > 0 && (
        <div role="alert" className="mb-4 flex animate-fade-in gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <Icon name="alertCircle" size={18} className="mt-0.5 text-red-600" />
          <div>
            <div className="mb-1 font-semibold text-red-900">Belum bisa dikirim</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="card mb-6 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label className="label" htmlFor="tgl">Tanggal</label>
          <input
            id="tgl"
            type="date"
            className="input"
            max={today}
            value={draft.workDate}
            onChange={(e) => setDraft((d) => ({ ...d, workDate: e.target.value }))}
          />
        </div>
        {lockedMemberId ? (
          <div>
            <span className="label">Nama member</span>
            <div className="input flex min-h-[46px] items-center gap-2 bg-slate-50 font-medium shadow-none hover:border-slate-300">
              <Icon name="user" size={16} className="text-slate-400" />
              {member?.name ?? "(member tidak aktif)"}
            </div>
          </div>
        ) : (
          <Picker
            label="Nama member"
            value={draft.memberId}
            groups={memberGroups}
            onChange={(v) => setDraft((d) => ({ ...d, memberId: v }))}
            invalid={showErrors && !draft.memberId}
          />
        )}
      </section>

      {todayList && todayList.length > 0 && (
        <section className="card mb-6 overflow-hidden">
          <h2 className="section-title border-b border-slate-100 px-4 py-3 sm:px-5">Sudah dikirim · {formatDateId(draft.workDate)}</h2>
          <ul className="divide-y divide-slate-100">
            {todayList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="num font-medium text-slate-900">{s.id}</span>
                  <span className="num block text-slate-500">
                    {s.parts.length} part · qty {s.totals.qty.toLocaleString("id-ID")} · {formatDateTimeId(s.submittedAt)}
                  </span>
                </span>
                <StatusBadge status={s.status} />
                {s.status === "rejected" && s.leaderNote && (
                  <span className="w-full rounded-md bg-red-50 px-2.5 py-1.5 text-red-700">Alasan ditolak: {s.leaderNote}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-title">Part yang dikerjakan</h2>
        <span className="num text-sm text-slate-500">{draft.parts.length} part</span>
      </div>
      {draft.parts.map((p, i) => (
        <PartCard
          key={p.key}
          index={i}
          row={p}
          master={master}
          showErrors={showErrors}
          onChange={(patch) => setPart(p.key, patch)}
          onRemove={() => setDraft((d) => ({ ...d, parts: d.parts.filter((x) => x.key !== p.key) }))}
        />
      ))}
      <button
        type="button"
        className="btn mb-8 w-full border border-dashed border-slate-300 bg-transparent text-slate-600 hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700"
        onClick={() => setDraft((d) => ({ ...d, parts: [...d.parts, emptyPart(d.parts.at(-1)?.categoryId ?? null)] }))}
      >
        <Icon name="plus" size={16} />
        Tambah part
      </button>

      <section className="card mb-4 overflow-hidden">
        <button
          type="button"
          aria-expanded={lostOpen}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
          onClick={() => setLostOpen((o) => !o)}
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
            <Icon name="clock" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="section-title block">Lost time / Another job</span>
            <span className="num block text-sm text-slate-500">
              {draft.lostTimes.length > 0 ? `${draft.lostTimes.length} baris · ${totals.lostMin} menit` : "Waktu tidak produktif atau pekerjaan lain"}
            </span>
          </span>
          <Icon name="chevronDown" size={18} className={`text-slate-400 transition-transform ${lostOpen ? "rotate-180" : ""}`} />
        </button>
        {lostOpen && (
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
            {draft.lostTimes.map((l, i) => (
              <LostCard
                key={l.key}
                index={i}
                row={l}
                master={master}
                showErrors={showErrors}
                onChange={(patch) => setLost(l.key, patch)}
                onRemove={() => setDraft((d) => ({ ...d, lostTimes: d.lostTimes.filter((x) => x.key !== l.key) }))}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setDraft((d) => ({ ...d, lostTimes: [...d.lostTimes, emptyLost()] }))}>
                <Icon name="plus" size={16} />
                Tambah baris
              </button>
              {totals.remaining > 0 && (
                <button
                  type="button"
                  className="btn flex-1 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  onClick={() =>
                    setDraft((d) => {
                      const last = d.lostTimes.at(-1);
                      if (last && !last.minutes)
                        return { ...d, lostTimes: d.lostTimes.map((l) => (l.key === last.key ? { ...l, minutes: totals.remaining } : l)) };
                      return { ...d, lostTimes: [...d.lostTimes, emptyLost(totals.remaining)] };
                    })
                  }
                >
                  Isi sisa {totals.remaining} menit ke lost time
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Bar bawah */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-bar backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 pt-3 sm:px-6">
          <div className="num grid grid-cols-4 text-center">
            <BarStat label="Qty" value={totals.qty.toLocaleString("id-ID")} />
            <BarStat label="Menit normal" value={totals.minNormal} />
            <BarStat
              label={`Sisa dari ${master.settings.normalMin}`}
              value={totals.remaining}
              tone={totals.remaining > 0 ? "text-amber-600" : totals.remaining < 0 ? "text-red-600" : "text-emerald-600"}
            />
            <BarStat label="Menit OT" value={totals.minOt} />
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${totals.remaining < 0 ? "bg-red-500" : totals.remaining === 0 ? "bg-emerald-500" : "bg-brand-500"}`}
              style={{ width: `${Math.min(100, Math.max(0, ((master.settings.normalMin - totals.remaining) / (master.settings.normalMin || 1)) * 100))}%` }}
            />
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" className="btn-primary h-12 w-full text-base" onClick={trySubmit}>
            <Icon name="send" size={16} />
            Kirim laporan
          </button>
        </div>
      </div>

      {summary && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-stretch justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-6">
        <div role="dialog" aria-modal="true" aria-labelledby="sum-title" className="flex w-full animate-sheet-in flex-col bg-white sm:max-h-[88vh] sm:max-w-xl sm:rounded-2xl sm:shadow-pop">
          <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id="sum-title" className="text-lg font-semibold tracking-tight">Periksa sebelum kirim</h2>
              <p className="text-sm text-slate-500">
                {member?.name} · {formatDateId(draft.workDate)}
              </p>
            </div>
            <button type="button" className="btn-ghost btn-sm -mr-2 px-2" onClick={() => setSummary(false)} disabled={sending} aria-label="Tutup">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            {result.warnings.length > 0 && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <Icon name="alert" size={18} className="mt-0.5 text-amber-600" />
                <div>
                <div className="font-semibold">Peringatan · tetap bisa dikirim, leader akan cek</div>
                <ul className="mt-1 list-disc pl-4">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                </div>
              </div>
            )}
            {draft.parts.some((p) => p.partId) && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="data-table">
                  <thead className="text-left">
                    <tr>
                      <th>Part</th>
                      <th>MC</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Menit</th>
                      <th className="text-right">NG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.parts
                      .filter((p) => p.partId)
                      .map((p) => {
                        const part = master.parts.find((x) => x.id === p.partId);
                        const mc = master.machines.find((m) => m.id === p.machineId);
                        return (
                          <tr key={p.key}>
                            <td className="whitespace-normal">
                              <span className="font-medium text-slate-900">{part ? partLabel(part) : "-"}</span>
                              <div className="text-xs text-slate-500">{master.categories.find((c) => c.id === p.categoryId)?.name}</div>
                            </td>
                            <td>{mc?.mcNo ?? "-"}</td>
                            <td className="text-right">
                              {(p.qtyNormal ?? 0).toLocaleString("id-ID")}
                              {p.qtyOt ? <div className="text-xs text-slate-500">OT {p.qtyOt.toLocaleString("id-ID")}</div> : null}
                            </td>
                            <td className="text-right">
                              {p.minNormal ?? 0}
                              {p.minOt ? <div className="text-xs text-slate-500">OT {p.minOt}</div> : null}
                            </td>
                            <td className="text-right">{p.ng.reduce<number>((a, b) => a + (b ?? 0), 0)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            {draft.lostTimes.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="data-table">
                <thead className="text-left">
                  <tr>
                    <th>Lost time / Another job</th>
                    <th className="text-right">Menit</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lostTimes.map((l) => (
                    <tr key={l.key}>
                      <td className="whitespace-normal">
                        {master.lostTimeTypes.find((t) => t.id === l.lostTimeTypeId)?.name}
                        {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
                      </td>
                      <td className="text-right">{l.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="num grid grid-cols-4 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 py-3 text-center">
              <BarStat label="Qty" value={totals.qty.toLocaleString("id-ID")} />
              <BarStat label="Normal" value={totals.minNormal} />
              <BarStat label="Lost" value={totals.lostMin} />
              <BarStat label="OT" value={totals.minOt} />
            </div>
            {serverErrors.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <ul className="list-disc pl-4">
                  {serverErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            <button type="button" className="btn-secondary h-12" onClick={() => setSummary(false)} disabled={sending}>
              Kembali
            </button>
            <button type="button" className="btn-primary h-12" onClick={send} disabled={sending}>
              {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="check" size={16} />}
              {sending ? "Mengirim…" : "Konfirmasi kirim"}
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function BarStat({ label, value, tone = "text-slate-900" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0 px-1">
      <div className={`text-[17px] leading-6 font-semibold ${tone}`}>{value}</div>
      <div className="truncate text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className={`input num text-[17px] font-medium ${invalid ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100" : ""}`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ""}
        onChange={(e) => onChange(toInt(e.target.value))}
      />
    </label>
  );
}

function PartCard({
  index,
  row,
  master,
  showErrors,
  onChange,
  onRemove,
}: {
  index: number;
  row: PartRow;
  master: MasterData;
  showErrors: boolean;
  onChange: (patch: Partial<PartRow>) => void;
  onRemove: () => void;
}) {
  const cat = master.categories.find((c) => c.id === row.categoryId);
  const catParts = master.parts.filter((p) => p.categoryId === row.categoryId);
  const names = [...new Set(catParts.map((p) => p.name))];
  const types = catParts.filter((p) => p.name === row.partName);
  const part = master.parts.find((p) => p.id === row.partId);
  const catMachines = master.machines.filter((m) => m.categoryId === row.categoryId);
  const ngGroup = master.ngGroups.find((g) => g.id === cat?.ngGroupId);
  const ngTotal = row.ng.reduce<number>((a, b) => a + (b ?? 0), 0);

  const mcGroups: PickerGroup<number | "-">[] = useMemo(() => {
    const g = groupMachines(catMachines, part);
    const opt = (m: (typeof catMachines)[number]) => ({ value: m.id, label: m.mcNo, sub: `${m.line} · ${m.mainPart}`, search: normalizeMc(m.mcNo) });
    return [
      { options: [{ value: "-" as const, label: "-", sub: "Tidak pakai mesin" }] },
      ...(g.main.length ? [{ title: "Mesin untuk part ini", options: g.main.map(opt) }] : []),
      ...(g.switchable.length ? [{ title: "Bisa dipakai (ganti type)", options: g.switchable.map(opt) }] : []),
      ...(g.other.length ? [{ title: part ? "Mesin lain" : "Semua mesin", options: g.other.map(opt) }] : []),
    ];
  }, [catMachines, part]);

  const err = showErrors;
  return (
    <section className="card mb-3 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
          {index + 1}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900">
          Part {index + 1}
          {cat && <span className="ml-2 font-normal text-slate-500">{cat.name}</span>}
        </h3>
        <button type="button" onClick={onRemove} className="btn-ghost btn-sm -mr-2 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus part ${index + 1}`}>
          <Icon name="trash" size={16} />
          <span className="text-sm font-medium">Hapus</span>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Picker
          label="Kategori"
          value={row.categoryId}
          groups={[{ options: master.categories.map((c) => ({ value: c.id, label: c.name, sub: c.process })) }]}
          onChange={(v) => v !== row.categoryId && onChange({ categoryId: v, partName: null, partId: null, machineId: null })}
          invalid={err && !row.categoryId}
        />
        <Picker
          label="Part"
          value={row.partName}
          disabled={!row.categoryId}
          groups={[{ options: names.map((n) => ({ value: n, label: n })) }]}
          normalizeSearch={(s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")}
          onChange={(v) => {
            const ts = catParts.filter((p) => p.name === v);
            onChange({ partName: v, partId: ts.length === 1 ? ts[0].id : null });
          }}
          invalid={err && !row.partId && !row.partName}
        />
        {types.length > 1 && (
          <Picker
            label="Type"
            value={row.partId}
            groups={[{ options: types.map((t) => ({ value: t.id, label: t.type || "(tanpa type)", sub: `STKI ${t.stki.toLocaleString("id-ID")}` })) }]}
            onChange={(v) => onChange({ partId: v })}
            invalid={err && !row.partId}
          />
        )}
        {catMachines.length > 0 && (
          <Picker<number | "-">
            label="MC No"
            value={row.machineId as number | "-" | null}
            groups={mcGroups}
            normalizeSearch={normalizeMc}
            onChange={(v) => onChange({ machineId: v as MachineChoice })}
            invalid={err && row.machineId == null}
          />
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-slate-100 pt-4">
        <NumField label="Qty normal" value={row.qtyNormal} onChange={(v) => onChange({ qtyNormal: v })} invalid={err && !row.qtyNormal && !row.qtyOt} />
        <NumField label="Menit normal" value={row.minNormal} onChange={(v) => onChange({ minNormal: v })} invalid={err && !!row.qtyNormal && !row.minNormal} />
        <NumField label="Qty OT" value={row.qtyOt} onChange={(v) => onChange({ qtyOt: v })} />
        <NumField label="Menit OT" value={row.minOt} onChange={(v) => onChange({ minOt: v })} invalid={err && !!row.qtyOt && !row.minOt} />
        <label className="block">
          <span className="label">Lot</span>
          <input className="input" value={row.lot} onChange={(e) => onChange({ lot: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Oiban</span>
          <input className="input" value={row.oiban} onChange={(e) => onChange({ oiban: e.target.value })} />
        </label>
      </div>
      <button
        type="button"
        aria-expanded={row.ngOpen}
        className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        onClick={() => onChange({ ngOpen: !row.ngOpen })}
      >
        <span className="flex-1">
          Jumlah NG
          {ngTotal > 0 ? <span className="badge-danger num ml-2">{ngTotal}</span> : <span className="ml-2 font-normal text-slate-400">tidak ada</span>}
        </span>
        <Icon name="chevronDown" size={16} className={`text-slate-400 transition-transform ${row.ngOpen ? "rotate-180" : ""}`} />
      </button>
      {row.ngOpen && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
          {Array.from({ length: 10 }, (_, i) => (
            <NumField
              key={i}
              label={`${i + 1}. ${ngGroup?.codes[i] ?? `NG${i + 1}`}`}
              value={row.ng[i]}
              onChange={(v) => onChange({ ng: row.ng.map((x, j) => (j === i ? v : x)) })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LostCard({
  index,
  row,
  master,
  showErrors,
  onChange,
  onRemove,
}: {
  index: number;
  row: LostRow;
  master: MasterData;
  showErrors: boolean;
  onChange: (patch: Partial<LostRow>) => void;
  onRemove: () => void;
}) {
  const groups: PickerGroup<number>[] = [
    { title: "Lost time", options: master.lostTimeTypes.filter((t) => t.group === "LOST_TIME").map((t) => ({ value: t.id, label: t.name })) },
    { title: "Another job", options: master.lostTimeTypes.filter((t) => t.group === "ANOTHER_JOB").map((t) => ({ value: t.id, label: t.name })) },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs sm:p-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-500">Baris {index + 1}</span>
        <button type="button" onClick={onRemove} className="btn-ghost btn-sm -my-1 -mr-2 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus baris ${index + 1}`}>
          <Icon name="trash" size={15} />
          Hapus
        </button>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        <div className="col-span-2">
          <Picker label="Jenis" value={row.lostTimeTypeId} groups={groups} onChange={(v) => onChange({ lostTimeTypeId: v })} invalid={showErrors && !row.lostTimeTypeId} />
        </div>
        <NumField label="Menit" value={row.minutes} onChange={(v) => onChange({ minutes: v })} invalid={showErrors && !row.minutes} />
        <label className="col-span-3 block">
          <span className="label">Keterangan</span>
          <input className="input" value={row.note} onChange={(e) => onChange({ note: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
