import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { addDays, todayJakarta } from "@/lib/dates";
import { buildMonthly, defaultMonth, isValidMonth } from "@/lib/monthly";
import { monthlyToPdf } from "@/lib/monthlyPdf";
import { monthlyToXlsx } from "@/lib/monthlyExcel";

/** GET /api/production-report/production-report.xlsx|.pdf ?month=YYYY-MM */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { file } = await ctx.params;
    const pdf = file.endsWith(".pdf");
    if (!pdf && !file.endsWith(".xlsx")) throw new HttpError(404, "Format tidak dikenal.");
    const m = new URL(req.url).searchParams.get("month");
    // Sama dengan halaman: data dihitung s/d kemarin.
    const base = addDays(todayJakarta(), -1);
    const month = isValidMonth(m) ? m : defaultMonth(base);
    const report = await buildMonthly(month, base);
    const buf = pdf ? monthlyToPdf(report) : await monthlyToXlsx(report);
    const name = `Production-Report-${month}.${pdf ? "pdf" : "xlsx"}`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `${pdf ? "inline" : "attachment"}; filename="${name}"`,
      },
    });
  });
}
