import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { reportToXlsx } from "@/lib/excel";
import { reportToPdf } from "@/lib/pdf";
import { buildReport, parseReportParams, REPORT_KINDS, type ReportKind } from "@/lib/reports";
import { buildLaporan, buildToday, laporanToReport, todayToReport } from "@/lib/views";

/** GET /api/export/{jenis}.xlsx atau {jenis}.pdf ?from=&to=&category= */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { file } = await ctx.params;
    const pdf = file.endsWith(".pdf");
    const kind = file.replace(/\.(xlsx|pdf)$/, "");
    if (kind !== "laporan" && kind !== "hari-ini" && !REPORT_KINDS.includes(kind as ReportKind)) throw new HttpError(404, "Report tidak dikenal.");
    const today = todayJakarta();
    const params = parseReportParams(new URL(req.url).searchParams);
    const report =
      kind === "laporan"
        ? laporanToReport(await buildLaporan({ from: params.from, to: params.to, categoryId: params.categoryId }, today))
        : kind === "hari-ini"
          ? todayToReport(await buildToday(params.date ?? today))
          : await buildReport(kind as ReportKind, params, today);
    const buf = pdf ? reportToPdf(report) : await reportToXlsx(report);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `${pdf ? "inline" : "attachment"}; filename="${kind}-${today}.${pdf ? "pdf" : "xlsx"}"`,
      },
    });
  });
}
