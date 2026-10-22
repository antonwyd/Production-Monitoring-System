import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./types";

export type Session = {
  userId: number;
  name: string;
  role: Role;
  area: string;
  memberId: number | null;
};

const COOKIE = "qa_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari: sesi tersimpan di HP

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET wajib diisi di produksi.");
    return new TextEncoder().encode("dev-only-secret-ganti-di-produksi");
  }
  return new TextEncoder().encode(s);
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as number,
      name: payload.name as string,
      role: payload.role as Role,
      area: (payload.area as string) ?? "",
      memberId: (payload.memberId as number | null) ?? null,
    };
  } catch {
    return null;
  }
}

export const HOME_BY_ROLE: Record<Role, string> = {
  operator: "/",
  leader: "/hari-ini",
  manager: "/laporan",
  admin: "/hari-ini",
};

/** Untuk halaman: arahkan ke login bila belum login atau perannya tidak cocok. */
export async function requirePageRole(roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!roles.includes(s.role)) redirect(HOME_BY_ROLE[s.role]);
  return s;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Untuk API: lempar 401/403 bila tidak berhak. */
export async function requireApiRole(roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Silakan login dulu.");
  if (!roles.includes(s.role)) throw new HttpError(403, "Anda tidak punya akses untuk aksi ini.");
  return s;
}

// Rate limit login sederhana per NIK + IP (di memori proses).
const attempts = new Map<string, { count: number; until: number }>();
export function loginRateLimited(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const until = Date.now() + 5 * 60 * 1000;
  attempts.set(key, { count: a && a.until > Date.now() ? a.count + 1 : 1, until });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
