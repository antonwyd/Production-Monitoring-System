import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { buildReport, parseReportParams, REPORT_KINDS, type ReportKind } from "@/lib/reports";

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { kind } = await ctx.params;
    if (!REPORT_KINDS.includes(kind as ReportKind)) throw new HttpError(404, "Report tidak dikenal.");
    const db = await getDb();
    const report = await buildReport(db, kind as ReportKind, parseReportParams(new URL(req.url).searchParams), todayJakarta());
    return Response.json(report);
  });
}
