import Link from "next/link";
import type { QualityExtra, Report } from "@/lib/reports";
import { Spark } from "../DashboardCharts";
import { MiniLine, ParetoH, RateTrend } from "./QualityCharts";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number | null, d = 2) => (v == null ? "-" : `${(v * 100).toLocaleString("id-ID", { minimumFractionDigits: d > 1 ? 2 : 0, maximumFractionDigits: d })}%`);

const ICON = {
  x: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6",
  pct: "M19 5L5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  warn: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

function Card({ icon, tone = "red", label, value, unit, sub, spark }: { icon: string; tone?: "red" | "blue"; label: string; value: string; unit?: string; sub?: React.ReactNode; spark?: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 px-4 py-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-brand-50 text-brand-600"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={icon} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums leading-tight">
          {value} {unit && <span className="text-sm font-semibold text-slate-500">{unit}</span>}
        </div>
        {sub && <div className="text-xs">{sub}</div>}
      </div>
      {spark}
    </div>
  );
}

/** Perubahan vs periode sebelumnya yang sama panjang; tidak tampil kalau belum ada data pembanding. */
function Delta({ now, prev, kind }: { now: number | null; prev: number | null | undefined; kind: "pct" | "pt" | "n" }) {
  if (now == null || prev == null) return <span className="text-slate-400">belum ada pembanding</span>;
  const d = kind === "pct" ? (prev ? (now - prev) / prev : null) : now - prev;
  if (d == null) return <span className="text-slate-400">belum ada pembanding</span>;
  if (Math.abs(d) < 1e-9) return <span className="text-slate-500">sama dgn periode lalu</span>;
  const good = d < 0;
  const txt = kind === "pct" ? `${Math.abs(d * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : kind === "pt" ? `${Math.abs(d * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })} poin` : `${Math.abs(d)} jenis`;
  return (
    <span className={`font-semibold ${good ? "text-emerald-700" : "text-rose-700"}`}>
      {d > 0 ? "▲" : "▼"} {txt} <span className="font-normal text-slate-500">vs periode lalu</span>
    </span>
  );
}

function Seg({ items }: { items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
      {items.map((it) => (
        <Link key={it.label} href={it.href} scroll={false} className={`rounded-md px-2.5 py-1.5 ${it.on ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

const TH = "whitespace-nowrap border-y border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-500 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
const TD = "whitespace-nowrap border-b border-slate-100 px-2 py-2 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";

export default function QualityView({ report, query, ngLimit }: { report: Report; query: Record<string, string>; ngLimit: number }) {
  const q = report.quality as QualityExtra;
  const href = (path: string, patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(query);
    for (const [k, v] of Object.entries(patch)) if (v) sp.set(k, v);
    else sp.delete(k);
    const s = sp.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
  const here = `/reports/${report.kind}`;
  const all = query.top === "all";
  const over = (r: number | null) => r != null && r > ngLimit;
  const daily = q.days.map((_, i) => q.types.reduce((a, t) => a + t.spark[i], 0));

  const kpis =
    report.kind === "ng-type" ? (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card icon={ICON.x} label="Total NG" value={n0(q.ng)} unit="pcs" sub={<Delta now={q.ng} prev={q.prev?.ng} kind="pct" />} spark={<Spark kind="bar" data={daily} />} />
        <Card icon={ICON.pct} label="NG rate" value={pct(q.rate)} sub={<span className={over(q.rate) ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{over(q.rate) ? "Di luar target" : "Sesuai target"} · maks {pct(ngLimit)}</span>} />
        <Card icon={ICON.box} tone="blue" label="Hasil diperiksa" value={n0(q.qty)} unit="pcs" sub={<span className="text-slate-500">OK yang sudah disetujui</span>} />
        <Card icon={ICON.grid} label="Jumlah jenis NG" value={`${q.types.length}`} unit="jenis" sub={<Delta now={q.types.length} prev={q.prev?.types} kind="n" />} />
      </section>
    ) : (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card icon={ICON.box} label="Total part" value={n0(q.partCount)} unit="part" sub={<span className="text-slate-500">yang diproduksi di periode ini</span>} />
        <Card icon={ICON.x} label="Total NG" value={n0(q.ng)} unit="pcs" sub={<span className={over(q.rate) ? "font-semibold text-rose-700" : "text-slate-500"}>NG rate {pct(q.rate)}</span>} />
        <Card icon={ICON.box} tone="blue" label="Hasil diperiksa" value={n0(q.qty)} unit="pcs" />
        <Card icon={ICON.warn} label="Part dengan NG" value={`${q.partsWithNg}`} unit={q.partCount ? `part (${Math.round((q.partsWithNg / q.partCount) * 100)}%)` : "part"} sub={<span className="text-slate-500">{q.partCount - q.partsWithNg} part tanpa NG</span>} />
      </section>
    );

  if (report.kind === "ng-type") {
    const shown = all ? q.types : q.types.slice(0, 10);
    return (
      <>
        {kpis}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="card p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Pareto NG per jenis (pcs)</h2>
              <Seg items={[{ label: "10 terbesar", href: href(here, { top: null }), on: !all }, { label: "Semua", href: href(here, { top: "all" }), on: all }]} />
            </div>
            {shown.length ? <ParetoH data={shown} /> : <div className="grid h-48 place-items-center text-sm text-slate-500">Belum ada NG di periode ini.</div>}
            <p className="mt-1 text-xs text-slate-500">Batang = NG (pcs), garis = kumulatif (%). Fokus perbaikan pada jenis sampai kumulatif ±80%.</p>
          </section>
          <section className="card overflow-hidden">
            <h2 className="px-4 pb-3 pt-4 text-lg font-bold sm:px-5">Detail per jenis NG</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr>
                    <th className={TH}>No</th>
                    <th className={TH}>Jenis NG</th>
                    <th className={`${TH} text-right`}>NG (pcs)</th>
                    <th className={`${TH} text-right`}>Porsi</th>
                    <th className={`${TH} text-right`}>Kumulatif</th>
                    <th className={TH}>Tren</th>
                    <th className={`${TH} text-right`}>Tindakan</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {shown.map((t, i) => (
                    <tr key={t.name} className="hover:bg-slate-50">
                      <td className={`${TD} text-slate-500`}>{i + 1}</td>
                      <td className={`${TD} font-medium`}>{t.name}</td>
                      <td className={`${TD} text-right font-semibold`}>{n0(t.qty)}</td>
                      <td className={`${TD} text-right`}>{pct(t.share, 1)}</td>
                      <td className={`${TD} text-right ${t.cum <= 0.8 ? "font-semibold text-brand-600" : "text-slate-500"}`}>{pct(t.cum, 1)}</td>
                      <td className={TD}>
                        <MiniLine data={t.spark} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <Link href={href("/reports/ng-part", { ngt: t.name, top: null, fp: null })} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-brand-600 hover:text-brand-600">
                          Lihat part
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                        Belum ada NG di periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );
  }

  // Tab Per part
  const shown = all ? q.parts : q.parts.slice(0, 10);
  const f = q.focus;
  const ngt = query.ngt;
  return (
    <>
      {kpis}
      {ngt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-sm">
          Part dengan NG <b>{ngt}</b>, diurutkan dari yang terbanyak.
          <Link href={href(here, { ngt: null })} className="ml-auto font-semibold text-brand-600 hover:underline">
            Hapus filter jenis ×
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 min-[1700px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4 sm:px-5">
            <h2 className="text-lg font-bold">{all ? "Semua part" : "Top 10 part"} dengan NG {query.sort === "rate" ? "rate " : ""}tertinggi</h2>
            <div className="flex flex-wrap gap-2">
              {!ngt && <Seg items={[{ label: "NG (pcs)", href: href(here, { sort: null }), on: query.sort !== "rate" }, { label: "NG rate", href: href(here, { sort: "rate" }), on: query.sort === "rate" }]} />}
              <Seg items={[{ label: "Top 10", href: href(here, { top: null }), on: !all }, { label: "Semua", href: href(here, { top: "all" }), on: all }]} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>No</th>
                  <th className={TH}>Part</th>
                  <th className={TH}>Kategori</th>
                  <th className={`${TH} text-right`}>Hasil (pcs)</th>
                  {ngt && <th className={`${TH} text-right`}>{ngt}</th>}
                  <th className={`${TH} text-right`}>NG (pcs)</th>
                  <th className={`${TH} text-right`}>NG rate</th>
                  <th className={TH}>NG dominan</th>
                  <th className={TH}>Tren rate</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {shown.map((r, i) => {
                  const on = f?.partId === r.partId;
                  return (
                    <tr key={r.partId} className={on ? "bg-brand-50/70" : "hover:bg-slate-50"}>
                      <td className={`${TD} text-slate-500`}>{i + 1}</td>
                      <td className={`${TD} font-semibold`}>
                        <Link href={href(here, { fp: String(r.partId) })} scroll={false} className="hover:text-brand-600 hover:underline">
                          {r.part}
                        </Link>
                      </td>
                      <td className={`${TD} text-slate-600`}>{r.category}</td>
                      <td className={`${TD} text-right`}>{n0(r.qty)}</td>
                      {ngt && <td className={`${TD} text-right font-semibold`}>{n0(r.ngt)}</td>}
                      <td className={`${TD} text-right font-semibold`}>{n0(r.ng)}</td>
                      <td className={`${TD} text-right`}>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${over(r.rate) ? "bg-rose-50 text-rose-700" : "text-slate-700"}`}>{pct(r.rate)}</span>
                      </td>
                      <td className={TD}>{r.dominant}</td>
                      <td className={TD}>
                        <MiniLine data={r.spark} />
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                      Belum ada part dengan NG di periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-xs text-slate-500 sm:px-5">
            Klik nama part untuk melihat rinciannya. {query.sort === "rate" && "Urut NG rate hanya part dengan produksi ≥ 500 pcs."}
          </p>
        </section>

        {f ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-[1700px]:grid-cols-1">
            <section className="card p-4 sm:p-5">
              <h2 className="text-lg font-bold">Jenis NG untuk part {f.part}</h2>
              <div className="mt-3 flex flex-col gap-2">
                {f.types.map((t) => (
                  <div key={t.name} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                    <span className="truncate text-slate-700">{t.name}</span>
                    <div className="h-3 rounded bg-slate-100">
                      <div className={`h-3 rounded ${t.qty ? "bg-brand-600" : ""}`} style={{ width: `${Math.max(t.qty ? 2 : 0, t.share * 100)}%` }} />
                    </div>
                    <span className="w-24 text-right tabular-nums">
                      <b>{n0(t.qty)}</b> <span className="text-xs text-slate-500">({pct(t.share, 0)})</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-4 sm:p-5">
              <h2 className="text-lg font-bold">Tren NG rate part {f.part}</h2>
              <RateTrend data={f.trend} limit={ngLimit} />
            </section>
            <section className="card overflow-hidden lg:col-span-2 min-[1700px]:col-span-1">
              <div className="flex items-baseline justify-between gap-2 px-4 pb-3 pt-4 sm:px-5">
                <h2 className="text-lg font-bold">Detail per lot</h2>
                <Link href={href("/reports/ng-lot", { part: String(f.partId), fp: null, ngt: null, top: null, sort: null })} className="text-sm font-semibold text-brand-600 hover:underline">
                  Lihat semua lot ›
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr>
                      <th className={TH}>Lot</th>
                      <th className={TH}>Tanggal</th>
                      <th className={`${TH} text-right`}>Hasil</th>
                      <th className={`${TH} text-right`}>NG</th>
                      <th className={`${TH} text-right`}>NG rate</th>
                      <th className={TH}>NG dominan</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {f.lots.map((l) => (
                      <tr key={l.lot}>
                        <td className={`${TD} font-medium`}>{l.lot}</td>
                        <td className={TD}>{`${+l.date.slice(8, 10)}/${+l.date.slice(5, 7)}`}</td>
                        <td className={`${TD} text-right`}>{n0(l.qty)}</td>
                        <td className={`${TD} text-right font-semibold`}>{n0(l.ng)}</td>
                        <td className={`${TD} text-right ${over(l.rate) ? "font-semibold text-rose-700" : ""}`}>{pct(l.rate)}</td>
                        <td className={TD}>{l.dominant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <section className="card grid place-items-center p-10 text-sm text-slate-500">Pilih part untuk melihat rincian.</section>
        )}
      </div>
    </>
  );
}
