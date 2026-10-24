import { getSession } from "@/lib/auth";
import { SheetsError } from "@/lib/sheets/client";
import { todayJakarta } from "@/lib/dates";
import { LEADER_SESSION, leaderLogin, QaError, RPC } from "@/lib/sheets/qa";
import { buildToday } from "@/lib/views";

/** Tambahan khusus halaman leader di Vercel: member yang belum kirim pada tanggal itu (sama dengan Hari Ini). */
const EXTRA: Record<string, (...a: never[]) => Promise<unknown>> = {
  belumKirim: async (name: string, pin: string, date: string) => {
    await leaderLogin(name, pin);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : todayJakarta();
    return (await buildToday(d)).missing;
  },
};

/** Fungsi form member: wajib login, dan operator hanya boleh atas namanya sendiri. Nilai = nama member di argumen. */
const MEMBER_FNS: Record<string, (args: unknown[]) => unknown> = {
  submitReport: (a) => (a[0] as { member?: unknown } | undefined)?.member,
  riwayatMember: (a) => a[0],
  cekLaporan: (a) => a[1],
};

/** Fungsi halaman leader: argumen 0 = nama leader, 1 = PIN. Wajib sesi leader/admin; nama diambil dari sesi. */
const LEADER_FNS = new Set(["leaderLogin", "getAntrian", "putuskan", "editKiriman", "belumKirim"]);
/** Fungsi lain yang cukup butuh sesi apa saja (dulu terbuka tanpa login). */
const SESSION_FNS = new Set(["getMasterData"]);

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
  const list = Array.isArray(args) ? args : [];
  if (LEADER_FNS.has(fn) || SESSION_FNS.has(fn)) {
    const s = await getSession();
    if (!s) return Response.json({ ok: false, error: "Sesi login habis. Muat ulang halaman lalu masuk lagi dengan NIK." }, { status: 401 });
    if (LEADER_FNS.has(fn)) {
      if (s.role !== "leader" && s.role !== "admin") return Response.json({ ok: false, error: "Halaman ini khusus leader." }, { status: 403 });
      list[0] = s.name;
      list[1] = LEADER_SESSION;
    }
  }
  if (Object.hasOwn(MEMBER_FNS, fn)) {
    const s = await getSession();
    if (!s) return Response.json({ ok: false, error: "Sesi login habis. Muat ulang halaman lalu masuk lagi dengan NIK." }, { status: 401 });
    if (s.role === "operator" && String(MEMBER_FNS[fn](list) ?? "") !== s.name)
      return Response.json({ ok: false, error: `Anda masuk sebagai ${s.name}, hanya bisa mengisi laporan atas nama sendiri.` }, { status: 403 });
  }
  try {
    const data = await (f as (...a: unknown[]) => unknown)(...list);
    return Response.json({ ok: true, data: data ?? null });
  } catch (e) {
    if (e instanceof QaError || e instanceof SheetsError) return Response.json({ ok: false, error: e.message });
    console.error(e);
    return Response.json({ ok: false, error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}
