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

export const metadata = { title: "Laporan · QA Production" };

const more = "text-sm font-semibold text-brand-600 hover:underline";

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
          <h1 className="text-2xl font-bold sm:text-3xl">Laporan Produksi</h1>
          <p className="text-sm text-slate-500">{v.period} · ringkasan untuk atasan dan cetak, hanya laporan yang sudah disetujui. Detail ada di menu Analisa.</p>
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
            <div className="flex items-baseline justify-between gap-3 px-3 pb-1">
              <h2 className="text-lg font-bold">Per kategori</h2>
              <Link href={`/reports/category?from=${v.from}&to=${v.to}`} className={more}>
                Detail di Produksi ›
              </Link>
            </div>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className={TH}>Kategori</th>
                  <th className={`${TH} text-right`}>Hasil (pcs)</th>
                  <th className={`${TH} text-right`}>NG rate</th>
                  <th className={`${TH} text-right`}>Achievement</th>
                  <th className={`${TH} text-center`}>Grade</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {v.categories.map((c) => (
                  <tr key={c.name}>
                    <td className={`${TD} font-semibold`}>{c.name}</td>
                    <td className={`${TD} text-right`}>{n0(c.qty)}</td>
                    <td className={`${TD} text-right ${(c.ngRate ?? 0) > master.settings.ngPpmMax / 1e6 ? "font-semibold text-brand-600" : ""}`}>{c.ngRate == null ? "-" : `${(c.ngRate * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`}</td>
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
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
            <div>
              <h2 className="text-xl font-bold">1. Orang</h2>
              <p className="text-sm text-slate-500">5 achievement terendah dari {v.people.length} member. Klik nama untuk detail.</p>
            </div>
            <Link href={`/reports/member?from=${v.from}&to=${v.to}${categoryId ? `&category=${categoryId}` : ""}`} className={more}>
              Semua member di Produktivitas ›
            </Link>
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
                  {v.people.slice(0, 5).map((p) => (
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
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">2. NG</h2>
              <Link href={`/reports/ng-type?from=${v.from}&to=${v.to}${categoryId ? `&category=${categoryId}` : ""}`} className={more}>
                Detail di Kualitas ›
              </Link>
            </div>
            <p className="mb-4 text-sm text-slate-500">5 jenis NG terbanyak, total {n0(v.totalNg)} pcs. Lot, part, dan catatan NG ada di Kualitas.</p>
            {v.ngTypes.length ? (
              <div className="flex flex-col gap-3">
                {v.ngTypes.slice(0, 5).map((n) => (
                  <BarRow key={n.name} name={n.name} right={`${n0(n.qty)} pcs · ${pc(n.share)}`} pct={n.bar} />
                ))}
              </div>
            ) : (
              <Empty>Belum ada NG.</Empty>
            )}
          </section>

          <section className="card min-w-0 flex-[1_1_460px] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">3. Mesin</h2>
              <Link href={`/reports/machine?from=${v.from}&to=${v.to}${categoryId ? `&category=${categoryId}` : ""}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Detail di Mesin ›
              </Link>
            </div>
            <p className="mb-2 text-sm text-slate-500">5 mesin dengan jam jalan terbanyak, dibanding Standar MC</p>
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
                    {[...v.machines].sort((a, b) => b.hours - a.hours).slice(0, 5).map((r) => (
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

        <section className="no-print card px-5 py-4">
          <h2 className="mb-1 font-bold">Detail per topik</h2>
          <p className="mb-3 text-sm text-slate-500">Setiap halaman menjawab satu pertanyaan.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["category", "Produksi", "Berapa pcs per kategori, part, dan hari?"],
              ["ng-type", "Kualitas (NG)", "NG apa, di part/lot mana, dan cari lot?"],
              ["member", "Produktivitas", "Siapa yang di bawah target, achievement & grade per orang?"],
              ["machine", "Mesin", "Mesin mana yang jalan, utilisasi & efisiensi MC?"],
              ["waktu", "Waktu & Lost Time", "Ke mana waktu kerja hilang?"],
              ["disiplin", "Disiplin Lapor", "Siapa yang telat atau belum lapor?"],
              ["monthly", "Rekap bulanan", "Total sebulan untuk laporan tanggal 10"],
            ].map(([k, l, d]) => (
              <Link key={k} href={`/reports/${k}?${k === "monthly" ? `month=${v.to.slice(0, 7)}` : `from=${v.from}&to=${v.to}`}${categoryId && k !== "disiplin" ? `&category=${categoryId}` : ""}`} className="rounded-lg border border-slate-200 px-4 py-3 transition hover:border-brand-100 hover:bg-brand-50/40">
                <div className="font-semibold">{l} ›</div>
                <div className="text-sm text-slate-500">{d}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
