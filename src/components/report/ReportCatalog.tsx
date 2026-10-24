"use client";
import Link from "next/link";
import { useState } from "react";

// Pusat Laporan: satu daftar semua laporan, dengan pencarian dan kelompok. Periode harian/mingguan/bulanan
// dipilih di dalam laporan (satu filter periode), bukan menu terpisah.

type Entry = { group: string; title: string; desc: string; href: string; keywords?: string };

export const CATALOG: Entry[] = [
  { group: "Produksi", title: "Produksi per Member", desc: "Hasil, jam kerja, achievement dan NG tiap member, per hari dan per part.", href: "/reports/member", keywords: "produktivitas operator grade" },
  { group: "Produksi", title: "Produksi per Kategori & Part", desc: "Total per part di setiap kategori (Seiretsu, Sembetsu, PF, ...) dan ALL, plus total per hari.", href: "/reports/category", keywords: "part type total all seiretsu sembetsu pf" },
  { group: "Produksi", title: "Laporan Harian", desc: "Satu tanggal: status lapor dan hasil semua member, lost time dan total menit.", href: "/reports/daily", keywords: "hari status lapor" },
  { group: "Produksi", title: "Rekap Bulanan", desc: "Rekap sebulan per member dan kategori, dibanding bulan lalu dan tren 6 bulan.", href: "/reports/monthly", keywords: "bulan summary periodik" },
  { group: "Kualitas", title: "NG per Jenis", desc: "Pareto NG, NG PPM per part, tren harian, dan pencarian lot / oiban.", href: "/reports/ng-type", keywords: "quality defect ppm pareto lot oiban" },
  { group: "Kualitas", title: "NG per Lot", desc: "NG dan PPM setiap lot, urut dari yang tertinggi, dengan NG terbanyak.", href: "/reports/ng-lot", keywords: "quality lot traceability" },
  { group: "Waktu", title: "Lost Time & Another Job", desc: "Jam efektif, Pareto penyebab, per member, per minggu, dan potensi pcs hilang.", href: "/reports/waktu", keywords: "lost time another job downtime ot lembur" },
  { group: "Mesin", title: "Laporan Mesin", desc: "Semua mesin: jalan / tidak, utilisasi, efisiensi vs Std MC, NG PPM, OEE kira-kira.", href: "/reports/machine", keywords: "machine utilisasi oee mc" },
  { group: "Disiplin", title: "Disiplin Lapor", desc: "Ketepatan kirim laporan per member, alasan penolakan, dan status per hari.", href: "/reports/disiplin", keywords: "kepatuhan submit ditolak telat" },
];
const GROUPS = ["Semua", ...new Set(CATALOG.map((e) => e.group))];

export default function ReportCatalog({ query }: { query: string }) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("Semua");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = CATALOG.filter(
    (e) => (g === "Semua" || e.group === g) && words.every((w) => `${e.title} ${e.desc} ${e.group} ${e.keywords ?? ""}`.toLowerCase().includes(w)),
  );
  return (
    <section className="flex flex-col gap-3" aria-label="Daftar laporan">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-sm">
          <span className="sr-only">Cari laporan</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
          </svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari laporan, mis. lost time, part, lot" className="input h-10 pl-9" />
        </label>
        <div className="relative min-w-0">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 pr-6 [scrollbar-width:none]">
            {GROUPS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setG(x)}
                aria-pressed={g === x}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors ${g === x ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600"}`}
              >
                {x}
              </button>
            ))}
          </div>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#f4f6f8] sm:hidden" />
        </div>
      </div>
      {list.length === 0 ? (
        <p className="card px-5 py-8 text-center text-sm text-slate-500">Tidak ada laporan yang cocok dengan &quot;{q}&quot;.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.href}>
              <Link href={`${e.href}${query ? `?${query}` : ""}`} className="card flex h-full flex-col gap-1 px-4 py-3.5 transition-colors hover:border-brand-600">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{e.group}</span>
                <span className="font-semibold text-slate-900">{e.title}</span>
                <span className="text-sm text-slate-500">{e.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
