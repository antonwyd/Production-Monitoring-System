import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { aiEnabled, askAi, type ChatTurn } from "@/lib/ai";

export const maxDuration = 120;

/** GET /api/ai — apakah fitur Tanya AI aktif (API key sudah dipasang). */
export async function GET() {
  return handle(async () => {
    await requireApiRole(["leader", "manager", "admin"]);
    return Response.json({ enabled: aiEnabled() });
  });
}

/** POST /api/ai {messages:[{role,content}]} — jawab pertanyaan terakhir dari data laporan produksi. */
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireApiRole(["leader", "manager", "admin"]);
    if (!aiEnabled()) throw new HttpError(503, "Fitur Tanya AI belum aktif: API key Anthropic belum dipasang di Vercel.");
    const body = await readJson(req);
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages: ChatTurn[] = raw
      .filter((m): m is ChatTurn => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Pertanyaan kosong.");
    try {
      const r = await askAi(messages, { name: s.name, role: s.role });
      console.log(`[ai] ${s.name} in=${r.usage.input} out=${r.usage.output}`);
      return Response.json({ text: r.text });
    } catch (e) {
      console.error("[ai]", e);
      throw new HttpError(502, "AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.");
    }
  });
}
