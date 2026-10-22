"use client";
import { useEffect, useMemo, useState } from "react";

export type FieldSpec = { key: string; label: string; kind: string; options?: string[]; required?: boolean; width?: number; hint?: string };
export type TableSpec = { id: string; title: string; desc: string; fields: FieldSpec[]; fixed?: boolean };
type Row = Record<string, string> & { _id: string };

let seq = 0;
const withId = (r: Record<string, string>): Row => ({ ...r, _id: `r${++seq}` });

export default function MasterEditor({ table }: { table: TableSpec }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [orig, setOrig] = useState("");
  const [version, setVersion] = useState("");
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/master?table=${table.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat data.");
      const rs = (j.rows as Record<string, string>[]).map(withId);
      setRows(rs);
      setOrig(JSON.stringify(j.rows));
      setVersion(j.version);
      setOptions(j.options ?? {});
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal memuat data." });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  const clean = (rs: Row[]) => rs.map(({ _id, ...r }) => r);
  const dirty = !loading && orig !== "" && JSON.stringify(clean(rows)) !== orig;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? rows.filter((r) => table.fields.some((x) => (r[x.key] ?? "").toLowerCase().includes(f))) : rows;
  }, [rows, filter, table.fields]);

  function set(id: string, key: string, v: string) {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, [key]: v } : r)));
  }
  function addRow() {
    const blank: Record<string, string> = {};
    for (const f of table.fields) blank[f.key] = f.kind === "status" && f.options ? f.options[0] : "";
    setRows((rs) => [...rs, withId(blank)]);
    setFilter("");
    setTimeout(() => document.getElementById("master-bottom")?.scrollIntoView({ behavior: "smooth" }), 50);
  }
  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: table.id, version, rows: clean(rows) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan.");
      await load();
      setMsg({ ok: true, text: `Tersimpan ke Google Sheet (${j.rows} baris). Form member memakai data baru paling lambat 1 menit lagi.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 className="text-lg font-bold">{table.title}</h2>
          <p className="text-sm text-slate-500">{table.desc}</p>
        </div>
        {!table.fixed && (
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari…" className="input h-11 w-48" />
        )}
        {!table.fixed && (
          <button className="btn-secondary h-11" onClick={addRow} disabled={loading}>
            + Tambah baris
          </button>
        )}
        <button className="btn-primary h-11" onClick={save} disabled={!dirty || saving}>
          {saving && <span className="spinner" aria-hidden />}
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      {msg && <div className={`anim-in px-5 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-orange-50 text-orange-900"}`}>{msg.text}</div>}
      {dirty && !msg && <div className="bg-brand-50 px-5 py-2 text-sm text-brand-700">Ada perubahan yang belum disimpan.</div>}
      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Memuat dari Google Sheet…</p>
      ) : (
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left">
                <th className="w-12 border-b border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500">#</th>
                {table.fields.map((f) => (
                  <th key={f.key} className="border-b border-slate-200 px-2 py-2.5 text-xs font-medium text-slate-500" style={{ minWidth: f.width }}>
                    {f.label}
                    {f.required && <span className="text-brand-600"> *</span>}
                    {f.hint && <div className="font-normal text-slate-400">{f.hint}</div>}
                  </th>
                ))}
                {!table.fixed && <th className="w-12 border-b border-slate-200" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r._id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-xs text-slate-400 tabular-nums">{rows.indexOf(r) + 1}</td>
                  {table.fields.map((f) => (
                    <td key={f.key} className="px-1.5 py-1.5">
                      {f.kind === "auto" ? (
                        <span className="px-1.5 text-slate-500">{r[f.key] || (f.key === "no" || f.key === "code" ? "otomatis" : "-")}</span>
                      ) : f.kind === "select" || f.kind === "status" ? (
                        <select value={r[f.key] ?? ""} onChange={(e) => set(r._id, f.key, e.target.value)} className="input h-10 w-full py-1">
                          <option value="">{f.kind === "status" ? "-" : "Pilih…"}</option>
                          {[...new Set([...(options[f.key] ?? f.options ?? []), ...(r[f.key] ? [r[f.key]] : [])])].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={r[f.key] ?? ""}
                          onChange={(e) => set(r._id, f.key, e.target.value)}
                          inputMode={f.kind === "number" ? "decimal" : undefined}
                          className={`input h-10 w-full py-1 ${f.kind === "number" ? "text-right tabular-nums" : ""}`}
                        />
                      )}
                    </td>
                  ))}
                  {!table.fixed && (
                    <td className="px-1.5 text-center">
                      <button
                        title="Hapus baris"
                        className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => setRows((rs) => rs.filter((x) => x._id !== r._id))}
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={table.fields.length + 2} className="px-5 py-10 text-center text-slate-400">
                    {filter ? "Tidak ada yang cocok." : "Belum ada data."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div id="master-bottom" />
        </div>
      )}
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        {rows.length} baris · Perubahan baru masuk ke Google Sheet setelah tombol Simpan ditekan.
      </div>
    </section>
  );
}
