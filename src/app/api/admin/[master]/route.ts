import { getDb } from "@/db";
import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { adminOptions, getDef, listMaster, saveMaster } from "@/lib/admin";

type Ctx = { params: Promise<{ master: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireApiRole(["admin"]);
    const { master } = await ctx.params;
    if (!getDef(master)) throw new HttpError(404, "Master tidak dikenal.");
    const db = await getDb();
    const [rows, options] = await Promise.all([listMaster(db, master), adminOptions(db)]);
    return Response.json({ rows, options });
  });
}

async function save(req: Request, ctx: Ctx) {
  return handle(async () => {
    const s = await requireApiRole(["admin"]);
    const { master } = await ctx.params;
    if (!getDef(master)) throw new HttpError(404, "Master tidak dikenal.");
    const body = await readJson(req);
    if (master === "users" && Number(body.id) === s.userId && (body.active === false || (body.role && body.role !== "admin")))
      throw new HttpError(400, "Tidak bisa menonaktifkan atau menurunkan peran akun sendiri.");
    const db = await getDb();
    return Response.json(await saveMaster(db, master, body, s.userId));
  });
}

export const POST = save;
export const PATCH = save;
