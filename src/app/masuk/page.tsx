import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import LoginForm from "../login/LoginForm";

export const metadata: Metadata = { title: "Masuk · Form Produksi QA", manifest: "/manifest.webmanifest" };

const STEPS = [
  { t: "Isi laporan", d: "Part, qty, NG & lost time" },
  { t: "Validasi leader", d: "Dicek & disetujui" },
  { t: "Report otomatis", d: "Langsung ke dashboard" },
];

/** Login member dengan NIK + PIN sebelum membuka form laporan (/). */
export default async function MasukPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-screen flex-col bg-[#f4f5f7] lg:flex-row lg:bg-white">
      <section className="relative flex shrink-0 flex-col overflow-hidden bg-gradient-to-b from-white to-[#f4f5f7] lg:min-h-screen lg:w-1/2 lg:border-r lg:border-slate-200">
        <div aria-hidden className="absolute inset-y-0 left-0 z-20 w-1.5 bg-brand-600 lg:w-2" />
        <div className="anim-in relative z-10 px-7 pt-7 lg:px-16 lg:pt-14">
          <div className="flex items-center justify-between gap-3">
            <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-10 w-auto lg:h-14" />
            <span className="rounded-full border border-brand-600/20 bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700 lg:text-xs">Quality Assurance</span>
          </div>
          <h1 className="mt-6 text-[1.7rem] font-extrabold leading-tight text-slate-900 lg:mt-14 lg:text-5xl">
            Laporan Produksi <span className="text-brand-600">QA</span>
          </h1>
          <div className="mt-3 h-1 w-12 rounded-full bg-brand-600 lg:mt-5 lg:h-1.5 lg:w-20" />
          <p className="mt-3 max-w-md text-sm text-slate-600 lg:mt-5 lg:text-lg">Masuk dengan NIK untuk mengisi laporan harian Anda.</p>
          <ol className="mt-8 hidden max-w-md gap-3 lg:grid">
            {STEPS.map((s, i) => (
              <li key={s.t} className="anim-in flex items-center gap-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <span>
                  <b className="block text-slate-900">{s.t}</b>
                  <span className="text-sm text-slate-500">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative -mb-8 mt-3 h-40 sm:h-56 lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-[39rem] lg:mb-0 lg:mt-0 lg:h-auto">
          <img
            src="/login-bearing-900.webp"
            srcSet="/login-bearing-480.webp 480w, /login-bearing-900.webp 900w, /login-bearing-1400.webp 1400w"
            sizes="(min-width: 1024px) 50vw, 100vw"
            width={900}
            height={600}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-[50%_60%]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#f4f5f7] to-transparent lg:h-40" />
        </div>
      </section>

      <section className="relative z-10 flex flex-1 flex-col lg:items-center lg:justify-center lg:px-12">
        <div className="anim-in flex-1 rounded-t-[1.75rem] bg-white px-6 pb-8 pt-7 shadow-[0_-12px_32px_-12px_rgba(16,24,40,.18)] lg:w-full lg:max-w-md lg:flex-none lg:rounded-none lg:p-0 lg:shadow-none" style={{ animationDelay: ".1s" }}>
          <div aria-hidden className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200 lg:hidden" />
          <h2 className="text-xl font-bold text-slate-900 lg:text-3xl">Masuk untuk isi laporan</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500 lg:mb-8 lg:text-base">Nama Anda terisi otomatis setelah masuk.</p>
          <LoginForm next="/" cta="Masuk & isi laporan" />
          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} PT Takai Seiki Indonesia
          </p>
        </div>
      </section>
    </main>
  );
}
