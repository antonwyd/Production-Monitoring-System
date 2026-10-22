import { handle, readJson } from "@/lib/api";
import { clearLoginFailures, createSession, HOME_BY_ROLE, HttpError, loginRateLimited, recordLoginFailure } from "@/lib/auth";
import { callBackend, type RawLogin } from "@/lib/backend";
import { memberId, userId } from "@/lib/ids";
import { loadMaster } from "@/lib/service";
import type { Role } from "@/lib/types";

/** NIK + PIN dicek terhadap tab "Users" di Google Sheet. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const nik = String(body.nik ?? "").trim();
    const pin = String(body.pin ?? "").trim();
    if (!nik || !pin) throw new HttpError(400, "NIK dan PIN wajib diisi.");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `${nik.toLowerCase()}|${ip}`;
    if (loginRateLimited(key)) throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi 5 menit lagi.");
    const u = await callBackend<RawLogin>("login", { nik, pin });
    if (!u.ok) {
      recordLoginFailure(key);
      throw new HttpError(401, u.inactive ? "Akun ini tidak aktif. Hubungi admin." : "NIK atau PIN salah.");
    }
    clearLoginFailures(key);
    const role = u.role as Role;
    // Akun terhubung ke member bila namanya sama dengan nama di Master Data.
    const master = await loadMaster();
    const member = master.members.find((m) => m.nik === u.nik) ?? master.members.find((m) => m.name === u.name);
    // Operator mengisi form atas namanya sendiri, jadi namanya harus ada di daftar member Master Data.
    if (role === "operator" && !member) throw new HttpError(403, `Nama "${u.name}" belum ada di daftar member Master Data. Hubungi admin.`);
    await createSession({ userId: userId(nik), name: u.name ?? nik, role, area: "", memberId: member ? memberId(member.name) : null, nik });
    // Login dari halaman form member (/masuk) kembali ke form, apa pun perannya.
    return Response.json({ ok: true, redirect: body.next === "/" ? "/" : HOME_BY_ROLE[role] });
  });
}
