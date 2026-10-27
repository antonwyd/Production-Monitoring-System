import Link from "next/link";
import type { MachineExtra, MachineRow, Report } from "@/lib/reports";
import { MachineBars, MachineTrend, UtilBars } from "./MachineCharts";

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const d1 = (v: number | null) => (v == null ? "-" : v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pct = (v: number | null, d = 1) => (v == null ? "-" : `${(v * 100).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);

const ICON = {
  mc: "M3 7h18v10H3zM7 17v3M17 17v3M7 11h4M15 11h2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bars: "M6 20V14M12 20V8M18 20V4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

function Card({ icon, label, value, sub, bad, good }: { icon: string; label: string; value: string; sub: React.ReactNode; bad?: boolean; good?: boolean }) {
  return (
    <div className={`card flex items-center gap-3 px-4 py-4 ${bad ? "border-l-4 border-l-brand-600" : ""}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${good ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-600"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={icon} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
        <div className="text-xs">{sub}</div>
      </div>
    </div>
  );
}

/** Selisih ke target dalam poin persen, merah bila di luar target. */
function VsTarget({ v, target, lower }: { v: number | null; target: number; lower?: boolean }) {
  if (v == null) return <span className="text-slate-400">belum ada data</span>;
  const ok = lower ? v <= target : v >= target;
  if (ok)
    return (
      <span className="font-semibold text-emerald-700">
        ✓ Sesuai target ({lower ? "maks " : ""}
        {pct(target, lower ? 2 : 0)})
      </span>
    );
  const d = (v - target) * 100;
  return (
    <span className="font-semibold text-rose-700">
      {d > 0 ? "▲" : "▼"} {d.toLocaleString("id-ID", { maximumFractionDigits: lower ? 2 : 1, signDisplay: "always" })} poin{" "}
      <span className="font-normal text-slate-500">
        · target {lower ? "maks " : ""}
        {pct(target, lower ? 2 : 0)}
      </span>
    </span>
  );
}

function Seg({ items }: { items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
      {items.map((it) => (
        <Link key={it.label} href={it.href} scroll={false} className={`rounded-md px-2.5 py-1.5 ${it.on ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

function Status({ s }: { s: string }) {
  const c = s === "OK" ? "bg-emerald-50 text-emerald-700" : s === "Tidak jalan" ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${c}`}>{s}</span>;
}

function Oee({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-400">-</span>;
  const c = v >= 0.85 ? "bg-emerald-100 text-emerald-800" : v >= 0.6 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
  return <span className={`inline-block min-w-16 rounded-md px-2 py-0.5 text-center text-xs font-bold ${c}`}>{pct(v)}</span>;
}

const TH = "whitespace-nowrap border-y border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-500 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
const TD = "whitespace-nowrap border-b border-slate-100 px-2 py-2 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";

/** Nama pendek mesin untuk sumbu grafik: tambahkan kata pertama kategori bila ada lebih dari satu kategori. */
function shortName(rows: MachineRow[]) {
  const multi = new Set(rows.map((r) => r.category)).size > 1;
  return (r: MachineRow) => (multi ? `${r.category.split(" ")[0]} ${r.mcNo.replace(/^MC\s*/i, "")}` : r.mcNo);
}

function heatColor(v: number | null) {
  if (v == null) return { background: "#f8fafc", color: "#cbd5e1" };
  const a = Math.min(1, Math.max(0.08, v));
  return { background: `rgba(155,27,31,${a.toFixed(2)})`, color: a > 0.55 ? "#fff" : "#1e293b" };
}

export default function MachineView({ report, query }: { report: Report; query: Record<string, string> }) {
  const m = report.machine as MachineExtra;
  const here = "/reports/machine";
  const href = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(query);
    for (const [k, v] of Object.entries(patch)) if (v) sp.set(k, v);
    else sp.delete(k);
    const s = sp.toString();
    return `${here}${s ? `?${s}` : ""}`;
  };
  const name = shortName(m.rows);
  const running = m.rows.filter((r) => r.status !== "Tidak jalan");
  const view = query.view === "grafik" || query.view === "heatmap" ? query.view : "tabel";
  const f = m.focus;
  const fr = query.fr ?? "";

  return (
    <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card icon={ICON.mc} label="Mesin jalan" value={`${m.running} dari ${m.total}`} sub={<span className="text-slate-500">{m.total - m.running} mesin tidak jalan di periode ini</span>} />
        <Card
          icon={ICON.gear}
          label="Utilisasi mesin yang jalan"
          value={pct(m.runUtil)}
          bad={m.runUtil != null && m.runUtil < m.utilTarget}
          sub={
            <>
              <VsTarget v={m.runUtil} target={m.utilTarget} />
              <div className="text-slate-500">semua mesin {pct(m.avgUtil, 0)}</div>
            </>
          }
        />
        <Card icon={ICON.bars} label="Efisiensi vs Std MC" value={pct(m.eff)} bad={m.eff != null && m.eff < m.effTarget} sub={<VsTarget v={m.eff} target={m.effTarget} />} />
        <Card icon={ICON.shield} label="NG rate" value={pct(m.rate, 2)} good={m.rate != null && m.rate <= m.ngMax} sub={<VsTarget v={m.rate} target={m.ngMax} lower />} />
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-2 text-lg font-bold">Utilisasi mesin yang jalan (urut tertinggi)</h2>
        {running.length ? (
          <UtilBars data={[...running].sort((a, b) => (b.util ?? 0) - (a.util ?? 0)).map((r) => ({ name: name(r), util: r.util }))} target={m.utilTarget} />
        ) : (
          <div className="grid h-48 place-items-center text-sm text-slate-500">Belum ada mesin jalan di periode ini.</div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Semua mesin</h2>
            <p className="max-w-3xl text-xs text-slate-500">
              Utilisasi = jam mesin jalan ÷ ({m.workDays} hari kerja x jam tersedia per hari: {m.hrsNote}; ubah di Master Data &gt; Setting). OEE kira-kira = utilisasi x efisiensi x (1 − NG rate).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={here} className="flex">
              {Object.entries(query)
                .filter(([k]) => k !== "q" && k !== "fm")
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              <input name="q" defaultValue={query.q ?? ""} placeholder="Cari mesin, line, atau kategori…" className="h-9 w-56 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-600" />
            </form>
            <Seg
              items={[
                { label: "Tabel", href: href({ view: null }), on: view === "tabel" },
                { label: "Grafik", href: href({ view: "grafik" }), on: view === "grafik" },
                { label: "Heatmap", href: href({ view: "heatmap" }), on: view === "heatmap" },
              ]}
            />
          </div>
        </div>

        {view === "grafik" ? (
          <div className="px-2 pb-4 sm:px-4">
            {running.length ? <MachineBars data={running.map((r) => ({ name: name(r), util: r.util, eff: r.eff, oee: r.oee }))} /> : <div className="grid h-48 place-items-center text-sm text-slate-500">Belum ada mesin jalan.</div>}
          </div>
        ) : view === "heatmap" ? (
          <div className="overflow-x-auto pb-3">
            <table className="text-xs tabular-nums">
              <thead>
                <tr>
                  <th className={`${TH} sticky left-0 z-10`}>Mesin</th>
                  {m.days.map((d) => (
                    <th key={d} className={`${TH} text-center`}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white py-1 pl-4 pr-3 font-medium sm:pl-5">
                      <Link href={href({ fm: r.key })} scroll={false} className="hover:text-brand-600">
                        {r.mcNo} <span className="font-normal text-slate-400">{r.category}</span>
                      </Link>
                    </td>
                    {m.heat[i].map((v, j) => (
                      <td key={j} className="border border-white p-0">
                        <div className="grid h-7 min-w-11 place-items-center px-1" style={heatColor(v)} title={`${r.mcNo} ${m.days[j]}: ${v == null ? "tidak jalan" : pct(v, 0)}`}>
                          {v == null ? "·" : Math.round(v * 100)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 pt-2 text-xs text-slate-500 sm:px-5">Angka = utilisasi harian (%). Makin gelap makin tinggi. Titik = mesin tidak jalan hari itu.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={TH}>Kategori</th>
                  <th className={TH}>Mesin</th>
                  <th className={TH}>Line</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Hari jalan</th>
                  <th className={`${TH} text-right`}>Jam jalan</th>
                  <th className={`${TH} text-right`}>Utilisasi</th>
                  <th className={`${TH} text-right`}>Hasil (pcs)</th>
                  <th className={`${TH} text-right`}>Hasil per jam</th>
                  <th className={`${TH} text-right`}>Jam standar MC</th>
                  <th className={`${TH} text-right`}>Efisiensi</th>
                  <th className={`${TH} text-right`}>NG rate</th>
                  <th className={`${TH} text-center`}>OEE (kira-kira)</th>
                  <th className={`${TH} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {m.rows.map((r) => {
                  const on = f?.key === r.key;
                  const idle = r.status === "Tidak jalan";
                  return (
                    <tr key={r.key} className={on ? "bg-sky-50" : "hover:bg-slate-50"}>
                      <td className={`${TD} font-semibold`}>{r.category}</td>
                      <td className={TD}>{r.mcNo}</td>
                      <td className={`${TD} text-slate-600`}>{r.line || "-"}</td>
                      <td className={TD}>
                        <Status s={r.status} />
                      </td>
                      <td className={`${TD} text-right`}>{r.days}</td>
                      <td className={`${TD} text-right`}>{d1(r.mcHours)}</td>
                      <td className={`${TD} text-right`}>{pct(r.util)}</td>
                      <td className={`${TD} text-right`}>{n0(r.qty)}</td>
                      <td className={`${TD} text-right`}>{d1(r.pcsHr)}</td>
                      <td className={`${TD} text-right`}>{d1(r.stdHours)}</td>
                      <td className={`${TD} text-right`}>{pct(r.eff)}</td>
                      <td className={`${TD} text-right`}>{idle ? "-" : pct(r.ngRate, 2)}</td>
                      <td className={`${TD} text-center`}>
                        <Oee v={r.oee} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <Link href={href({ fm: r.key })} scroll={false} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:border-brand-600 hover:text-brand-600">
                          Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!m.rows.length && (
                  <tr>
                    <td colSpan={14} className="px-5 py-10 text-center text-slate-500">
                      Tidak ada mesin yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {f && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={ICON.mc} />
              </svg>
            </span>
            <h2 className="text-2xl font-bold">{f.mcNo}</h2>
            <span className="text-sm text-slate-500">
              {f.category} | Line: {f.line || "-"}
            </span>
            <Status s={f.status} />
            <div className="ml-auto">
              <Seg
                items={[
                  { label: "Periode laporan", href: href({ fr: null }), on: !fr },
                  { label: "Hari terakhir", href: href({ fr: "1" }), on: fr === "1" },
                  { label: "7 hari", href: href({ fr: "7" }), on: fr === "7" },
                  { label: "30 hari", href: href({ fr: "30" }), on: fr === "30" },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-5 xl:grid-cols-10">
            {[
              ["Hari jalan", `${f.days} hari`],
              ["Jam jalan", `${d1(f.mcHours)} jam`],
              ["Jam tersedia", `${d1(f.availHrs)} jam`],
              ["Utilisasi", pct(f.util)],
              ["Hasil produksi", `${n0(f.qty)} pcs`],
              ["Hasil per jam", f.pcsHr == null ? "-" : `${n0(f.pcsHr)} pcs`],
              ["Jam standar MC", f.stdHours == null ? "-" : `${d1(f.stdHours)} jam`],
              ["Efisiensi", pct(f.eff)],
              ["NG rate", pct(f.ngRate, 2)],
            ].map(([k, v]) => (
              <div key={k} className="px-4 py-3">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="text-lg font-bold tabular-nums">{v}</div>
              </div>
            ))}
            <div className="bg-amber-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-600">OEE (kira-kira)</div>
              <div className="text-2xl font-bold tabular-nums text-amber-700">{pct(f.oee)}</div>
            </div>
          </div>
          <div className="px-4 pb-4 pt-3 sm:px-5">
            <h3 className="mb-1 text-sm font-semibold text-slate-600">Tren harian utilisasi & efisiensi</h3>
            <MachineTrend data={f.trend} />
          </div>
        </section>
      )}
    </>
  );
}
