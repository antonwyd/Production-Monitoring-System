import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Masuk · QA Production" };

/** Foto produk bearing TKI (WebP: 480px ≈24 KB, 900px ≈49 KB, 1400px ≈79 KB; browser memilih sesuai layar). */
function BearingPhoto({ className }: { className?: string }) {
  return (
    <img
      src="/login-bearing-900.webp"
      srcSet="/login-bearing-480.webp 480w, /login-bearing-900.webp 900w, /login-bearing-1400.webp 1400w"
      sizes="(min-width: 1024px) 56vw, 100vw"
      width={900}
      height={600}
      alt="Produk bearing PT Takai Seiki Indonesia"
      fetchPriority="high"
      decoding="async"
      className={className}
    />
  );
}

const LEADER_PAGE = "/?page=leader";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // ?next=leader: dari halaman Validasi Leader, kembali ke sana setelah masuk.
  const toLeader = (await searchParams).next === "leader";
  const s = await getSession();
  if (s) redirect(toLeader && (s.role === "leader" || s.role === "admin") ? LEADER_PAGE : HOME_BY_ROLE[s.role]);
  return (
    <main className="flex min-h-screen flex-col bg-white lg:flex-row">
      <section className="relative flex shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white to-[#f4f5f7] lg:min-h-screen lg:w-[56%] lg:border-b-0 lg:border-r">
        <div aria-hidden className="absolute inset-y-0 left-0 z-20 w-1.5 bg-brand-600 lg:w-2" />
        <div className="anim-in relative z-10 px-8 pt-8 lg:px-16 lg:pt-14 xl:px-20">
          <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-12 w-auto lg:h-16 xl:h-20" />
          <div className="anim-in mt-6 lg:mt-14" style={{ animationDelay: ".15s" }}>
            <h1 className="text-2xl font-bold leading-tight text-slate-900 lg:text-5xl 2xl:text-6xl">
              Production <span className="text-brand-600">Monitoring</span>
              <br className="hidden lg:block" /> System
            </h1>
            <div className="mt-3 h-1 w-14 rounded-full bg-brand-600 lg:mt-5 lg:w-20 lg:h-1.5" />
            <p className="mt-3 max-w-md text-sm text-slate-600 lg:mt-5 lg:text-lg 2xl:text-xl">Monitoring produksi, kualitas, dan produktivitas secara real-time.</p>
          </div>
        </div>
        <div className="relative mt-4 h-44 sm:h-64 lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-[25rem] 2xl:top-[29rem] lg:mt-0 lg:h-auto">
          <BearingPhoto className="h-full w-full object-cover object-[50%_60%] lg:object-[40%_55%]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#f4f5f7] via-[#f4f5f7]/75 to-transparent lg:h-48" />
        </div>
      </section>
      <section className="anim-in flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-12" style={{ animationDelay: ".1s" }}>
        <div className="w-full max-w-md xl:max-w-lg">
          <h2 className="text-2xl font-bold lg:text-3xl xl:text-4xl">Selamat Datang 👋</h2>
          <p className="mb-7 mt-1 text-sm text-slate-500 lg:mb-9 lg:text-base xl:text-lg">Masuk ke sistem untuk melanjutkan</p>
          <LoginForm next={toLeader ? LEADER_PAGE : undefined} />
          <p className="mt-10 text-center text-xs text-slate-400 lg:mt-16">
            © {new Date().getFullYear()} PT Takai Seiki Indonesia
            <br />
            Production Monitoring System
          </p>
        </div>
      </section>
    </main>
  );
}
