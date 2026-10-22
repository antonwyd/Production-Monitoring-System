import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { BackendError } from "@/lib/backend";
import { clearReportCache } from "@/lib/reports";
import { invalidateMaster, ValidationError } from "@/lib/service";
import { SheetsError } from "@/lib/sheets/client";
import { getMasterTable, saveMasterTable } from "@/lib/sheets/masterEdit";
import { QaError } from "@/lib/sheets/qa";

async function wrap<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof QaError) throw new ValidationError([e.message]);
    if (e instanceof SheetsError) throw new BackendError(e.message);
    throw e;
  }
}

/** GET /api/admin/master?table=member — isi satu tabel Master Data (khusus admin). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireApiRole(["admin"]);
    const id = new URL(req.url).searchParams.get("table") ?? "";
    return Response.json(await wrap(() => getMasterTable(id)));
  });
}

/** POST /api/admin/master { table, version, rows } — simpan seluruh tabel ke Google Sheet. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireApiRole(["admin"]);
    const b = await readJson(req);
    if (!Array.isArray(b.rows) || typeof b.table !== "string") throw new HttpError(400, "Data tidak lengkap.");
    const r = await wrap(() => saveMasterTable(String(b.table), String(b.version ?? ""), b.rows as Record<string, unknown>[]));
    invalidateMaster();
    clearReportCache();
    return Response.json(r);
  });
}
