import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(HOME_BY_ROLE[s.role]);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold">Laporan Produksi QA</h1>
            <p className="text-sm text-slate-500">PT. Takai Seiki Indonesia</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
