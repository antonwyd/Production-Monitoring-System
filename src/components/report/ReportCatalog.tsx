"use client";
import Link from "next/link";
import { useState } from "react";

// Pusat Laporan: kartu per kelompok (seperti mockup Report Center), pencarian, dan laporan yang sering dibuka. Periode harian/mingguan/bulanan
// dipilih di dalam laporan (satu filter periode), bukan menu terpisah.

type Entry = { group: string; title: string; desc: string; href: string; keywords?: string };

export const CATALOG: Entry[] = [
  {
    group: "Produksi",
    title: "Produksi per Member",
    desc: "Hasil, jam kerja, achievement dan NG tiap member, per hari dan per part.",
    href: "/reports/member",
    keywords: "produktivitas operator grade",
  },
  {
    group: "Produksi",
    title: "Produksi per Kategori & Part",
    desc: "Total per part di setiap kategori (Seiretsu, Sembetsu, PF, ...) dan ALL, plus total per hari.",
    href: "/reports/category",
    keywords: "part type total all seiretsu sembetsu pf",
  },
  { group: "Ringkasan", title: "Laporan Harian", desc: "Satu tanggal: status lapor dan hasil semua member, lost time dan total menit.", href: "/reports/daily", keywords: "hari status lapor" },
  { group: "Ringkasan", title: "Rekap Bulanan", desc: "Rekap sebulan per member dan kategori, dibanding bulan lalu dan tren 6 bulan.", href: "/reports/monthly", keywords: "bulan summary periodik" },
  { group: "Kualitas", title: "NG per Jenis", desc: "Pareto NG, NG PPM per part, tren harian, dan pencarian lot / oiban.", href: "/reports/ng-type", keywords: "quality defect ppm pareto lot oiban" },
  { group: "Kualitas", title: "NG per Lot", desc: "NG dan PPM setiap lot, urut dari yang tertinggi, dengan NG terbanyak.", href: "/reports/ng-lot", keywords: "quality lot traceability" },
  {
    group: "Waktu",
    title: "Lost Time & Another Job",
    desc: "Jam efektif, Pareto penyebab, per member, per minggu, dan potensi pcs hilang.",
    href: "/reports/waktu",
    keywords: "lost time another job downtime ot lembur",
  },
  {
    group: "Mesin",
    title: "Laporan Mesin",
    desc: "Semua mesin: jalan / tidak, utilisasi, efisiensi vs Std MC, NG PPM, OEE kira-kira.",
    href: "/reports/machine",
    keywords: "machine utilisasi oee mc",
  },
  {
    group: "Member",
    title: "Disiplin Lapor",
    desc: "Ketepatan kirim laporan per member, alasan penolakan, dan status per hari.",
    href: "/reports/disiplin",
    keywords: "kepatuhan submit ditolak telat",
  },
];
// Urutan dan isi kartu kelompok. Ikon garis 24x24.
const GROUP_INFO: { name: string; title: string; desc: string; icon: string }[] = [
  { name: "Produksi", title: "Produksi", desc: "Hasil, target, achievement, per member dan per part.", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { name: "Waktu", title: "Lost Time & Another Job", desc: "Jam efektif, penyebab lost time, potensi pcs hilang.", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  { name: "Kualitas", title: "Kualitas", desc: "NG, PPM, Pareto jenis NG dan lot.", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zM9 12l2 2 4-4" },
  {
    name: "Member",
    title: "Member & Disiplin Lapor",
    desc: "Ketepatan kirim, penolakan, status per hari.",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  },
  { name: "Mesin", title: "Mesin", desc: "Utilisasi, efisiensi vs Std MC, NG per mesin.", icon: "M3 20h18M5 20V9l5 3V9l5 3V5h4v15" },
  { name: "Ringkasan", title: "Ringkasan Periodik", desc: "Laporan harian dan rekap bulanan.", icon: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5" },
];
const GROUPS = ["Semua", ...GROUP_INFO.map((g) => g.name)];
const LABEL: Record<string, string> = Object.fromEntries(GROUP_INFO.map((g) => [g.name, g.title]));
const OFTEN = ["/reports/member", "/reports/category", "/reports/monthly", "/reports/ng-type", "/reports/waktu", "/reports/daily"];

function Ico({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function ReportCatalog({ query }: { query: string }) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("Semua");
  const href = (e: Entry) => `${e.href}${query ? `?${query}` : ""}`;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = CATALOG.filter((e) => (g === "Semua" || e.group === g) && words.every((w) => `${e.title} ${e.desc} ${e.group} ${LABEL[e.group]} ${e.keywords ?? ""}`.toLowerCase().includes(w)));
  const cards = GROUP_INFO.filter((x) => (g === "Semua" || x.name === g) && list.some((e) => e.group === x.name));
  const iconOf = (group: string) => GROUP_INFO.find((x) => x.name === group)?.icon ?? GROUP_INFO[5].icon;
  return (
    <section className="flex flex-col gap-4" aria-label="Daftar laporan">
      <div className="flex flex-col gap-3">
        <label className="relative w-full">
          <span className="sr-only">Cari laporan</span>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
          </svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari laporan, mis. lost time, part, lot" className="input h-11 pl-9" />
        </label>
        <div className="relative min-w-0">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 pr-6 [scrollbar-width:none]">
            {GROUPS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setG(x)}
                aria-pressed={g === x}
                className={`h-9 shrink-0 rounded-lg border px-3.5 text-sm font-medium transition-colors ${g === x ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600"}`}
              >
                {x === "Semua" ? x : LABEL[x]}
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
          {cards.map((x) => {
            const items = list.filter((e) => e.group === x.name);
            return (
              <li key={x.name} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Ico d={x.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold leading-tight text-slate-900">{x.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{x.desc}</p>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
                  {items.map((e) => (
                    <Link key={e.href} href={href(e)} className="group flex items-center gap-2 py-2.5 text-sm" title={e.desc}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-800 group-hover:text-brand-600">{e.title}</span>
                        {words.length > 0 && <span className="block text-xs text-slate-500">{e.desc}</span>}
                      </span>
                      <span className="shrink-0 text-brand-600" aria-hidden>
                        →
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-auto text-xs text-slate-400">{items.length} laporan</div>
              </li>
            );
          })}
        </ul>
      )}
      {g === "Semua" && words.length === 0 && (
        <div className="card p-4">
          <h3 className="mb-2 font-bold">Laporan yang sering diakses</h3>
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {OFTEN.map((h) => CATALOG.find((e) => e.href === h)!).map((e) => (
              <li key={e.href}>
                <Link href={href(e)} className="flex items-center gap-2.5 py-2 text-sm text-slate-700 hover:text-brand-600">
                  <span className="text-brand-600">
                    <Ico d={iconOf(e.group)} className="h-4 w-4" />
                  </span>
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
