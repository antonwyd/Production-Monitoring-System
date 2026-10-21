"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Picker, { type PickerGroup } from "@/components/Picker";
import { computeTotals, groupMachines, normalizeMc, partLabel, validateSubmission } from "@/lib/rules";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import type { LostRowInput, MachineChoice, MasterData, PartRowInput, SubmissionInput, SubmissionView } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

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
    <div className="mx-auto max-w-2xl px-3 pb-44 pt-4">
      {sentId && (
        <div className="card mb-4 border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <div className="font-bold">Laporan terkirim ✓</div>
          <div className="text-sm">
            ID kiriman <span className="font-mono font-semibold">{sentId}</span>. Status: Menunggu persetujuan leader.
          </div>
          <button className="mt-2 text-sm font-semibold underline" onClick={() => setSentId(null)}>
            Tutup
          </button>
        </div>
      )}

      {showErrors && result.errors.length > 0 && (
        <div className="card mb-4 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <div className="mb-1 font-bold">Belum bisa dikirim:</div>
          <ul className="list-disc pl-5">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
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
            <div className="input bg-slate-50 font-semibold">{member?.name ?? "(member tidak aktif)"}</div>
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
        <section className="card mb-4 p-4">
          <h2 className="mb-2 font-bold">Sudah dikirim {formatDateId(draft.workDate)}</h2>
          <ul className="space-y-2">
            {todayList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  <span className="font-mono">{s.id}</span> · {s.parts.length} part · qty {s.totals.qty.toLocaleString("id-ID")} ·{" "}
                  {formatDateTimeId(s.submittedAt)}
                </span>
                <StatusBadge status={s.status} />
                {s.status === "rejected" && s.leaderNote && (
                  <span className="w-full text-red-700">Alasan ditolak: {s.leaderNote}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 px-1 text-lg font-bold">Part</h2>
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
        className="btn-secondary mb-6 w-full border-dashed"
        onClick={() => setDraft((d) => ({ ...d, parts: [...d.parts, emptyPart(d.parts.at(-1)?.categoryId ?? null)] }))}
      >
        + Tambah part
      </button>

      <section className="card mb-4">
        <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => setLostOpen((o) => !o)}>
          <span className="text-lg font-bold">
            Lost time / Another job{" "}
            {draft.lostTimes.length > 0 && <span className="text-sm font-normal text-slate-500">({totals.lostMin} menit)</span>}
          </span>
          <span className="text-slate-400">{lostOpen ? "▴" : "▾"}</span>
        </button>
        {lostOpen && (
          <div className="space-y-3 border-t border-slate-100 p-4">
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
                + Tambah baris
              </button>
              {totals.remaining > 0 && (
                <button
                  type="button"
                  className="btn-secondary flex-1 border-amber-400 text-amber-800"
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
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-3 pt-2 text-center text-xs text-slate-500">
          <div>
            Qty<div className="text-base font-bold text-slate-900">{totals.qty.toLocaleString("id-ID")}</div>
          </div>
          <div>
            Menit normal<div className="text-base font-bold text-slate-900">{totals.minNormal}</div>
          </div>
          <div>
            Sisa dari {master.settings.normalMin}
            <div className={`text-base font-bold ${totals.remaining > 0 ? "text-amber-600" : totals.remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {totals.remaining}
            </div>
          </div>
          <div>
            Menit OT<div className="text-base font-bold text-slate-900">{totals.minOt}</div>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-3 pb-3 pt-2">
          <button type="button" className="btn-primary w-full py-3.5 text-lg" onClick={trySubmit}>
            Kirim
          </button>
        </div>
      </div>

      {summary && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-bold">Periksa sebelum kirim</h2>
            <p className="text-sm text-slate-600">
              {member?.name} · {formatDateId(draft.workDate)}
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-bold">Peringatan (tetap bisa dikirim, leader akan cek):</div>
                <ul className="list-disc pl-5">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {draft.parts.some((p) => p.partId) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Part</th>
                      <th className="p-2">MC</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Menit</th>
                      <th className="p-2 text-right">NG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.parts
                      .filter((p) => p.partId)
                      .map((p) => {
                        const part = master.parts.find((x) => x.id === p.partId);
                        const mc = master.machines.find((m) => m.id === p.machineId);
                        return (
                          <tr key={p.key} className="border-b border-slate-100">
                            <td className="p-2">
                              {part ? partLabel(part) : "-"}
                              <div className="text-xs text-slate-500">{master.categories.find((c) => c.id === p.categoryId)?.name}</div>
                            </td>
                            <td className="p-2">{mc?.mcNo ?? "-"}</td>
                            <td className="p-2 text-right">
                              {(p.qtyNormal ?? 0).toLocaleString("id-ID")}
                              {p.qtyOt ? <div className="text-xs text-slate-500">OT {p.qtyOt.toLocaleString("id-ID")}</div> : null}
                            </td>
                            <td className="p-2 text-right">
                              {p.minNormal ?? 0}
                              {p.minOt ? <div className="text-xs text-slate-500">OT {p.minOt}</div> : null}
                            </td>
                            <td className="p-2 text-right">{p.ng.reduce<number>((a, b) => a + (b ?? 0), 0)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            {draft.lostTimes.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="p-2">Lost time / Another job</th>
                    <th className="p-2 text-right">Menit</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lostTimes.map((l) => (
                    <tr key={l.key} className="border-b border-slate-100">
                      <td className="p-2">
                        {master.lostTimeTypes.find((t) => t.id === l.lostTimeTypeId)?.name}
                        {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
                      </td>
                      <td className="p-2 text-right">{l.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
              <div>
                Qty<div className="text-base font-bold text-slate-900">{totals.qty.toLocaleString("id-ID")}</div>
              </div>
              <div>
                Normal<div className="text-base font-bold text-slate-900">{totals.minNormal}</div>
              </div>
              <div>
                Lost<div className="text-base font-bold text-slate-900">{totals.lostMin}</div>
              </div>
              <div>
                OT<div className="text-base font-bold text-slate-900">{totals.minOt}</div>
              </div>
            </div>
            {serverErrors.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <ul className="list-disc pl-5">
                  {serverErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3">
            <button type="button" className="btn-secondary py-3.5" onClick={() => setSummary(false)} disabled={sending}>
              Kembali
            </button>
            <button type="button" className="btn-primary py-3.5" onClick={send} disabled={sending}>
              {sending ? "Mengirim…" : "Konfirmasi kirim"}
            </button>
          </div>
        </div>
      )}
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
        className={`input text-lg ${invalid ? "border-red-400" : ""}`}
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
    <section className="card mb-3 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-700">Part {index + 1}</h3>
        <button type="button" onClick={onRemove} className="text-sm text-red-600">
          Hapus
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <div className="mt-3 grid grid-cols-2 gap-3">
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
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700"
        onClick={() => onChange({ ngOpen: !row.ngOpen })}
      >
        <span>NG {ngTotal > 0 && <span className="ml-1 rounded bg-red-100 px-1.5 text-red-700">{ngTotal}</span>}</span>
        <span>{row.ngOpen ? "▴" : "▾"}</span>
      </button>
      {row.ngOpen && (
        <div className="mt-2 grid grid-cols-2 gap-3">
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
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">Baris {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-red-600">
          Hapus
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
