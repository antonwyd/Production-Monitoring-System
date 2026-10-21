"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SETTING_LABELS, type MasterDef } from "@/lib/adminConfig";

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
    <div className="mx-auto max-w-7xl px-3 py-4">
      <Link href="/admin" className="text-sm text-brand-700">
        ← Master data
      </Link>
      <div className="mb-3 mt-1 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{def.title}</h1>
          <p className="text-sm text-slate-600">{def.description}</p>
        </div>
        <input className="input max-w-xs" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
        {hasActive && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan tidak aktif
          </label>
        )}
        <button
          className="btn-primary"
          onClick={() => {
            setErrors([]);
            setEditing(Object.fromEntries(def.fields.map((f) => [f.key, f.type === "bool" ? true : ""])));
          }}
        >
          + Tambah
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              {fields.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-2">
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={String(r[idKey])} className={`border-t border-slate-100 ${hasActive && !r.active ? "text-slate-400" : ""}`}>
                {fields.map((f) => (
                  <td key={f.key} className="whitespace-nowrap px-3 py-2">
                    {display(f.key, r[f.key])}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    className="font-semibold text-brand-700"
                    onClick={() => {
                      setErrors([]);
                      setEditing({ ...r });
                    }}
                  >
                    Ubah
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={fields.length + 1} className="px-3 py-8 text-center text-slate-400">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{filtered.length} baris</p>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="mb-3 text-lg font-bold">
              {editing[idKey] == null || editing[idKey] === "" ? "Tambah" : "Ubah"} {def.title.toLowerCase()}
            </h2>
            <div className="space-y-3">
              {def.fields.map((f) => {
                const v = editing[f.key];
                const set = (val: unknown) => setEditing({ ...editing, [f.key]: val });
                const lockKey = def.idKey === f.key && rows.some((r) => r[idKey] === editing[idKey]);
                return (
                  <label key={f.key} className="block">
                    <span className="label">
                      {f.label}
                      {f.required && " *"}
                      {def.key === "settings" && f.key === "value" && editing.key ? ` · ${SETTING_LABELS[String(editing.key)] ?? ""}` : ""}
                    </span>
                    {f.type === "bool" ? (
                      <input type="checkbox" className="h-5 w-5" checked={!!v} onChange={(e) => set(e.target.checked)} />
                    ) : f.type === "select" ? (
                      <select className="input" value={v == null ? "" : String(v)} onChange={(e) => set(e.target.value)}>
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
                    {f.hint && <span className="text-xs text-slate-500">{f.hint}</span>}
                  </label>
                );
              })}
            </div>
            {errors.length > 0 && (
              <ul className="mt-3 list-disc rounded-lg bg-red-50 p-3 pl-7 text-sm text-red-800">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>
                Batal
              </button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
