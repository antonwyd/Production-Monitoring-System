import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import { countByStatus, listSubmissions } from "@/lib/service";
import type { SubmissionStatus } from "@/lib/types";

export async function GET(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["leader", "admin"]);
    const url = new URL(req.url);
    const st = url.searchParams.get("status");
    const status: SubmissionStatus = st === "approved" || st === "rejected" ? st : "pending";
    const date = url.searchParams.get("date");
    const area = s.role === "leader" ? s.area : "";
    const db = await getDb();
    const [items, counts] = await Promise.all([
      listSubmissions(db, { status, workDate: isValidDate(date) ? date : undefined, area, limit: status === "pending" ? 500 : 100 }),
      countByStatus(db, area),
    ]);
    return Response.json({ items, counts });
  });
}
