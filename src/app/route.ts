import { getSession } from "@/lib/auth";
import { renderLegacyPage } from "@/lib/legacy";
import { getMasterData } from "@/lib/sheets/qa";

export const dynamic = "force-dynamic";

/** Halaman yang dibuka dari QR: form member (/) dan validasi leader (/?page=leader). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = url.searchParams.get("page") === "leader" ? "leader" : "";
  // Form member wajib login NIK + PIN. Halaman leader wajib sesi leader/admin (dulu cukup nama + PIN leader).
  const s = await getSession();
  if (!page && !s) return Response.redirect(new URL("/masuk", url), 303);
  if (page && (!s || (s.role !== "leader" && s.role !== "admin"))) return Response.redirect(new URL(s ? "/" : "/login?next=leader", url), 303);
  // Master Data ditanam di halaman supaya form langsung tampil. Bila gagal, halaman memuatnya sendiri.
  const m = await getMasterData().catch(() => null);
  const user = s ? { name: s.name, nik: s.nik ?? "", lock: s.role === "operator", leader: !!page } : null;
  return new Response(renderLegacyPage({ page, m, user }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
