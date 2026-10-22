import AppShell from "@/components/AppShell";
import { StatusDonut, TrendChart } from "@/components/DashboardCharts";
import DateNav from "@/components/DateNav";
import QueueList from "@/components/QueueList";
import { Empty } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { addDays, isValidDate, todayJakarta } from "@/lib/dates";
import { buildToday, type Trend } from "@/lib/views";

export const metadata = { title: "Dashboard · Produksi QA" };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number | null, d = 2) => (v == null ? "-" : `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: d })}%`);

// Ikon kartu (garis 24x24).
const ICON = {
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  doc: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5",
};

function KpiCard({ icon, title, children }: { icon: keyof typeof ICON; title: string; children: React.ReactNode }) {
  return (
    <div className="card flex gap-4 p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON[icon]} />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {children}
      </div>
    </div>
  );
}

function TrendText({ t }: { t: Trend }) {
  if (!t) return null;
  return <span className={`font-semibold ${t.good ? "text-emerald-700" : "text-orange-700"}`}>{t.text}</span>;
}

export default async function HariIniPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const today = todayJakarta();
  const date = isValidDate(q.date) ? q.date : today;
  const v = await buildToday(date);
  const s = v.stats;
  const done = Math.max(0, s.reported - s.waiting);
  return (
    <AppShell session={session} active="hari-ini">
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-12 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-[28px]">Dashboard Produksi &amp; QA</h1>
            <p className="text-sm text-slate-500">Monitoring hasil produksi, kualitas, dan aktivitas laporan</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateNav date={date} max={today} label={v.dateLabel} />
            <a className="btn-primary h-11" href={`/api/export/hari-ini.xlsx?date=${date}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Download Excel
            </a>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon="box" title="Hasil Produksi">
            <div className="text-3xl font-bold tabular-nums">
              {n0(s.qty)} <span className="text-base font-semibold text-slate-500">pcs</span>
            </div>
            <div className="text-xs text-slate-500">{s.qtyTrend ? <TrendText t={s.qtyTrend} /> : "yang sudah disetujui"}</div>
          </KpiCard>
          <KpiCard icon="shield" title="NG">
            <div className="text-3xl font-bold tabular-nums">
              {n0(s.ng)} <span className="text-base font-semibold text-slate-500">pcs</span>
            </div>
            <div className="text-xs text-slate-500">
              NG rate <b className="text-slate-800">{pct(s.rate)}</b> {s.rateTrend && <TrendText t={s.rateTrend} />}
            </div>
          </KpiCard>
          <KpiCard icon="target" title="Achievement">
            <div className="text-3xl font-bold tabular-nums">
              {pct(s.ach, 0)} {s.ach != null && <span className="text-base font-semibold text-slate-500">Grade {s.grade}</span>}
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.round((s.ach ?? 0) * 100))}%` }} />
            </div>
            <div className="text-right text-xs text-slate-500">Target {s.target}%</div>
          </KpiCard>
          <KpiCard icon="doc" title="Laporan Masuk">
            <div className="flex items-center gap-2 text-3xl font-bold tabular-nums">
              {s.reported} / {v.expected}
              {v.expected > 0 && s.reported >= v.expected && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {s.waiting} menunggu, {v.missing.length} belum kirim
            </div>
          </KpiCard>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section className="card p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Tren Produksi &amp; NG (7 hari terakhir)</h2>
              <a href={`/laporan?from=${addDays(date, -6)}&to=${date}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Lihat laporan ›
              </a>
            </div>
            <TrendChart data={v.trend} />
          </section>
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Top 5 NG {date === today ? "Hari Ini" : ""}</h2>
              <a href={`/reports/ng-type?from=${date}&to=${date}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Lihat detail ›
              </a>
            </div>
            {v.topNg.length ? (
              <div className="flex flex-col gap-4">
                {v.topNg.map((n) => (
                  <div key={n.name} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{n.name}</span>
                      <b className="tabular-nums">{n0(n.qty)} pcs</b>
                      <span className="w-12 text-right tabular-nums text-slate-500">{Math.round(n.share * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-600" style={{ width: `${n.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Belum ada NG dari laporan yang disetujui.</Empty>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-bold">Status Laporan {date === today ? "Hari Ini" : ""}</h2>
            <div className="flex flex-wrap items-center gap-6">
              <StatusDonut done={done} waiting={s.waiting} missing={v.missing.length} label={`${s.reported}/${v.expected}`} />
              <div className="flex min-w-40 flex-1 flex-col gap-3 text-sm">
                {[
                  ["bg-emerald-600", "Sudah kirim", done],
                  ["bg-orange-500", "Menunggu validasi", s.waiting],
                  ["bg-rose-600", "Belum kirim", v.missing.length],
                ].map(([c, l, n]) => (
                  <div key={l as string} className="flex items-center gap-3">
                    <span className={`h-3.5 w-3.5 rounded ${c}`} />
                    <span className="flex-1">{l}</span>
                    <b className="tabular-nums">{n}</b>
                  </div>
                ))}
              </div>
            </div>
            {v.missing.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Belum kirim</div>
                <div className="flex flex-wrap gap-2">
                  {v.missing.map((m) => (
                    <span key={m} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-900">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {v.rejected.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ditolak, belum dikirim ulang</div>
                {v.rejected.map((r) => (
                  <div key={r.member} className="py-1 text-sm">
                    <b>{r.member}</b> <span className="text-slate-500">· {r.note}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <QueueList cards={v.queue} canDecide={session.role === "leader" || session.role === "admin"} />
        </div>
        <p className="text-xs text-slate-500">Hasil, NG, achievement, dan tren dihitung dari laporan yang sudah disetujui.</p>
      </main>
    </AppShell>
  );
}
