import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { loadMaster } from "@/lib/service";

export async function GET() {
  return handle(async () => {
    await requireApiRole(["operator", "leader", "manager", "admin"]);
    return Response.json(await loadMaster());
  });
}
