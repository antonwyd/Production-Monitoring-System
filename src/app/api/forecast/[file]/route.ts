import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { ALL, buildForecastReport, isYm, latestForecast } from "@/lib/forecast";
import { reportXlsx, templateXlsx } from "@/lib/forecastXlsx";
import { masterCustomers, readForecast } from "@/lib/sheets/forecast";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** GET /api/forecast/template.xlsx?versi=&c=  |  /api/forecast/forecast-vs-po.xlsx?c=&m=&p= */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    const { file } = await ctx.params;
    const u = new URL(req.url).searchParams;
    const { fc, po } = await readForecast();
    const today = todayJakarta();
    if (file === "template.xlsx") {
      const v = u.get("versi");
      const versi = isYm(v) ? v : today.slice(0, 7);
      const c = u.get("c") ?? "";
      // Daftar part: forecast terakhir customer ini (urutan sesuai file), atau Master Customer.
      const mine = latestForecast(fc).filter((r) => (c && c !== ALL ? r.customer === c : true));
      const lastM = [...new Set(mine.map((r) => r.tanggal.slice(0, 7)))].sort().pop();
      const seen = new Map<string, number>();
      for (const r of mine) if (r.tanggal.startsWith(lastM ?? "") && !seen.has(r.part)) seen.set(r.part, r.box ?? 0);
      if (!seen.size && c && c !== ALL) for (const m of (await masterCustomers()).parts[c] ?? []) seen.set(m.part, m.box);
      const buf = await templateXlsx(versi, [...seen].map(([part, box]) => ({ part, box })), c && c !== ALL ? c : "");
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="Template-Forecast-Harian-${versi}.xlsx"` } });
    }
    if (file === "forecast-vs-po.xlsx") {
      const r = buildForecastReport(fc, po, { customer: u.get("c") ?? undefined, month: u.get("m") ?? undefined, part: u.get("p") ?? undefined, today });
      if (!r.month) throw new HttpError(404, "Belum ada data forecast.");
      const buf = await reportXlsx(r);
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="Forecast-vs-PO-${r.month}.xlsx"` } });
    }
    throw new HttpError(404, "File tidak dikenal.");
  });
}
