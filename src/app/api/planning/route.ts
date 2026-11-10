import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import type { PlanState } from "@/lib/planning";
import { savePlan } from "@/lib/sheets/planning";

/** POST {state, status}: simpan rencana hari ini (leader/admin) ke tab "Rencana Harian". */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole(["leader", "admin"]);
    const b = await readJson(req);
    const st = b.state as PlanState | undefined;
    const status = b.status === "Dikonfirmasi" ? "Dikonfirmasi" : "Draft";
    if (!st || typeof st !== "object" || !isValidDate(String(st.date)) || !Array.isArray(st.people)) throw new HttpError(400, "Data rencana tidak valid.");
    try {
      return Response.json(await savePlan(st, status, session.name));
    } catch (e) {
      throw new HttpError(500, (e as Error).message);
    }
  });
}
