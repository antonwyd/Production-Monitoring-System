import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { MASTER_DEFS } from "@/lib/adminConfig";
import MasterTable from "./MasterTable";

export default async function MasterPage({ params }: { params: Promise<{ master: string }> }) {
  const session = await requirePageRole(["admin"]);
  const { master } = await params;
  const def = MASTER_DEFS.find((d) => d.key === master);
  if (!def) notFound();
  return (
    <AppShell session={session} active="admin">
      <MasterTable def={def} />
    </AppShell>
  );
}
