import Link from "next/link";
import AppShell from "@/components/AppShell";
import { CountUp } from "@/components/Motion";
import DateNav from "@/components/DateNav";
import DownloadMenu from "@/components/report/DownloadMenu";
import { Empty } from "@/components/ui";
import TrendStack from "@/components/dashboard/TrendStack";
import ValidationTable from "@/components/dashboard/ValidationTable";
import { ProcSelect, Segmented } from "@/components/dashboard/DashFilters";
import { requirePageRole } from "@/lib/auth";
import { addDays, isValidDate, todayJakarta } from "@/lib/dates";
import { buildToday, NG_RANK_MIN_QTY } from "@/lib/views";
import { withDataAge } from "@/lib/reports";
import DataStatus from "@/components/DataStatus";

export const metadata = { title: "Dashboard · QA Production" };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const pct = (v: number | null, d = 1) => (v == null ? "-" : `${(v * 100).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);

// Ikon garis 24x24.
const ICON = {
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9.5 9.5l5 5M14.5 9.5l-5 5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  doc: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  press: "M4 21h16M6 21V10h12v11M9 10V5h6v5M12 3v2M9 14h6",
  sort: "M4 6h16M7 12h10M10 18h4",
  link: "M9 7H6a3 3 0 0 0 0 6h3M15 7h3a3 3 0 0 1 0 6h-3M8 10h8M7 17l2-2M17 17l-2-2",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
};

function Ico({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Kartu KPI: judul + ikon, angka utama, keterangan, dan definisi di tooltip (title). */
function Kpi({ icon, title, help, tone = "brand", children }: { icon: string; title: string; help: string; tone?: "brand" | "amber" | "blue"; children: React.ReactNode }) {
  const bubble = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-brand-50 text-brand-600";
  return (
    <div className="card lift flex flex-col gap-2 p-4" title={help}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${bubble}`}>
          <Ico d={icon} />
        </span>
        <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-600">{title}</span>
        <span className="ml-auto cursor-help text-xs text-slate-400" aria-label={help}>
          ⓘ
        </span>
      </div>
      {children}
    </div>
  );
}

/** Perubahan vs periode pembanding; tidak tampil kalau pembanding tidak ada. */
function Delta({ now, prev, kind, good, vs }: { now: number | null; prev: number | null; kind: "pct" | "pt" | "min"; good: "up" | "down"; vs: string }) {
  if (now == null || prev == null || !vs) return <span className="text-xs text-slate-400">belum ada pembanding</span>;
  let d: number, text: string;
  if (kind === "pct") {
    if (!prev) return <span className="text-xs text-slate-400">belum ada pembanding</span>;
    d = (now - prev) / prev;
    text = `${Math.abs(d * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  } else if (kind === "pt") {
    d = now - prev;
    text = `${Math.abs(d * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })} poin`;
  } else {
    d = now - prev;
    text = `${n0(Math.abs(d))} menit`;
  }
  if (Math.abs(d) < 1e-9) return <span className="text-xs text-slate-500">sama {vs}</span>;
  const ok = (d > 0) === (good === "up");
  return (
    <span className={`text-xs font-semibold ${ok ? "text-emerald-700" : "text-rose-700"}`}>
      {d > 0 ? "▲" : "▼"} {text} <span className="font-normal text-slate-500">{vs}</span>
    </span>
  );
}

function Bar({ value, tone }: { value: number; tone: "good" | "warn" | "bad" | "brand" }) {
  const c = tone === "good" ? "bg-emerald-600" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-rose-600" : "bg-brand-600";
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className={`anim-bar h-2 rounded-full ${c}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function Section({ title, right, children, className = "" }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col gap-3 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const more = "text-sm font-semibold text-brand-600 hover:underline";

export default async function HariIniPage({ searchParams }: { searchParams: Promise<{ date?: string; proc?: string; days?: string; ngBy?: string }> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const today = todayJakarta();
  // Laporan hari ini baru diinput sore, jadi Dashboard dibuka di tanggal kemarin.
  const date = isValidDate(q.date) ? q.date : addDays(today, -1);
  const { value: v, asOf } = await withDataAge(() => buildToday(date, { proc: q.proc, days: Number(q.days) || 7, ngBy: q.ngBy }));
  const s = v.stats;
  const d = v.dash;
  const canDecide = session.role === "leader" || session.role === "admin";
  const isToday = date === today;
  const hari = isToday ? "Hari Ini" : date === addDays(today, -1) ? "Kemarin" : v.dateLabel.split(",")[0];
  const vs = d.lost.vs;
  const ngLimit = s.ppmMax / 1e6;
  const range = `from=${date}&to=${date}`;
  const catQ = (id: number) => `${range}&category=${id}`;
  const expected = v.expected;
  const done = Math.max(0, s.reported - s.waiting);
  const machinesRun = d.machines.filter((m) => m.status === "jalan").length;

  return (
    <AppShell session={session} active="hari-ini">
      <main className="flex w-full flex-col gap-4 px-4 pb-12 pt-5 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">Production Monitoring System</h1>
            <p className="text-sm text-slate-500">PT Takai Seiki Indonesia{d.proc && <> · Proses <b className="text-slate-700">{d.proc}</b></>}</p>
            <DataStatus asOf={asOf} className="mt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateNav date={date} max={today} label={v.dateLabel} />
            {!isToday && (
              <Link href={`/hari-ini${d.proc ? `?proc=${encodeURIComponent(d.proc)}` : ""}`} className="flex h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                Hari ini
              </Link>
            )}
            <ProcSelect procs={d.procs} value={d.proc} />
            <a
              href="/?page=leader"
              className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:text-brand-600"
              title={`${s.waiting} laporan menunggu validasi`}
              aria-label="Laporan menunggu validasi"
            >
              <Ico d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              {s.waiting > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{s.waiting}</span>}
            </a>
            <DownloadMenu
              links={[
                { label: "Laporan harian (Excel)", hint: "Detail produksi, lost time, antrian, belum kirim", href: `/api/export/hari-ini.xlsx?date=${date}` },
                { label: "Laporan harian (PDF)", hint: "Untuk rapat pagi atau dikirim ke WhatsApp", href: `/api/export/hari-ini.pdf?date=${date}` },
              ]}
            />
          </div>
        </div>

        {/* KPI */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Kpi icon={ICON.box} title="Total Produksi" help="Jumlah pcs OK (normal + lembur) dari laporan yang sudah disetujui. Achievement = jam standar (hasil ÷ STKI, mesin PF pakai Std MC) ÷ jam kerja (baris mesin pakai jam mesin jalan).">
            <div className="text-[28px] font-bold leading-none tabular-nums">
              <CountUp value={s.qty} /> <span className="text-sm font-semibold text-slate-500">pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Bar value={(s.ach ?? 0) * 100} tone={s.ach == null ? "brand" : s.ach * 100 >= s.target ? "good" : "bad"} />
              </div>
              <b className={`text-sm tabular-nums ${s.ach != null && s.ach * 100 >= s.target ? "text-emerald-700" : "text-brand-600"}`}>{pct(s.ach)}</b>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 text-xs text-slate-500">
              <span>Achievement · target {s.target}%</span>
              {s.complete ? <Delta now={s.qty} prev={d.prevQty} kind="pct" good="up" vs={vs} /> : <span>sementara</span>}
            </div>
          </Kpi>
          <Kpi icon={ICON.shield} title="NG Quantity" help="NG (pcs) dari laporan disetujui. NG rate = NG ÷ (OK + NG).">
            <div className="text-[28px] font-bold leading-none tabular-nums">
              {n0(s.ng)} <span className="text-sm font-semibold text-slate-500">pcs</span>
            </div>
            <div className="text-sm">
              NG rate <b className={s.rate != null && s.rate > ngLimit ? "text-rose-700" : "text-emerald-700"}>{pct(s.rate, 2)}</b>
              <span className="text-xs text-slate-500"> · batas {pct(ngLimit, 2)}</span>
            </div>
            {s.complete ? <Delta now={s.rate} prev={d.prevRate} kind="pt" good="down" vs={vs} /> : <span className="text-xs text-slate-500">sementara</span>}
          </Kpi>
          <Kpi icon={ICON.clock} title="Lost Time" tone="blue" help="Total menit Lost Time (grup Lost Time di Master Data). Persen = Lost Time ÷ total menit kerja orang (normal + lembur + lost time + another job). Another Job dihitung terpisah.">
            <div className="text-[28px] font-bold leading-none tabular-nums">
              {n0(d.lost.lt)} <span className="text-sm font-semibold text-slate-500">menit</span>
            </div>
            <div className="text-sm">
              <b>{pct(d.lost.pct)}</b> <span className="text-xs text-slate-500">dari {n0(d.lost.work)} menit kerja · Another Job {n0(d.lost.aj)} mnt</span>
            </div>
            {s.complete ? <Delta now={d.lost.lt} prev={d.lost.prevLt} kind="min" good="down" vs={vs} /> : <span className="text-xs text-slate-500">sementara</span>}
          </Kpi>
          <Kpi icon={ICON.doc} title="Laporan Masuk" help="Member yang sudah kirim ÷ member yang diharapkan lapor (section QA yang aktif lapor 14 hari terakhir, ditambah member lain yang ikut lapor hari itu).">
            <div className="text-[28px] font-bold leading-none tabular-nums">
              {s.reported} <span className="text-slate-400">/</span> {expected}
            </div>
            <Bar value={expected ? (s.reported / expected) * 100 : 0} tone={expected && s.reported >= expected ? "good" : "warn"} />
            <div className="flex justify-between text-xs">
              <span className={v.missing.length ? "font-semibold text-rose-700" : "text-emerald-700"}>{v.missing.length ? `${v.missing.length} belum kirim` : "Semua sudah kirim"}</span>
              <span className="text-slate-500">{expected ? Math.round((s.reported / expected) * 100) : 0}% lengkap</span>
            </div>
          </Kpi>
          <Kpi icon={ICON.users} title="Menunggu Validasi" tone="amber" help="Kiriman member yang belum disetujui atau ditolak leader.">
            <div className="text-[28px] font-bold leading-none tabular-nums">
              {s.waiting} <span className="text-sm font-semibold text-slate-500">laporan</span>
            </div>
            <div className="text-xs text-slate-500">
              {d.oldest ? (
                <>
                  Tertua dikirim {d.oldest.sent}
                  {d.oldest.hours != null && d.oldest.hours >= 1 && <b className={d.oldest.hours >= 2 ? "text-rose-700" : "text-amber-700"}> · {Math.floor(d.oldest.hours)} jam lalu</b>}
                </>
              ) : (
                "Tidak ada antrian"
              )}
            </div>
            <a href="/?page=leader" className="mt-auto text-sm font-semibold text-brand-600 hover:underline">
              Buka antrian validasi ›
            </a>
          </Kpi>
        </section>

        {/* Tren & per proses */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Section
            title={`Tren ${d.days} hari terakhir`}
            right={
              <Segmented
                name="days"
                value={String(d.days)}
                options={[
                  ["7", "7 hari"],
                  ["14", "14 hari"],
                  ["30", "30 hari"],
                ]}
              />
            }
          >
            <TrendStack data={d.trend} target={s.target} ngLimit={ngLimit} />
          </Section>
          <Section title={`Produksi per Proses (${hari})`} right={<Link href={`/production-report/detail?${range}`} className={more}>Lihat detail ›</Link>}>
            <div className="flex flex-col gap-2.5">
              {d.byProc.map((p) => {
                const ok = p.ach != null && p.ach * 100 >= s.target;
                return (
                  <Link
                    key={p.proc}
                    href={`/hari-ini?${new URLSearchParams({ date, proc: d.proc === p.proc ? "" : p.proc }).toString().replace(/&?proc=$/, "")}`}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 transition hover:border-brand-100 hover:bg-brand-50/40 ${d.proc === p.proc ? "border-brand-600" : "border-slate-200"}`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                      <Ico d={/pf/i.test(p.proc) ? ICON.press : /senbetsu/i.test(p.proc) ? ICON.sort : ICON.link} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-semibold">{p.proc}</span>
                        <span className="text-xs text-slate-500">{p.members} orang</span>
                      </div>
                      <div className="text-sm tabular-nums">
                        <b>{n0(p.qty)}</b> <span className="text-slate-500">pcs</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1">
                          <Bar value={(p.ach ?? 0) * 100} tone={p.ach == null ? "brand" : ok ? "good" : "bad"} />
                        </div>
                        <span className={`w-12 text-right text-xs font-bold tabular-nums ${p.ach == null ? "text-slate-400" : ok ? "text-emerald-700" : "text-brand-600"}`}>{pct(p.ach)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 text-right text-xs">
                      <span className="text-slate-500">NG rate</span>
                      <span className="text-slate-500">Lost time</span>
                      <b className={`text-sm tabular-nums ${p.rate != null && p.rate > ngLimit ? "text-rose-700" : ""}`}>{pct(p.rate, 2)}</b>
                      <b className="text-sm tabular-nums">{n0(p.lt)}′</b>
                    </div>
                  </Link>
                );
              })}
              {!d.byProc.length && <Empty>Belum ada proses di Master Data.</Empty>}
            </div>
            <p className="text-xs text-slate-500">Achievement vs target {s.target}%. Lost time dibagi ke proses sesuai porsi menit kerja member. Klik proses untuk memfilter dashboard.</p>
          </Section>
        </div>

        {/* Mesin */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Section
            title={`Status Mesin (${hari})`}
            right={
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Dilaporkan jalan ({machinesRun})</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> NG di atas batas</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Tidak ada laporan ({d.machines.length - machinesRun})</span>
              </div>
            }
          >
            {d.machines.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
                {d.machines.map((m) => (
                  <Link
                    key={m.key}
                    href={`/reports/machine?${catQ(m.categoryId)}`}
                    title={`${m.category} ${m.mc}${m.line ? ` · Line ${m.line}` : ""}\n${m.status === "jalan" ? `${n0(m.qty)} pcs · NG ${pct(m.rate, 2)}` : "Tidak ada laporan"}`}
                    className={`flex flex-col items-center justify-center rounded-md px-1 py-1.5 text-white transition hover:-translate-y-px hover:shadow ${m.status === "kosong" ? "bg-slate-400" : m.alert ? "bg-rose-600" : "bg-emerald-600"}`}
                  >
                    <span className="text-sm font-bold leading-tight">{m.mc.replace(/^MC\s*/i, "")}</span>
                    <span className="max-w-full truncate text-[10px] leading-tight opacity-90">{m.category.replace(/ (Iron|Plastik|Shield) Cage$| Plastik$/, "").replace(/^Seiretsu|^Senbetsu/, (x) => x.slice(0, 4))}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>Belum ada mesin di Master Data.</Empty>
            )}
            <p className="text-xs text-slate-500">Status berdasarkan laporan produksi yang disetujui, bukan sinyal mesin langsung. Setup/stop belum tercatat di data.</p>
          </Section>
          <Section
            title={`Mesin dengan NG Tertinggi (${hari})`}
            right={
              <Segmented
                name="ngBy"
                value={d.ngBy}
                options={[
                  ["rate", "NG rate"],
                  ["qty", "NG pcs"],
                ]}
              />
            }
          >
            {d.topNg.length ? (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pl-4 pr-2 sm:pl-5">#</th>
                      <th className="px-2 py-2">Mesin</th>
                      <th className="px-2 py-2">Proses</th>
                      <th className="px-2 py-2 text-right">Produksi</th>
                      <th className="px-2 py-2 text-right">NG</th>
                      <th className="py-2 pl-2 pr-4 text-right sm:pr-5">NG rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topNg.map((m, i) => (
                      <tr key={`${m.categoryId}${m.mc}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-2.5 pl-4 pr-2 text-slate-500 sm:pl-5">{i + 1}</td>
                        <td className="px-2 py-2.5 font-semibold">
                          <Link href={`/reports/ng-type?${catQ(m.categoryId)}`} className="hover:text-brand-600">
                            {m.mc}
                          </Link>
                          <div className="text-[11px] font-normal text-slate-400">{m.category}</div>
                        </td>
                        <td className="px-2 py-2.5">{m.proc}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{n0(m.qty)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{n0(m.ng)}</td>
                        <td className="py-2.5 pl-2 pr-4 text-right sm:pr-5">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${m.rate != null && m.rate > ngLimit ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{pct(m.rate, 2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada NG dari mesin {isToday ? "hari ini" : "di tanggal ini"}.</Empty>
            )}
            <p className="text-xs text-slate-500">
              {d.ngBy === "rate" ? `Ranking NG rate hanya untuk mesin dengan produksi ≥ ${n0(NG_RANK_MIN_QTY)} pcs${d.ngSkipped ? ` (${d.ngSkipped} mesin di bawahnya tidak diranking)` : ""}.` : "Diurutkan dari NG pcs terbanyak."}
            </p>
          </Section>
        </div>

        {/* Kontrol operasional */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
          <Section title={`Laporan Belum Masuk (${d.missing.length} orang)`} right={<Link href={`/reports/daily?date=${date}`} className={more}>Lihat semua ›</Link>}>
            {d.missing.length ? (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[380px] text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pl-4 pr-2 sm:pl-5">Operator</th>
                      <th className="px-2 py-2" title="Mesin di laporan terakhirnya (14 hari)">Mesin biasa</th>
                      <th className="px-2 py-2">Proses</th>
                      <th className="py-2 pl-2 pr-4 text-right sm:pr-5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.missing.slice(0, 8).map((m) => (
                      <tr key={m.member} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pl-4 pr-2 font-medium sm:pl-5">{m.member}</td>
                        <td className="px-2 py-2.5">{m.mcs || "-"}</td>
                        <td className="px-2 py-2.5">{m.proc || "-"}</td>
                        <td className="py-2.5 pl-2 pr-4 text-right sm:pr-5">
                          <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${m.status === "terlambat" ? "bg-rose-50 text-rose-700" : m.status === "lewat" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                            {m.status === "terlambat" ? "Terlambat" : m.status === "lewat" ? "Lewat 15:00" : "Belum waktunya"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.missing.length > 8 && <div className="px-5 pt-2 text-xs text-slate-500">+{d.missing.length - 8} lainnya</div>}
              </div>
            ) : (
              <Empty>{expected ? "Semua member sudah kirim laporan." : "Belum ada member yang diharapkan lapor."}</Empty>
            )}
            <p className="text-xs text-slate-500">Hanya member section QA. Data shift belum ada, jadi batas lapor memakai jam 15:00.</p>
          </Section>
          <Section title={`Menunggu Validasi Leader (${s.waiting})`} right={<a href="/?page=leader" className={more}>Lihat semua ›</a>}>
            <ValidationTable cards={v.queue} canDecide={canDecide} />
            {s.waiting > 6 && <p className="text-xs text-slate-500">Menampilkan 6 tertua dari {s.waiting}.</p>}
          </Section>
          <Section title={`Top 5 Lost Time (${hari})`} right={<Link href={`/reports/waktu?${range}`} className={more}>Lihat detail ›</Link>} className="lg:col-span-2 2xl:col-span-1">
            {d.topLost.length ? (
              <div className="flex flex-col gap-3">
                {d.topLost.map((l, i) => (
                  <div key={l.name} className="flex items-center gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{l.name}</span>
                        <b className="shrink-0 tabular-nums">{n0(l.minutes)} mnt</b>
                      </div>
                      <div className="truncate text-xs text-slate-500">{l.members.join(", ")}</div>
                      <div className="mt-1">
                        <Bar value={(l.minutes / d.topLost[0].minutes) * 100} tone={i === 0 ? "bad" : "warn"} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Tidak ada lost time {isToday ? "hari ini" : "di tanggal ini"}.</Empty>
            )}
            <p className="text-xs text-slate-500">Hanya grup Lost Time. Another Job {n0(d.lost.aj)} menit dihitung terpisah. Lost time dicatat per member, belum per mesin.</p>
          </Section>
        </div>

        {v.rejected.length > 0 && (
          <section className="card p-4 text-sm sm:p-5">
            <b>Ditolak, belum dikirim ulang:</b>{" "}
            {v.rejected.map((r, i) => (
              <span key={r.member}>
                {i > 0 && ", "}
                {r.member} <span className="text-slate-500">({r.note})</span>
              </span>
            ))}
          </section>
        )}
        <p className="text-xs text-slate-500">
          Hasil, NG, achievement, lost time, dan tren dihitung dari laporan yang sudah disetujui ({done} dari {s.reported} laporan masuk sudah disetujui).
        </p>
      </main>
    </AppShell>
  );
}
