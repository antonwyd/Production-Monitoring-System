import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Masuk · Produksi QA" };

/** Foto produk bearing TKI (sudah diperkecil ke WebP: 480px ≈24 KB, 900px ≈49 KB). */
function BearingPhoto({ className }: { className?: string }) {
  return (
    <img
      src="/login-bearing-900.webp"
      srcSet="/login-bearing-480.webp 480w, /login-bearing-900.webp 900w"
      sizes="(min-width: 640px) 420px, 100vw"
      width={900}
      height={600}
      alt="Produk bearing PT Takai Seiki Indonesia"
      fetchPriority="high"
      decoding="async"
      className={className}
    />
  );
}

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(HOME_BY_ROLE[s.role]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-0 sm:p-6">
      <div className="anim-in flex min-h-screen w-full max-w-4xl flex-col overflow-hidden bg-white shadow-xl sm:min-h-0 sm:flex-row sm:rounded-2xl">
        <section className="relative flex flex-col overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white to-[#f4f5f7] sm:w-[48%] sm:border-b-0 sm:border-r">
          <div aria-hidden className="absolute inset-y-0 left-0 z-20 w-1.5 bg-brand-600" />
          <div className="relative z-10 px-8 pt-8 sm:pt-10">
            <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-10 w-auto" />
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">PT Takai Seiki Indonesia</div>
            <div className="anim-in mt-6 sm:mt-10" style={{ animationDelay: ".15s" }}>
              <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-[2rem]">
                Production <span className="text-brand-600">Monitoring</span> System
              </h1>
              <div className="mt-3 h-1 w-14 rounded-full bg-brand-600" />
              <p className="mt-3 max-w-xs text-sm text-slate-600">Monitoring produksi, kualitas, dan produktivitas secara real-time.</p>
            </div>
          </div>
          <div className="relative mt-4 h-40 sm:mt-auto sm:h-auto">
            <BearingPhoto className="h-full w-full object-cover object-[50%_60%] sm:h-auto" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#f4f5f7] via-[#f4f5f7]/75 to-transparent sm:h-40" />
          </div>
        </section>
        <section className="anim-in flex flex-1 flex-col justify-center px-6 py-10 sm:px-12" style={{ animationDelay: ".1s" }}>
          <h2 className="text-2xl font-bold">Selamat Datang 👋</h2>
          <p className="mb-7 mt-1 text-sm text-slate-500">Masuk ke sistem untuk melanjutkan</p>
          <LoginForm />
          <p className="mt-10 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} PT Takai Seiki Indonesia
            <br />
            Production Monitoring System
          </p>
        </section>
      </div>
    </main>
  );
}
