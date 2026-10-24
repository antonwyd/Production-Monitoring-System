import Link from "next/link";
import AppShell from "@/components/AppShell";
import FilterBar from "@/components/report/FilterBar";
import { BarRow, Empty, Grade, Tile } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { formatDateId, isValidDate, todayJakarta } from "@/lib/dates";
import { loadMaster } from "@/lib/service";
import { buildLaporan } from "@/lib/views";
import { withDataAge } from "@/lib/reports";
import DataStatus from "@/components/DataStatus";
import ReportCatalog from "@/components/report/ReportCatalog";

export const metadata = { title: "Pusat Laporan · QA Production" };

const n0 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
const d1 = (v: number | null) => (v == null ? "-" : v.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
const pc = (v: number | null, digits = 0) => (v == null ? "-" : `${(v * 100).toFixed(digits).replace(".", ",")}%`);
const TH = "px-3 py-2.5 text-xs font-medium text-slate-500";
const TD = "border-t border-slate-100 px-3 py-2.5";

export default async function LaporanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const today = todayJakarta();
  const categoryId = Number(q.category) || undefined;
  const [{ value: v, asOf }, master] = await Promise.all([
    withDataAge(() => buildLaporan({ from: isValidDate(q.from) ? q.from : undefined, to: isValidDate(q.to) ? q.to : undefined, categoryId }, today)),
    loadMaster(),
  ]);
  const query = new URLSearchParams({ from: v.from, to: v.to, ...(categoryId ? { category: String(categoryId) } : {}) }).toString();
  const m = v.month;
  const pctDone = m.total ? Math.round((m.complete / m.total) * 100) : 0;

  return (
    <AppShell session={session} active="laporan">
      <main className="flex w-full flex-col gap-5 px-4 pb-12 pt-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Pusat Laporan</h1>
          <p className="text-sm text-slate-500">Semua laporan produksi, kualitas dan operasional. Periode harian, mingguan atau bulanan dipilih di dalam laporan.</p>
        </div>

        <ReportCatalog query={query} />

        <div id="ringkasan" className="mt-2 border-t border-slate-200 pt-5">
          <h2 className="text-xl font-bold">Ringkasan periode</h2>
          <p className="text-sm text-slate-500">{v.period} · hanya laporan yang sudah disetujui</p>
          <DataStatus asOf={asOf} className="mt-1" />
        </div>

        <section className="card no-print flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
            <div className="font-semibold">
              {m.label} · kirim paling lambat {m.deadline}
            </div>
            <div className="h-2.5 rounded bg-slate-100">
              <div className="h-2.5 rounded bg-brand-600" style={{ width: `${pctDone}%` }} />
            </div>
            <div className="text-sm text-slate-600">
              {m.total === 0
                ? "Belum ada laporan bulan ini."
                : m.problems.length === 0
                  ? `Semua ${m.total} hari kerja sudah lengkap.`
                  : `${m.complete} dari ${m.total} hari kerja sudah lengkap. Belum lengkap: `}
              {m.problems.map((p, i) => (
                <span key={p.date}>
                  {i > 0 && ", "}
                  <b className="text-orange-800">{formatDateId(p.date).slice(0, -5)}</b> ({p.reason})
                </span>
              ))}
            </div>
          </div>
          {m.problems.length > 0 && (
            <Link href={`/hari-ini?date=${m.problems[0].date}`} className="btn-secondary min-h-11">
              Lihat yang belum lengkap
            </Link>
          )}
        </section>

        <FilterBar
          mode="range"
          from={v.from}
          to={v.to}
          date={today}
          month={today.slice(0, 7)}
          today={today}
          selects={[
            {
              name: "category",
              label: "Kategori",
              value: String(categoryId ?? ""),
              options: [{ value: "", label: "Semua kategori" }, ...master.categories.map((c) => ({ value: String(c.id), label: c.name }))],
            },
          ]}
          downloads={[
            { label: "Ringkasan (Excel)", hint: "Kop + angka vs target + semua tabel, siap cetak A4", href: `/api/export/laporan.xlsx?${query}` },
            { label: "Ringkasan (PDF)", hint: "Untuk dikirim atau dicetak, dengan kotak tanda tangan", href: `/api/export/laporan.pdf?${query}` },
            { label: "Rekap Bulanan (Excel)", hint: `Per member dan per kategori, bulan ${v.month.label.replace(/^Laporan bulan /, "")}`, href: `/api/export/monthly.xlsx?month=${v.to.slice(0, 7)}${categoryId ? `&category=${categoryId}` : ""}` },
            { label: "Rekap Bulanan (PDF)", hint: "Laporan bulanan untuk tanggal 10", href: `/api/export/monthly.pdf?month=${v.to.slice(0, 7)}${categoryId ? `&category=${categoryId}` : ""}` },
          ]}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {v.tiles.map((t) => (
            <Tile key={t.label} t={t} />
          ))}
        </section>

        {!categoryId && v.categories.length > 1 && (
          <section className="card overflow-x-auto px-2 py-3">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className={TH}>Per kategori</th>
                  <th className={`${TH} text-right`}>Hasil (pcs)</th>
                  <th className={`${TH} text-right`}>NG (PPM)</th>
                  <th className={`${TH} text-right`}>Achievement</th>
                  <th className={`${TH} text-center`}>Grade</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {v.categories.map((c) => (
                  <tr key={c.name}>
                    <td className={`${TD} font-semibold`}>{c.name}</td>
                    <td className={`${TD} text-right`}>{n0(c.qty)}</td>
                    <td className={`${TD} text-right ${(c.ngPpm ?? 0) > master.settings.ngPpmMax ? "font-semibold text-brand-600" : ""}`}>{c.ngPpm == null ? "-" : n0(c.ngPpm)}</td>
                    <td className={`${TD} text-right font-semibold ${c.ach != null && c.ach * 100 < master.settings.target ? "text-brand-600" : ""}`}>{pc(c.ach)}</td>
                    <td className={`${TD} text-center`}>
                      <Grade g={c.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="card">
          <div className="px-5 pt-4">
            <h2 className="text-xl font-bold">1. Orang</h2>
            <p className="text-sm text-slate-500">Urut dari achievement terendah supaya yang perlu dibina kelihatan dulu. Klik nama untuk detail per hari.</p>
          </div>
          <div className="overflow-x-auto px-2 pb-3 pt-2">
            {v.people.length ? (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className={TH}>Member</th>
                    <th className={`${TH} text-right`}>Hari kerja</th>
                    <th className={`${TH} text-right`}>Hasil (pcs)</th>
                    <th className={`${TH} text-right`}>NG rate</th>
                    <th className={`${TH} text-right`}>Waktu hilang</th>
                    <th className={`${TH} text-right`}>Achievement</th>
                    <th className={`${TH} text-center`}>Grade</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {v.people.map((p) => (
                    <tr key={p.name}>
                      <td className={`${TD} font-semibold`}>
                        <Link href={`/reports/member?member=${p.id}&from=${v.from}&to=${v.to}`} className="hover:text-brand-600 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className={`${TD} text-right`}>{p.days}</td>
                      <td className={`${TD} text-right`}>{n0(p.qty)}</td>
                      <td className={`${TD} text-right`}>{pc(p.ngRate, 2)}</td>
                      <td className={`${TD} text-right`}>{p.lostMin ? `${d1(p.lostMin / 60)} jam` : "-"}</td>
                      <td className={`${TD} text-right font-semibold ${p.ach != null && p.ach * 100 < master.settings.target ? "text-brand-600" : ""}`}>{pc(p.ach)}</td>
                      <td className={`${TD} text-center`}>
                        <Grade g={p.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Belum ada laporan yang disetujui di periode ini.</Empty>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <section className="card min-w-0 flex-[1_1_460px] p-5">
            <h2 className="text-xl font-bold">2. Part &amp; NG</h2>
            <p className="mb-4 text-sm text-slate-500">Jenis NG terbanyak, total {n0(v.totalNg)} pcs</p>
            {v.ngTypes.length ? (
              <div className="flex flex-col gap-3">
                {v.ngTypes.map((n) => (
                  <BarRow key={n.name} name={n.name} right={`${n0(n.qty)} pcs · ${pc(n.share)}`} pct={n.bar} />
                ))}
              </div>
            ) : (
              <Empty>Belum ada NG.</Empty>
            )}
            <h3 className="mb-1 mt-6 font-bold">Lot dengan NG rate tertinggi</h3>
            {v.lots.length ? (
              v.lots.map((l) => (
                <div key={`${l.part}|${l.lot}`} className="flex justify-between gap-3 border-b border-slate-100 py-2.5 text-sm">
                  <span>
                    {l.part} · Lot {l.lot}
                  </span>
                  <span className="font-semibold text-orange-800">
                    {pc(l.rate, 2)} <span className="font-normal text-slate-500">({n0(l.ng)} pcs)</span>
                  </span>
                </div>
              ))
            ) : (
              <Empty>Belum ada lot dengan NG.</Empty>
            )}
            <h3 className="mb-1 mt-6 font-bold">Catatan NG Lain-lain</h3>
            {v.notes.length ? (
              <>
                {v.notes.slice(0, 5).map((c, i) => (
                  <div key={i} className="border-b border-slate-100 py-2.5 text-sm">
                    <b>{c.what}</b> <span className="text-slate-500">· {c.who}</span>
                  </div>
                ))}
                {v.notes.length > 5 && (
                  <Link href={`/reports/ng-type?from=${v.from}&to=${v.to}${categoryId ? `&category=${categoryId}` : ""}`} className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
                    Lihat semua catatan ({v.notes.length}) ›
                  </Link>
                )}
              </>
            ) : (
              <Empty>Tidak ada catatan.</Empty>
            )}
          </section>

          <section className="card min-w-0 flex-[1_1_460px] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">3. Mesin</h2>
              <Link href={`/reports/machine?from=${v.from}&to=${v.to}${categoryId ? `&category=${categoryId}` : ""}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Semua mesin ›
              </Link>
            </div>
            <p className="mb-2 text-sm text-slate-500">Mesin yang jalan: jam jalan dibanding Standar MC</p>
            {v.machines.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className={TH}>MC</th>
                      <th className={`${TH} text-right`}>Jam mesin jalan</th>
                      <th className={`${TH} text-right`}>Hasil per jam</th>
                      <th className={`${TH} text-right`}>Efisiensi</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {v.machines.map((r) => (
                      <tr key={`${r.category}|${r.mc}`}>
                        <td className={TD}>
                          <b>{r.mc}</b> <span className="text-slate-500">{r.category}</span>
                        </td>
                        <td className={`${TD} text-right`}>{d1(r.hours)}</td>
                        <td className={`${TD} text-right`}>{r.pcsHr == null ? "-" : n0(r.pcsHr)}</td>
                        <td className={`${TD} text-right font-semibold`}>{r.eff == null ? <span className="font-normal text-slate-400">Std MC belum diisi</span> : pc(r.eff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada data mesin.</Empty>
            )}
          </section>
        </div>

      </main>
    </AppShell>
  );
}
