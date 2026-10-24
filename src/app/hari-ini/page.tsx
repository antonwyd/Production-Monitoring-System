import AppShell from "@/components/AppShell";
import { Spark, TrendChart } from "@/components/DashboardCharts";
import { CountUp } from "@/components/Motion";
import DateNav from "@/components/DateNav";
import QueueList from "@/components/QueueList";
import DownloadMenu from "@/components/report/DownloadMenu";
import { Empty } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { addDays, isValidDate, todayJakarta } from "@/lib/dates";
import { buildToday, type Trend } from "@/lib/views";
import { withDataAge } from "@/lib/reports";
import DataStatus from "@/components/DataStatus";

export const metadata = { title: "Dashboard · QA Production" };

const STATUS = [
  { key: "approved", label: "Disetujui", bar: "bg-emerald-600" },
  { key: "waiting", label: "Menunggu", bar: "bg-orange-500" },
  { key: "rejected", label: "Ditolak", bar: "bg-rose-600" },
  { key: "missing", label: "Belum kirim", bar: "bg-slate-400" },
] as const;

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const h1 = (min: number) => (min / 60).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = (v: number | null, d = 2) => (v == null ? "-" : `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: d })}%`);

// Ikon kartu (garis 24x24).
const ICON = {
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  doc: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
};

function KpiCard({ icon, title, delay, spark, children }: { icon: keyof typeof ICON; title: string; delay: number; spark?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card anim-in lift group relative flex gap-4 p-4 sm:p-5" style={{ animationDelay: `${delay}s` }}>
      <span className="hidden h-12 w-12 shrink-0 sm:flex items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON[icon]} />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold leading-tight text-slate-700 sm:whitespace-nowrap">{title}</div>
          {spark}
        </div>
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
  const { value: v, asOf } = await withDataAge(() => buildToday(date));
  const s = v.stats;
  const done = Math.max(0, s.reported - s.waiting);
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }));
  const salam = hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";
  const first = session.name.split(" ")[0];
  const canDecide = session.role === "leader" || session.role === "admin";
  return (
    <AppShell session={session} active="hari-ini">
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="anim-in text-2xl font-bold sm:text-[28px]">
              {salam}, {first} 👋
            </h1>
            <p className="anim-in text-sm text-slate-500" style={{ animationDelay: ".08s" }}>
              Ringkasan hasil produksi dan kualitas {date === today ? "hari ini" : v.dateLabel}
            </p>
            <DataStatus asOf={asOf} className="mt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateNav date={date} max={today} label={v.dateLabel} />
            <a
              href="/?page=leader"
              className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:text-brand-600"
              title={`${s.waiting} laporan menunggu validasi`}
              aria-label="Laporan menunggu validasi"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {s.waiting > 0 && (
                <span className="anim-pop absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{s.waiting}</span>
              )}
            </a>
            <DownloadMenu
              links={[
                { label: "Laporan hari ini (Excel)", hint: "Detail produksi, lost time, antrian, belum kirim", href: `/api/export/hari-ini.xlsx?date=${date}` },
                { label: "Laporan hari ini (PDF)", hint: "Untuk rapat pagi atau dikirim ke WhatsApp", href: `/api/export/hari-ini.pdf?date=${date}` },
              ]}
            />
          </div>
        </div>

        <nav className="no-print -mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Periode">
          {[
            { label: "Hari ini", href: "/hari-ini", on: date === today },
            { label: "Kemarin", href: `/hari-ini?date=${addDays(today, -1)}`, on: date === addDays(today, -1) },
            { label: "7 hari", href: `/laporan?from=${addDays(today, -6)}&to=${today}` },
            { label: "30 hari", href: `/laporan?from=${addDays(today, -29)}&to=${today}` },
            { label: "Bulan ini", href: `/laporan?from=${today.slice(0, 8)}01&to=${today}` },
          ].map((c) => (
            <a
              key={c.label}
              href={c.href}
              aria-current={c.on ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center rounded-lg border px-3.5 text-sm font-medium ${c.on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600"}`}
            >
              {c.label}
            </a>
          ))}
        </nav>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard icon="box" title="Hasil Produksi" delay={0.05} spark={<Spark kind="line" data={v.trend.map((t) => t.qty)} />}>
            <div className="text-2xl font-bold tabular-nums sm:text-3xl">
              <CountUp value={s.qty} /> <span className="text-sm font-semibold text-slate-500 sm:text-base">pcs</span>
            </div>
            <div className="text-xs text-slate-500">{!s.complete ? `sementara, ${done} dari ${v.expected} laporan disetujui` : s.qtyTrend ? <TrendText t={s.qtyTrend} /> : "yang sudah disetujui"}</div>
          </KpiCard>
          <KpiCard icon="target" title="Achievement" delay={0.19}>
            <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${s.ach != null && s.ach * 100 < s.target ? "text-brand-600" : ""}`}>
              {s.ach == null ? "-" : <CountUp value={Math.round(s.ach * 100)} suffix="%" />}{" "}
              {s.ach != null && <span className="text-sm font-semibold text-slate-500 sm:text-base">Grade {s.grade}</span>}
            </div>
            <div className="relative h-2 rounded-full bg-slate-100">
              <div
                className={`anim-bar h-2 rounded-full ${s.ach != null && s.ach * 100 >= s.target ? "bg-emerald-600" : "bg-brand-600"}`}
                style={{ width: `${Math.min(100, Math.round((s.ach ?? 0) * 100))}%`, animationDelay: ".3s" }}
              />
            </div>
            <div className={`text-xs font-semibold ${s.ach == null ? "text-slate-500" : s.ach * 100 >= s.target ? "text-emerald-700" : "text-brand-600"}`}>
              {s.ach == null ? `Target ${s.target}%` : s.ach * 100 >= s.target ? `✓ Sesuai target ${s.target}%` : `${Math.round(s.target - s.ach * 100)}% di bawah target`}
            </div>
          </KpiCard>
          <KpiCard icon="shield" title="NG (PPM)" delay={0.12} spark={<Spark kind="bar" data={v.trend.map((t) => t.ng)} />}>
            <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${s.ppm != null && s.ppm > s.ppmMax ? "text-brand-600" : ""}`}>{s.ppm == null ? "-" : <CountUp value={s.ppm} />}</div>
            <div className="text-xs text-slate-500">
              {n0(s.ng)} pcs · rate {pct(s.rate)} {s.complete && s.rateTrend && <TrendText t={s.rateTrend} />}
            </div>
            <div className={`text-xs font-semibold ${s.ppm == null ? "text-slate-500" : s.ppm > s.ppmMax ? "text-brand-600" : "text-emerald-700"}`}>
              {s.ppm != null && s.ppm <= s.ppmMax ? "✓ " : ""}batas {n0(s.ppmMax)} PPM
            </div>
          </KpiCard>
          <KpiCard icon="clock" title="Lost Time" delay={0}>
            <div className="text-2xl font-bold tabular-nums sm:text-3xl">
              {h1(s.ltMin)} <span className="text-sm font-semibold text-slate-500 sm:text-base">jam</span>
            </div>
            <div className="text-xs text-slate-500">Another Job {h1(s.ajMin)} jam</div>
            <a href={`/reports/waktu?from=${date}&to=${date}`} className="text-xs font-semibold text-brand-600 hover:underline">
              Lihat penyebab ›
            </a>
          </KpiCard>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="card p-4 sm:p-5" aria-label="Status laporan member">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Status Laporan Member</h2>
              <span className="text-sm text-slate-500">{v.expected} member diharapkan lapor</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              {STATUS.map((x) => (
                <span key={x.key} className={x.bar} style={{ width: `${v.expected ? (v.status[x.key] / v.expected) * 100 : 0}%` }} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATUS.map((x) => (
                <div key={x.key} className="flex items-center gap-2.5">
                  <span className={`h-3 w-3 shrink-0 rounded-sm ${x.bar}`} />
                  <span className="text-xl font-bold tabular-nums">{v.status[x.key]}</span>
                  <span className="text-sm text-slate-600">{x.label}</span>
                </div>
              ))}
            </div>
            {(v.missing.length > 0 || v.rejected.length > 0) && (
              <details className="mt-3 border-t border-slate-100 pt-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">Lihat nama</summary>
                {v.rejected.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ditolak, belum dikirim ulang</div>
                    {v.rejected.map((r) => (
                      <div key={r.member} className="py-0.5">
                        <b>{r.member}</b> <span className="text-slate-500">· {r.note}</span>
                      </div>
                    ))}
                  </div>
                )}
                {v.missing.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Belum kirim</div>
                    <div className="mt-1 text-slate-700">{v.missing.join(", ")}</div>
                  </div>
                )}
              </details>
            )}
          </section>
          <section className="card p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-bold">Perlu Perhatian</h2>
            {v.attention.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada yang perlu ditindaklanjuti.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {v.attention.map((a, i) => {
                  const dot = a.level === "bad" ? "bg-brand-600" : a.level === "warn" ? "bg-orange-500" : "bg-slate-400";
                  const body = (
                    <>
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                      <span className="flex-1">{a.text}</span>
                      {a.href && <span className="shrink-0 text-brand-600">›</span>}
                    </>
                  );
                  return (
                    <li key={i}>
                      {a.href ? (
                        <a href={a.href} className="flex items-start gap-3 py-2.5 text-sm hover:text-brand-600">
                          {body}
                        </a>
                      ) : (
                        <div className="flex items-start gap-3 py-2.5 text-sm">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <nav className="no-print flex flex-wrap gap-2" aria-label="Aksi cepat">
          <a href="/" className="btn-secondary min-h-11 text-sm">
            Kirim laporan
          </a>
          {canDecide && (
            <a href="/?page=leader" className="btn-secondary min-h-11 text-sm">
              Validasi laporan{s.waiting ? ` (${s.waiting})` : ""}
            </a>
          )}
          <a href={`/laporan?from=${date}&to=${date}`} className="btn-secondary min-h-11 text-sm">
            Pusat Laporan
          </a>
          <a href={`/reports/waktu?from=${date}&to=${date}`} className="btn-secondary min-h-11 text-sm">
            Lost Time hari ini
          </a>
        </nav>

        {canDecide && s.waiting > 0 && <QueueList cards={v.queue} canDecide />}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section className="card anim-in lift p-5" style={{ animationDelay: ".12s" }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Tren Produksi &amp; NG (7 hari terakhir)</h2>
              <a href={`/laporan?from=${addDays(date, -6)}&to=${date}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Lihat laporan ›
              </a>
            </div>
            <TrendChart data={v.trend} />
          </section>
          <section className="card anim-in lift p-5" style={{ animationDelay: ".16s" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Top 5 NG {date === today ? "Hari Ini" : ""}</h2>
              <a href={`/reports/ng-type?from=${date}&to=${date}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Lihat detail ›
              </a>
            </div>
            {v.topNg.length ? (
              <div className="flex flex-col gap-4">
                {v.topNg.map((n, i) => (
                  <div key={n.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{i + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-baseline gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate">{n.name}</span>
                        <b className="tabular-nums">{n0(n.qty)} pcs</b>
                        <span className="w-12 text-right tabular-nums text-slate-500">{Math.round(n.share * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="anim-bar h-2 rounded-full bg-brand-600" style={{ width: `${n.bar}%`, animationDelay: `${0.25 + i * 0.05}s` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Belum ada NG dari laporan yang disetujui.</Empty>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="card anim-in lift p-5" style={{ animationDelay: ".24s" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Mesin dengan NG Tertinggi</h2>
              <a href={`/reports/machine?from=${date}&to=${date}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Detail ›
              </a>
            </div>
            {v.machines.length ? (
              <div className="flex flex-col gap-3.5">
                {v.machines.map((m, i) => (
                  <div key={`${m.category}${m.mc}`} className="flex items-center gap-3 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 20h18M5 20V9l5 3V9l5 3V5h4v15" />
                      </svg>
                    </span>
                    <div className="w-16 shrink-0">
                      <div className="font-semibold">{m.mc}</div>
                      <div className="truncate text-[11px] text-slate-400">{m.category.replace(/ Iron Cage$/, "")}</div>
                    </div>
                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                      <div className="anim-bar h-2 rounded-full bg-brand-600" style={{ width: `${m.bar}%`, animationDelay: `${0.3 + i * 0.05}s` }} />
                    </div>
                    <b className="w-14 text-right tabular-nums">{n0(m.ng)} pcs</b>
                    <span className="w-12 text-right tabular-nums text-slate-500">{pct(m.rate, 1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Belum ada NG dari mesin hari ini.</Empty>
            )}
          </section>
        </div>
        {!(canDecide && s.waiting > 0) && <QueueList cards={v.queue} canDecide={canDecide} />}
        <p className="text-xs text-slate-500">Hasil, NG, achievement, dan tren dihitung dari laporan yang sudah disetujui.</p>
      </main>
    </AppShell>
  );
}
