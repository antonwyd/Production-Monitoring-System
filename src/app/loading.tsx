/** Kerangka halaman (skeleton) selama data dibaca dari Google Sheet. Ukurannya sama dengan halaman asli, jadi tidak bergeser. */
export default function Loading() {
  return (
    <div className="min-h-screen lg:pl-[var(--sb-w)]" aria-busy="true" aria-label="Memuat data">
      <div className="fixed inset-y-0 left-0 hidden w-[var(--sb-w)] bg-[#1d2430] lg:block" />
      <div className="h-[52px] bg-[#1d2430] lg:hidden" />
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-12 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="skel h-8 w-72" />
            <div className="skel h-4 w-96 max-w-[80vw]" />
          </div>
          <div className="skel h-11 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card flex gap-4 p-5">
              <div className="skel h-12 w-12 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skel h-4 w-24" />
                <div className="skel h-8 w-32" />
                <div className="skel h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="card p-5">
            <div className="skel mb-4 h-5 w-64" />
            <div className="skel h-64 w-full" />
          </div>
          <div className="card flex flex-col gap-4 p-5">
            <div className="skel h-5 w-40" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skel h-7 w-full" />
            ))}
          </div>
        </div>
        <p className="text-center text-sm text-slate-400">Memuat data produksi…</p>
      </main>
    </div>
  );
}
