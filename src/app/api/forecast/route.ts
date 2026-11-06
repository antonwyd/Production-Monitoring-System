import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { isYm, isYmd, latestForecast, normPart } from "@/lib/forecast";
import { deleteForecastMonth, masterCustomers, readForecast, saveForecastMonth, savePoDay } from "@/lib/sheets/forecast";

const ym = z.string().refine(isYm, "Bulan tidak valid");
const ymd = z.string().refine(isYmd, "Tanggal tidak valid");
const qty = z.number().finite().min(0).max(1e10);
const customer = z.string().trim().min(1, "Pilih customer").max(80);
const part = z.string().trim().min(1).max(80);

const SaveFc = z.object({
  action: z.literal("forecast"),
  versi: ym,
  customer,
  daily: z.array(z.object({ part, tanggal: ymd, qty, box: z.number().min(0).optional() })).max(20000),
});
const SavePo = z.object({
  action: z.literal("po"),
  customer,
  tanggal: ymd,
  items: z.array(z.object({ part, qty })).max(500),
});

/** GET ?c=&t=YYYY-MM-DD : bahan form input PO (daftar part + forecast tanggal itu + PO yang sudah tersimpan). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireApiRole(["leader", "admin"]);
    const u = new URL(req.url).searchParams;
    const c = (u.get("c") ?? "").trim();
    const tgl = u.get("t") ?? "";
    if (!c || !isYmd(tgl)) throw new HttpError(422, "Customer / tanggal tidak valid.");
    const [{ fc, po }, master] = await Promise.all([readForecast(true), masterCustomers()]);
    const month = tgl.slice(0, 7);
    const mine = latestForecast(fc).filter((r) => r.customer === c && r.tanggal.startsWith(month));
    const order: string[] = [];
    const info = new Map<string, { box: number; fc: number; fcMonth: number; poMonth: number }>();
    const add = (p: string, box = 0) => {
      if (!info.has(p)) (info.set(p, { box, fc: 0, fcMonth: 0, poMonth: 0 }), order.push(p));
      const x = info.get(p)!;
      if (box && !x.box) x.box = box;
      return x;
    };
    for (const r of mine) {
      const x = add(r.part, r.box ?? 0);
      x.fcMonth += r.qty;
      if (r.tanggal === tgl) x.fc += r.qty;
    }
    const fcDays: Record<string, Record<string, number>> = {};
    for (const r of mine) (fcDays[r.part] ??= {})[r.tanggal] = (fcDays[r.part]?.[r.tanggal] ?? 0) + r.qty;
    const saved: Record<string, number> = {};
    for (const r of po.filter((r) => r.customer === c && r.tanggal.startsWith(month))) {
      const x = add(r.part);
      if (r.tanggal === tgl) saved[r.part] = (saved[r.part] ?? 0) + r.qty;
      else x.poMonth += r.qty;
    }
    // Belum ada forecast bulan ini: pakai daftar part di Master Customer.
    if (!order.length) for (const m of master.parts[c] ?? []) add(m.part, m.box);
    return Response.json({
      parts: order.map((p) => ({ part: p, ...info.get(p)! })),
      saved,
      fcDays,
      hasForecast: mine.length > 0,
      today: todayJakarta(),
    });
  });
}

/** POST: simpan forecast satu bulan (action forecast) atau PO satu tanggal kirim (action po). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole(["leader", "admin"]);
    const body = await readJson(req);
    if (body.action === "forecast") {
      const b = SaveFc.safeParse(body);
      if (!b.success) throw new HttpError(422, b.error.issues[0]?.message ?? "Data tidak valid.");
      const { versi, daily } = b.data;
      if (daily.some((d) => !d.tanggal.startsWith(versi))) throw new HttpError(422, `Semua tanggal forecast harus di bulan ${versi}.`);
      await saveForecastMonth({ versi, customer: b.data.customer, daily: daily.filter((d) => d.qty > 0).map((d) => ({ ...d, part: normPart(d.part) })), by: session.name });
      return Response.json({ ok: true });
    }
    if (body.action === "po") {
      const b = SavePo.safeParse(body);
      if (!b.success) throw new HttpError(422, b.error.issues[0]?.message ?? "Data tidak valid.");
      const merged = new Map<string, number>();
      for (const i of b.data.items) merged.set(normPart(i.part), (merged.get(normPart(i.part)) ?? 0) + i.qty);
      await savePoDay({ customer: b.data.customer, tanggal: b.data.tanggal, items: [...merged].map(([p, q]) => ({ part: p, qty: q })), by: session.name });
      return Response.json({ ok: true });
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}

/** DELETE ?versi=YYYY-MM&customer= : hapus forecast satu bulan (admin). */
export async function DELETE(req: Request) {
  return handle(async () => {
    await requireApiRole(["admin"]);
    const u = new URL(req.url).searchParams;
    const versi = u.get("versi") ?? "";
    const c = (u.get("customer") ?? "").trim();
    if (!isYm(versi) || !c) throw new HttpError(422, "Bulan / customer tidak valid.");
    await deleteForecastMonth(versi, c);
    return Response.json({ ok: true });
  });
}
