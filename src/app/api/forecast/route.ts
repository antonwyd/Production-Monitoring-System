import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isYm, JENIS, mergeManual, normPart, type FcRow } from "@/lib/forecast";
import { deleteForecastVersion, readForecast, saveForecastVersion } from "@/lib/sheets/forecast";

const ym = z.string().refine(isYm, "Bulan tidak valid");
const qty = z.number().finite().min(0).max(1e10);
const customer = z.string().trim().min(1, "Pilih customer").max(80);

const Save = z.object({
  action: z.literal("save"),
  versi: ym,
  customer,
  rows: z.array(z.object({ part: z.string().min(1).max(80), jenis: z.enum(JENIS as [string, ...string[]]), bulan: ym, qty, box: z.number().optional() })).max(20000),
  daily: z.array(z.object({ part: z.string().min(1).max(80), tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), qty })).max(20000),
});
const Manual = z.object({
  action: z.literal("manual"),
  customer,
  bulan: ym,
  items: z
    .array(z.object({ part: z.string().trim().min(1).max(80), forecast: qty.nullable(), actual: qty.nullable(), box: z.number().optional() }))
    .min(1, "Isi minimal satu part")
    .max(300),
});

/** POST: simpan hasil upload (action save) atau input manual satu bulan (action manual). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole(["leader", "admin"]);
    const body = await readJson(req);
    if (body.action === "save") {
      const b = Save.safeParse(body);
      if (!b.success) throw new HttpError(422, b.error.issues[0]?.message ?? "Data tidak valid.");
      await saveForecastVersion({ versi: b.data.versi, customer: b.data.customer, rows: b.data.rows as FcRow[], daily: b.data.daily, by: session.name, sumber: "Upload" });
      return Response.json({ ok: true });
    }
    if (body.action === "manual") {
      const b = Manual.safeParse(body);
      if (!b.success) throw new HttpError(422, b.error.issues[0]?.message ?? "Data tidak valid.");
      const { customer: c, bulan, items } = b.data;
      // Input manual masuk ke versi bulan itu; baris lain di versi itu (forecast bulan depan, dst.) tetap.
      const { rows } = await readForecast(true);
      const existing: FcRow[] = rows.filter((r) => r.versi === bulan && r.customer.toLowerCase() === c.toLowerCase()).map(({ part, jenis, bulan: bl, qty: q, box }) => ({ part, jenis, bulan: bl, qty: q, box }));
      const merged = mergeManual(existing, bulan, items.map((i) => ({ ...i, part: normPart(i.part) })));
      await saveForecastVersion({ versi: bulan, customer: c, rows: merged, daily: null, by: session.name, sumber: existing.length ? "Upload + manual" : "Manual" });
      return Response.json({ ok: true });
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}

/** DELETE ?versi=YYYY-MM&customer=: hapus satu versi (admin). */
export async function DELETE(req: Request) {
  return handle(async () => {
    await requireApiRole(["admin"]);
    const u = new URL(req.url).searchParams;
    const versi = u.get("versi") ?? "";
    const c = (u.get("customer") ?? "").trim();
    if (!isYm(versi) || !c) throw new HttpError(422, "Versi / customer tidak valid.");
    await deleteForecastVersion(versi, c);
    return Response.json({ ok: true });
  });
}
