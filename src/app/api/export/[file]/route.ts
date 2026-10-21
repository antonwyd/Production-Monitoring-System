import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { reportToXlsx } from "@/lib/excel";
import { buildReport, parseReportParams, REPORT_KINDS, type ReportKind } from "@/lib/reports";

/** GET /api/export/{jenis}.xlsx?from=&to=&category= */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { file } = await ctx.params;
    const kind = file.replace(/\.xlsx$/, "");
    if (!REPORT_KINDS.includes(kind as ReportKind)) throw new HttpError(404, "Report tidak dikenal.");
    const today = todayJakarta();
    const report = await buildReport(kind as ReportKind, parseReportParams(new URL(req.url).searchParams), today);
    const buf = await reportToXlsx(report);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${kind}-${today}.xlsx"`,
      },
    });
  });
}
