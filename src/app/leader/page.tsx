import AppShell from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import LeaderQueue from "./LeaderQueue";

export const metadata = { title: "Validasi leader · Produksi QA" };

export default async function LeaderPage() {
  const session = await requirePageRole(["leader", "admin"]);
  return (
    <AppShell session={session} active="leader">
      <LeaderQueue />
    </AppShell>
  );
}
