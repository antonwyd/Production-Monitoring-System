import { handle } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { ForecastParseError, parseForecastBook } from "@/lib/forecast";
import { readBook } from "@/lib/forecastXlsx";

/** POST multipart (file): baca forecast harian dari Excel dan kembalikan pratinjau (belum disimpan). */
export async function POST(req: Request) {
  return handle(async () => {
    await requireApiRole(["leader", "admin"]);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "Pilih file Excel (.xlsx).");
    if (!/\.xlsx$/i.test(file.name)) throw new HttpError(422, "File harus .xlsx (Excel). File .xls lama: buka di Excel lalu Save As .xlsx.");
    if (file.size > 4_000_000) throw new HttpError(422, "File terlalu besar (maks 4 MB).");
    try {
      const sheets = await readBook(await file.arrayBuffer());
      return Response.json(parseForecastBook(sheets));
    } catch (e) {
      if (e instanceof ForecastParseError) throw new HttpError(422, e.message);
      console.error(e);
      throw new HttpError(422, "File tidak bisa dibaca. Pastikan file Excel tidak rusak dan memakai format template.");
    }
  });
}
