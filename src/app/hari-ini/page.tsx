import AppShell from "@/components/AppShell";
import QueueList from "@/components/QueueList";
import { BarRow, Empty, Tile } from "@/components/ui";
import { requirePageRole } from "@/lib/auth";
import { isValidDate, todayJakarta } from "@/lib/dates";
import { buildToday } from "@/lib/views";

export const metadata = { title: "Hari Ini · Produksi QA" };

export default async function HariIniPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePageRole(["leader", "manager", "admin"]);
  const q = await searchParams;
  const date = isValidDate(q.date) ? q.date : todayJakarta();
  const v = await buildToday(date);
  return (
    <AppShell session={session} active="hari-ini">
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-12 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Laporan produksi</div>
            <h1 className="text-2xl font-bold sm:text-3xl">{v.dateLabel}</h1>
          </div>
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm text-slate-500">
              Ganti tanggal
              <input type="date" name="date" defaultValue={date} className="input mt-1 h-11" />
            </label>
            <button className="btn-secondary h-11">Lihat</button>
          </form>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {v.tiles.map((t) => (
            <Tile key={t.label} t={t} />
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_560px]">
            <QueueList cards={v.queue} canDecide={session.role === "leader" || session.role === "admin"} />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <section className="card p-5">
              <h2 className="mb-1 text-lg font-bold">
                Belum kirim <span className="text-orange-700">({v.missing.length})</span>
              </h2>
              <p className="mb-3 text-xs text-slate-500">Dari {v.expected} member yang lapor dalam 2 minggu terakhir</p>
              {v.missing.length ? (
                <div className="flex flex-wrap gap-2">
                  {v.missing.map((m) => (
                    <span key={m} className="rounded-full bg-orange-50 px-3 py-1.5 text-sm text-orange-900">
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <Empty>Semua sudah kirim.</Empty>
              )}
              {v.rejected.length > 0 && (
                <>
                  <h3 className="mb-2 mt-4 text-sm font-bold">Ditolak, belum dikirim ulang</h3>
                  {v.rejected.map((r) => (
                    <div key={r.member} className="border-t border-slate-100 py-2 text-sm">
                      <b>{r.member}</b> <span className="text-slate-500">· {r.note}</span>
                    </div>
                  ))}
                </>
              )}
            </section>
            <section className="card p-5">
              <h2 className="mb-4 text-lg font-bold">NG terbanyak</h2>
              {v.topNg.length ? (
                <div className="flex flex-col gap-3">
                  {v.topNg.map((n) => (
                    <BarRow key={n.name} name={n.name} right={`${n.qty.toLocaleString("id-ID")} pcs`} pct={n.bar} />
                  ))}
                </div>
              ) : (
                <Empty>Belum ada NG dari laporan yang disetujui.</Empty>
              )}
            </section>
          </div>
        </div>
        <p className="text-xs text-slate-500">Angka hasil, NG, dan achievement dihitung dari laporan yang sudah disetujui.</p>
      </main>
    </AppShell>
  );
}
