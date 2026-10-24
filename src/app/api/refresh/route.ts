import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { clearReportCache } from "@/lib/reports";

/** POST /api/refresh — buang cache data report di server ini supaya angka dibaca ulang dari Google Sheet. */
export async function POST() {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    clearReportCache();
    return Response.json({ ok: true });
  });
}
