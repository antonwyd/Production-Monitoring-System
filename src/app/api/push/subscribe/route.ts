import { getSession } from "@/lib/auth";
import { SheetsError } from "@/lib/sheets/client";
import { nikMember, QaError, simpanLangganan } from "@/lib/sheets/qa";

/** POST /api/push/subscribe { sub, perangkat } — simpan izin notifikasi HP untuk user yang login. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ ok: false, error: "Sesi login habis." }, { status: 401 });
  try {
    const b = (await req.json().catch(() => ({}))) as { sub?: { endpoint?: unknown }; perangkat?: unknown };
    if (!b.sub) return Response.json({ ok: false, error: "Data notifikasi kosong." }, { status: 400 });
    const nik = s.nik || (await nikMember(s.name));
    await simpanLangganan(nik, s.name, b.sub, String(b.perangkat ?? req.headers.get("user-agent") ?? ""));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof QaError || e instanceof SheetsError) return Response.json({ ok: false, error: e.message });
    console.error(e);
    return Response.json({ ok: false, error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
