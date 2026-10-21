import { getDb } from "@/db";
import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import { createSubmission, listSubmissions } from "@/lib/service";

/** Kiriman satu member pada satu tanggal (untuk cegah dobel di form). */
export async function GET(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["operator", "leader", "admin"]);
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    let memberId = Number(url.searchParams.get("member"));
    if (s.role === "operator") memberId = s.memberId ?? -1;
    if (!isValidDate(date) || !Number.isInteger(memberId) || memberId <= 0) throw new HttpError(400, "Parameter date dan member wajib.");
    const db = await getDb();
    return Response.json(await listSubmissions(db, { workDate: date, memberId, limit: 20 }));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["operator", "leader", "admin"]);
    if (s.role === "operator" && s.memberId == null) throw new HttpError(403, "Akun operator belum terhubung ke member. Hubungi admin.");
    const body = await readJson(req);
    const db = await getDb();
    const res = await createSubmission(db, body, {
      submittedBy: s.userId,
      forceMemberId: s.role === "operator" ? s.memberId : undefined,
    });
    return Response.json(res, { status: 201 });
  });
}
