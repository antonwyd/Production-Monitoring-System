import { SheetsError } from "@/lib/sheets/client";
import { todayJakarta } from "@/lib/dates";
import { leaderLogin, QaError, RPC } from "@/lib/sheets/qa";
import { buildToday } from "@/lib/views";

/** Tambahan khusus halaman leader di Vercel: member yang belum kirim pada tanggal itu (sama dengan Hari Ini). */
const EXTRA: Record<string, (...a: never[]) => Promise<unknown>> = {
  belumKirim: async (name: string, pin: string, date: string) => {
    await leaderLogin(name, pin);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : todayJakarta();
    return (await buildToday(d)).missing;
  },
};

/** Pengganti google.script.run untuk halaman form member & leader. Body: array argumen. */
export async function POST(req: Request, ctx: { params: Promise<{ fn: string }> }) {
  const { fn } = await ctx.params;
  const f = Object.hasOwn(RPC, fn) ? RPC[fn] : Object.hasOwn(EXTRA, fn) ? EXTRA[fn] : undefined;
  if (!f) return Response.json({ ok: false, error: "Fungsi tidak dikenal." }, { status: 404 });
  let args: unknown;
  try {
    args = await req.json();
  } catch {
    args = [];
  }
  try {
    const data = await (f as (...a: unknown[]) => unknown)(...(Array.isArray(args) ? args : []));
    return Response.json({ ok: true, data: data ?? null });
  } catch (e) {
    if (e instanceof QaError || e instanceof SheetsError) return Response.json({ ok: false, error: e.message });
    console.error(e);
    return Response.json({ ok: false, error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
