"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SETTING_LABELS, type MasterDef } from "@/lib/adminConfig";
import Icon from "@/components/Icon";

type Opt = { value: string | number; label: string };
type Row = Record<string, unknown>;

export default function MasterTable({ def }: { def: MasterDef }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Record<string, Opt[]>>({});
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const idKey = def.idKey ?? "id";
  const hasActive = def.fields.some((f) => f.key === "active");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/${def.key}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setOptions(data.options);
    }
  }, [def.key]);
  useEffect(() => {
    load();
  }, [load]);

  const display = (key: string, v: unknown) => {
    const f = def.fields.find((x) => x.key === key);
    if (f?.type === "bool") return v ? "Ya" : "Tidak";
    if (f?.type === "select" && f.options) return options[f.options]?.find((o) => o.value === v)?.label ?? (v == null ? "-" : String(v));
    if (key === "key" && def.key === "settings") return SETTING_LABELS[String(v)] ?? String(v);
    return v == null || v === "" ? "-" : String(v);
  };

  const filtered = useMemo(() => {
    const nq = q.toLowerCase();
    return rows.filter(
      (r) =>
        (showInactive || !hasActive || r.active) &&
        (!nq || def.fields.some((f) => display(f.key, r[f.key]).toLowerCase().includes(nq))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, showInactive, options]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErrors([]);
    const isNew = idKey === "id" ? editing.id == null : !rows.some((r) => r[idKey] === editing[idKey]);
    const res = await fetch(`/api/admin/${def.key}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErrors(data.errors ?? [data.error]);
    setEditing(null);
    load();
  }

  const fields = def.fields.filter((f) => f.type !== "pin");
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6">
      <Link href="/admin" className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <Icon name="chevronLeft" size={16} />
        Master data
      </Link>
      <header className="mt-2 mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{def.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{def.description}</p>
        </div>
        <button
          className="btn-primary btn-sm min-h-10 shrink-0 self-start sm:self-auto sm:px-4"
          onClick={() => {
            setErrors([]);
            setEditing(Object.fromEntries(def.fields.map((f) => [f.key, f.type === "bool" ? true : ""])));
          }}
        >
          <Icon name="plus" size={16} />
          Tambah
        </button>
      </header>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input className="input py-2 pl-9" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hasActive && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan tidak aktif
            </label>
          )}
          <span className="num ml-auto text-xs text-slate-500">{filtered.length} baris</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="data-table">
            <thead className="text-left">
              <tr>
                {fields.map((f) => (
                  <th key={f.key} className={f.type === "number" ? "text-right" : ""}>
                    {f.label}
                  </th>
                ))}
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const inactive = hasActive && !r.active;
                return (
                  <tr key={String(r[idKey])} className={inactive ? "[&>td]:text-slate-400" : ""}>
                    {fields.map((f, i) => {
                      const f2 = def.fields.find((x) => x.key === f.key);
                      return (
                        <td key={f.key} className={`${f.type === "number" ? "text-right" : ""} ${i === 0 && !inactive ? "font-medium text-slate-900" : ""}`}>
                          {f2?.type === "bool" ? (
                            r[f.key] ? (
                              <span className="badge-success">Ya</span>
                            ) : (
                              <span className="badge-neutral">Tidak</span>
                            )
                          ) : (
                            display(f.key, r[f.key])
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right">
                      <button
                        className="btn-ghost btn-sm -my-1 min-h-8 px-2 py-1 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
                        onClick={() => {
                          setErrors([]);
                          setEditing({ ...r });
                        }}
                      >
                        <Icon name="edit" size={14} />
                        Ubah
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={fields.length + 1} className="py-12 text-center text-slate-400">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-title" className="flex max-h-[92vh] w-full max-w-lg animate-sheet-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 id="edit-title" className="text-lg font-semibold tracking-tight">
                {editing[idKey] == null || editing[idKey] === "" ? "Tambah" : "Ubah"} {def.title.toLowerCase()}
              </h2>
              <button className="btn-ghost btn-sm -mr-2 px-2" onClick={() => setEditing(null)} disabled={busy} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {def.fields.map((f) => {
                const v = editing[f.key];
                const set = (val: unknown) => setEditing({ ...editing, [f.key]: val });
                const lockKey = def.idKey === f.key && rows.some((r) => r[idKey] === editing[idKey]);
                if (f.type === "bool")
                  return (
                    <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <span className="text-sm font-medium text-slate-700">{f.label}</span>
                      <input type="checkbox" className="h-5 w-5" checked={!!v} onChange={(e) => set(e.target.checked)} />
                    </label>
                  );
                return (
                  <label key={f.key} className="block">
                    <span className="label">
                      {f.label}
                      {f.required && <span className="text-red-600"> *</span>}
                      {def.key === "settings" && f.key === "value" && editing.key ? (
                        <span className="font-normal text-slate-500"> · {SETTING_LABELS[String(editing.key)] ?? ""}</span>
                      ) : null}
                    </span>
                    {f.type === "select" ? (
                      <select className="select" value={v == null ? "" : String(v)} onChange={(e) => set(e.target.value)}>
                        <option value="">-</option>
                        {(options[f.options!] ?? []).map((o) => (
                          <option key={String(o.value)} value={String(o.value)}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input"
                        type={f.type === "pin" ? "password" : "text"}
                        inputMode={f.type === "number" || f.type === "pin" ? "decimal" : undefined}
                        value={v == null ? "" : String(v)}
                        disabled={lockKey}
                        onChange={(e) => set(e.target.value)}
                      />
                    )}
                    {f.hint && <span className="mt-1 block text-xs text-slate-500">{f.hint}</span>}
                  </label>
                );
              })}
              {errors.length > 0 && (
                <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <Icon name="alertCircle" size={16} className="mt-0.5" />
                  <ul className="list-disc pl-4">
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6 sm:pb-4">
              <button className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>
                Batal
              </button>
              <button className="btn-primary sm:px-6" onClick={save} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
