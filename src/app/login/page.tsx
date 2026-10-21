import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(HOME_BY_ROLE[s.role]);
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(480px,560px)]">
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div aria-hidden className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-[15px] font-semibold tracking-tight">Produksi QA</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl leading-tight font-semibold tracking-tight">Laporan produksi harian, divalidasi dan direkap otomatis.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-200">
            Operator mengisi dari HP, leader memvalidasi, dan dashboard langsung terbarui untuk seluruh tim QA.
          </p>
        </div>
        <p className="relative mt-12 text-xs text-brand-300">PT. Takai Seiki Indonesia · Departemen QA</p>
      </section>

      <section className="flex flex-col justify-center bg-white px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <img src="/icon.svg" alt="" className="mb-8 h-11 w-11 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Masuk</h1>
          <p className="mt-1.5 mb-8 text-[15px] text-slate-500">Laporan Produksi QA · PT. Takai Seiki Indonesia</p>
          <LoginForm />
          <p className="mt-8 text-center text-xs text-slate-400">Lupa PIN? Hubungi leader atau admin IT.</p>
        </div>
      </section>
    </main>
  );
}
