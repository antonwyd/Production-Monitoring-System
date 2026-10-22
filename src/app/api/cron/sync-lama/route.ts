import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { addDays, isValidDate, todayJakarta } from "@/lib/dates";
import { clearReportCache } from "@/lib/reports";
import { readOnlySheet } from "@/lib/sheets/client";
import { sinkronDariSheetLama } from "@/lib/sheets/qa";

export const maxDuration = 60;

/**
 * GET /api/cron/sync-lama — salin laporan yang sudah disetujui dari Sheet lama (Apps Script, env SOURCE_SHEET_ID).
 * Dijalankan Vercel Cron tiap 00:05 WIB (vercel.json) untuk 7 hari terakhir s/d kemarin; boleh juga dibuka
 * admin yang sedang login, dengan ?from=yyyy-MM-dd&to=yyyy-MM-dd.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
    if (!isCron) await requireApiRole(["admin"]);
    const source = process.env.SOURCE_SHEET_ID;
    if (!source) throw new HttpError(500, "SOURCE_SHEET_ID belum diisi di environment.");
    const sp = new URL(req.url).searchParams;
    const kemarin = addDays(todayJakarta(), -1);
    const from = sp.get("from") ?? addDays(kemarin, -6);
    const to = sp.get("to") ?? kemarin;
    if (!isValidDate(from) || !isValidDate(to) || from > to) throw new HttpError(400, "Tanggal from/to tidak valid.");
    const hasil = await sinkronDariSheetLama(readOnlySheet(source), from, to);
    clearReportCache();
    return Response.json(hasil);
  });
}
