import AppShell from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { loadMaster } from "@/lib/service";
import OperatorForm from "./OperatorForm";

export const metadata = { title: "Form laporan · Produksi QA" };

export default async function FormPage() {
  const session = await requirePageRole(["operator", "leader", "admin"]);
  // Master data ditanam di halaman agar form langsung tampil tanpa request tambahan.
  const master = await loadMaster();
  return (
    <AppShell session={session} active="form">
      {session.role === "operator" && session.memberId == null ? (
        <p className="m-6 rounded-lg bg-red-50 p-4 text-red-800">Akun Anda belum terhubung ke data member. Hubungi admin.</p>
      ) : (
        <OperatorForm
          master={master}
          today={todayJakarta()}
          userId={session.userId}
          lockedMemberId={session.role === "operator" ? session.memberId : null}
        />
      )}
    </AppShell>
  );
}
