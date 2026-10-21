import { SheetsError } from "@/lib/sheets/client";
import { QaError, RPC } from "@/lib/sheets/qa";

/** Pengganti google.script.run untuk halaman form member & leader. Body: array argumen. */
export async function POST(req: Request, ctx: { params: Promise<{ fn: string }> }) {
  const { fn } = await ctx.params;
  const f = Object.hasOwn(RPC, fn) ? RPC[fn] : undefined;
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
