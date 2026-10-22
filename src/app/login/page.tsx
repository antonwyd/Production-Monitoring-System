import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Masuk · Produksi QA" };

/** Gambar bearing sederhana (SVG), pengganti foto produk. */
function Bearing({ className }: { className?: string }) {
  const balls = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return <circle key={i} cx={100 + Math.cos(a) * 62} cy={100 + Math.sin(a) * 62} r={13} fill="url(#ball)" stroke="#0f172a" strokeOpacity={0.25} />;
  });
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id="ball" cx="35%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </radialGradient>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#ring)" />
      <circle cx="100" cy="100" r="78" fill="#3f0a0c" />
      {balls}
      <circle cx="100" cy="100" r="46" fill="url(#ring)" />
      <circle cx="100" cy="100" r="30" fill="#3f0a0c" />
    </svg>
  );
}

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(HOME_BY_ROLE[s.role]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-0 sm:p-6">
      <div className="flex min-h-screen w-full max-w-4xl flex-col overflow-hidden bg-white shadow-xl sm:min-h-0 sm:flex-row sm:rounded-2xl">
        <section className="relative flex flex-col justify-between gap-6 overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 px-8 py-8 text-white sm:w-[46%] sm:py-12">
          <div>
            <span className="inline-block rounded-lg bg-white px-3 py-2">
              <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-9 w-auto" />
            </span>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">PT Takai Seiki Indonesia</div>
          </div>
          <div className="relative z-10 sm:mb-28">
            <h1 className="text-2xl font-bold sm:text-3xl">Production Monitoring System</h1>
            <p className="mt-2 max-w-xs text-sm text-white/80">Monitoring produksi, kualitas, dan produktivitas secara real-time.</p>
          </div>
          <Bearing className="pointer-events-none absolute -bottom-24 -right-24 hidden h-64 w-64 opacity-70 drop-shadow-2xl sm:block" />
          <Bearing className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 opacity-25 sm:hidden" />
        </section>
        <section className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
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
