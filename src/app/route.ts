import { renderLegacyPage } from "@/lib/legacy";
import { getMasterData } from "@/lib/sheets/qa";

export const dynamic = "force-dynamic";

/** Halaman yang dibuka dari QR: form member (/) dan validasi leader (/?page=leader). */
export async function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") === "leader" ? "leader" : "";
  // Master Data ditanam di halaman supaya form langsung tampil. Bila gagal, halaman memuatnya sendiri.
  const m = await getMasterData().catch(() => null);
  return new Response(renderLegacyPage({ page, m }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
