import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { handle, readJson } from "@/lib/api";
import { clearLoginFailures, createSession, HOME_BY_ROLE, HttpError, loginRateLimited, recordLoginFailure } from "@/lib/auth";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const nik = String(body.nik ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    if (!nik || !pin) throw new HttpError(400, "NIK dan PIN wajib diisi.");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `${nik.toLowerCase()}|${ip}`;
    if (loginRateLimited(key)) throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi 5 menit lagi.");
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.nik, nik));
    if (!u || !u.active || !(await bcrypt.compare(pin, u.pinHash))) {
      recordLoginFailure(key);
      throw new HttpError(401, "NIK atau PIN salah.");
    }
    clearLoginFailures(key);
    await createSession({ userId: u.id, name: u.name, role: u.role, area: u.area, memberId: u.memberId });
    return Response.json({ ok: true, redirect: HOME_BY_ROLE[u.role] });
  });
}
