import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isValidMonth, SECTIONS } from "@/lib/monthly";
import { parseDays, savePlan } from "@/lib/sheets/plan";

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
};

/** POST: simpan plan satu bulan + section (leader/admin). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole(["leader", "admin"]);
    const b = await readJson(req);
    const month = String(b.month ?? "");
    const section = String(b.section ?? "");
    if (!isValidMonth(month)) throw new HttpError(400, "Bulan tidak valid.");
    if (!SECTIONS.some((s) => s.key === section)) throw new HttpError(400, "Section tidak dikenal.");
    const production = num(b.production);
    const workDays = parseDays(Array.isArray(b.workDays) ? b.workDays.join(",") : b.workDays);
    if (!production) throw new HttpError(422, "Isi Plan Produksi.");
    if (!workDays.length) throw new HttpError(422, "Pilih minimal satu hari kerja.");
    await savePlan({
      month,
      section,
      production: Math.round(production),
      workDays,
      hoursNormal: num(b.hoursNormal),
      units: Math.round(num(b.units)),
      productivity: num(b.productivity),
      note: String(b.note ?? "").slice(0, 1000),
      by: session.name,
    });
    return Response.json({ ok: true });
  });
}
