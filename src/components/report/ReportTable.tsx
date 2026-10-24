"use client";
import { useEffect, useState } from "react";
import type { Column, Row, Table } from "@/lib/reports";
import { formatCell } from "@/lib/format";
import { Grade } from "@/components/ui";
import ShowAll from "./ShowAll";

const isNum = (f?: string) => !!f && f !== "text" && f !== "grade" && f !== "date";
/** Tabel rincian dilipat setelah baris ini. */
const FOLD = 10;
/** Kolom yang paling penting dilihat di HP, urut prioritas. Sisanya ada di panel detail baris. */
const PRIORITY = ["qty", "ach", "ngPpm", "status", "util", "grade", "hours", "ng", "onTime", "minutes", "total"];
const MOBILE_COLS = 3;

function mobileKeys(cols: Column[]) {
  const rest = cols.slice(1);
  const picked = PRIORITY.filter((k) => rest.some((c) => c.key === k)).slice(0, MOBILE_COLS);
  for (const c of rest) if (picked.length < MOBILE_COLS && !picked.includes(c.key)) picked.push(c.key);
  return new Set([cols[0]?.key, ...picked]);
}

function Cell({ r, c }: { r: Row; c: Column }) {
  if (c.format === "grade") return <Grade g={String(r[c.key] ?? "")} />;
  if (c.key === "status" && (r[c.key] === "OK" || r[c.key] === "Di bawah target"))
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r[c.key] === "OK" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{r[c.key]}</span>;
  return <>{formatCell(r[c.key], c.format)}</>;
}

/** Tabel report. Di HP hanya kolom utama yang tampil; ketuk baris untuk melihat semua kolom di panel bawah. */
export default function ReportTable({ t }: { t: Table }) {
  const [sel, setSel] = useState<Row | null>(null);
  const show = mobileKeys(t.columns);
  const hides = t.columns.length > show.size;
  const fold = t.detail && t.rows.length > FOLD + 2;
  useEffect(() => {
    if (!sel) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [sel]);

  return (
    <section className="group card overflow-hidden" data-open="false">
      <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4">
        <div>
          <h2 className="text-lg font-bold">{t.title}</h2>
          {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
          {hides && t.rows.length > 0 && <p className="text-xs text-slate-400 sm:hidden">Ketuk baris untuk melihat semua kolom.</p>}
        </div>
        {t.rows.length > 0 && <span className="shrink-0 text-xs text-slate-500">{t.rows.length} baris</span>}
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white text-left">
            <tr>
              {t.columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap border-b border-slate-200 px-2 py-2.5 text-xs font-medium text-slate-500 first:pl-4 last:pr-4 sm:px-3 sm:first:pl-5 sm:last:pr-5 ${isNum(c.format) ? "text-right" : ""} ${c.format === "grade" ? "text-center" : ""} ${show.has(c.key) ? "" : "hidden sm:table-cell"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.length === 0 && (
              <tr>
                <td colSpan={t.columns.length} className="px-3 py-10 text-center text-slate-400">
                  Belum ada data di periode ini.
                </td>
              </tr>
            )}
            {[...t.rows, ...(t.total && t.rows.length ? [t.total] : [])].map((r, i) => {
              const isTotal = !!t.total && i === t.rows.length;
              const missing = r.status === "Belum lapor";
              const idle = r.status === "Tidak jalan";
              return (
                <tr
                  key={i}
                  onClick={hides ? () => setSel(r) : undefined}
                  className={`border-t border-slate-100 ${isTotal ? "border-t-2 border-slate-300 bg-brand-50/60 font-bold" : "hover:bg-slate-50"} ${missing ? "bg-orange-50/60 text-orange-900" : ""} ${idle ? "text-slate-400" : ""} ${fold && i >= FOLD && !isTotal ? "group-data-[open=false]:hidden" : ""} ${hides ? "cursor-pointer sm:cursor-auto" : ""}`}
                >
                  {t.columns.map((c, j) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-2 py-2.5 first:pl-4 last:pr-4 sm:px-3 sm:first:pl-5 sm:last:pr-5 ${isNum(c.format) ? "text-right tabular-nums" : ""} ${c.format === "grade" ? "text-center" : ""} ${j === 0 && !isTotal ? "font-medium" : ""} ${show.has(c.key) ? "" : "hidden sm:table-cell"}`}
                    >
                      <Cell r={r} c={c} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fold && <ShowAll total={t.rows.length} shown={FOLD} />}

      {sel && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label={`Detail ${String(sel[t.columns[0].key] ?? "")}`}>
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSel(null)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">{t.title}</div>
                <div className="text-lg font-bold">{formatCell(sel[t.columns[0].key], t.columns[0].format)}</div>
              </div>
              <button type="button" onClick={() => setSel(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                Tutup
              </button>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              {t.columns.slice(1).map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-slate-500">{c.label}</dt>
                  <dd className={`text-right font-medium ${isNum(c.format) ? "tabular-nums" : ""}`}>
                    <Cell r={sel} c={c} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
