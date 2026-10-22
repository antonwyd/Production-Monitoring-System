import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(HOME_BY_ROLE[s.role]);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo-tki.png" alt="PT. Takai Seiki Indonesia" className="h-14 w-auto" />
          <h1 className="text-xl font-bold text-brand-600">Laporan Produksi QA</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
