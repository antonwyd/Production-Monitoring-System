import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { buildForecastReport, isYm, TOTAL } from "@/lib/forecast";
import { reportXlsx, templateXlsx } from "@/lib/forecastXlsx";
import { readForecast } from "@/lib/sheets/forecast";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** GET /api/forecast/template.xlsx?versi=&c=  |  /api/forecast/forecast-vs-po.xlsx?c=&m= */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { file } = await ctx.params;
    const u = new URL(req.url).searchParams;
    const { rows, daily } = await readForecast();
    if (file === "template.xlsx") {
      const v = u.get("versi");
      const versi = isYm(v) ? v : todayJakarta().slice(0, 7);
      const c = u.get("c") ?? "";
      // Daftar part dari versi terakhir customer ini (urutan sesuai file terakhir).
      const mine = rows.filter((r) => r.customer === c || !c);
      const last = [...new Set(mine.map((r) => r.versi))].sort().pop();
      const seen = new Map<string, number>();
      for (const r of mine) if (r.versi === last && r.part !== TOTAL && !seen.has(r.part)) seen.set(r.part, r.box ?? 0);
      const buf = await templateXlsx(versi, [...seen].map(([part, box]) => ({ part, box })));
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="Template-Forecast-${versi}.xlsx"` } });
    }
    if (file === "forecast-vs-po.xlsx") {
      const r = buildForecastReport(rows, daily, u.get("c") ?? undefined, u.get("m") ?? undefined);
      if (!r.sel) throw new HttpError(404, "Belum ada data forecast.");
      const buf = await reportXlsx(r);
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="Forecast-vs-PO-${r.sel.bulan}.xlsx"` } });
    }
    throw new HttpError(404, "File tidak dikenal.");
  });
}
