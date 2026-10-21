import { getDb } from "@/db";
import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { decide } from "@/lib/service";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["leader", "admin"]);
    const body = await readJson(req);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    const action = body.action;
    if (!ids.length || (action !== "approve" && action !== "reject")) throw new HttpError(400, "ids dan aksi (approve/reject) wajib.");
    const db = await getDb();
    const results = await decide(db, {
      ids,
      action,
      note: typeof body.note === "string" ? body.note : "",
      leaderId: s.userId,
      area: s.role === "leader" ? s.area : "",
      bulk: body.bulk === true,
    });
    return Response.json({ results });
  });
}
