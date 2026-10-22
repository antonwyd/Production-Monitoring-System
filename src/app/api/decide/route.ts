import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { BackendError } from "@/lib/backend";
import { clearReportCache } from "@/lib/reports";
import { SheetsError } from "@/lib/sheets/client";
import { putuskanTanpaPin, QaError } from "@/lib/sheets/qa";

/** POST /api/decide { ids, action: "ok" | "no", note } — setujui/tolak dari halaman Hari Ini. */
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["leader", "admin"]);
    const b = await readJson(req);
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const action = b.action === "ok" ? "ok" : b.action === "no" ? "no" : null;
    if (!ids.length || !action) throw new HttpError(400, "Pilih laporan dan aksinya.");
    try {
      const r = await putuskanTanpaPin(s.name, ids, action, String(b.note ?? ""));
      clearReportCache();
      return Response.json(r);
    } catch (e) {
      if (e instanceof QaError || e instanceof SheetsError) throw new BackendError(e.message);
      throw e;
    }
  });
}
