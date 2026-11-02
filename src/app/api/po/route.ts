import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isValidDate, todayJakarta } from "@/lib/dates";
import { key, PROCESSES, type PoStatus, type Process } from "@/lib/po";
import { addBox, addPos, deleteBox, deletePo, readBoxRow, readPoState, updatePo } from "@/lib/sheets/po";

const ALL = ["operator", "leader", "manager", "admin"] as const;
const MANAGE = ["leader", "admin"] as const;
const str = (v: unknown, max = 80) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : NaN;
};

async function state() {
  return Response.json(await readPoState(), { headers: { "Cache-Control": "no-store" } });
}

/** GET: data PO, master customer, input box (untuk muat ulang otomatis). */
export async function GET() {
  return handle(async () => {
    await requireApiRole([...ALL]);
    return state();
  });
}

/** POST { action, ... }: addBox | deleteBox | addPos | updatePo | deletePo. Mengembalikan data terbaru. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole([...ALL]);
    const b = await readJson(req);
    const manage = (MANAGE as readonly string[]).includes(session.role);
    const cur = await readPoState();
    const itemOf = (customer: string, itemId: string) => {
      const it = cur.items.find((i) => key(i.customer, i.itemId) === key(customer, itemId));
      if (!it) throw new HttpError(422, `Item ${itemId} tidak ada di Master Customer ${customer}.`);
      return it;
    };

    switch (b.action) {
      case "addBox": {
        const process = PROCESSES.find((p) => p === b.process) as Process | undefined;
        if (!process) throw new HttpError(422, "Pilih proses Seiretsu atau Senbetsu.");
        const date = isValidDate(b.date) ? (b.date as string) : todayJakarta();
        if (date > todayJakarta()) throw new HttpError(422, "Tanggal tidak boleh setelah hari ini.");
        const it = itemOf(str(b.customer), str(b.itemId));
        const box = int(b.box || 0);
        const extra = int(b.extra || 0);
        if (!Number.isFinite(box) || !Number.isFinite(extra)) throw new HttpError(422, "Jumlah box tidak valid.");
        if (box === 0 && extra === 0) throw new HttpError(422, "Isi jumlah box.");
        if (Math.abs(box) > 500) throw new HttpError(422, "Jumlah box terlalu besar. Periksa lagi.");
        if (!(it.pcsPerBox > 0) && box !== 0) throw new HttpError(422, `Pcs/Box untuk ${it.itemName} belum diisi di Master Customer.`);
        if ((box < 0 || extra < 0) && !manage) throw new HttpError(403, "Koreksi minus hanya untuk leader/admin. Hapus input yang salah saja.");
        await addBox({ date, process, customer: it.customer, itemId: it.itemId, itemName: it.itemName, box, pcsPerBox: it.pcsPerBox, extra, note: str(b.note, 200) }, session.name);
        return state();
      }
      case "deleteBox": {
        const row = int(b.row);
        const r = Number.isFinite(row) && row >= 2 ? await readBoxRow(row) : null;
        if (!r || r.id !== str(b.id)) throw new HttpError(409, "Data sudah berubah. Muat ulang halaman.");
        if (!manage && (r.by !== session.name || r.date !== todayJakarta())) throw new HttpError(403, "Hanya input Anda sendiri hari ini yang bisa dihapus. Minta leader untuk yang lain.");
        await deleteBox(row, session.name);
        return state();
      }
      case "addPos": {
        if (!manage) throw new HttpError(403, "Input PO hanya untuk leader/admin.");
        const customer = str(b.customer);
        const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
        if (!lines.length) throw new HttpError(422, "Belum ada baris PO.");
        if (lines.length > 200) throw new HttpError(422, "Maksimal 200 baris sekali simpan.");
        const list = lines.map((l, i) => {
          const it = itemOf(customer, str(l.itemId));
          const qty = int(l.qty);
          if (!(qty > 0)) throw new HttpError(422, `Baris ${i + 1}: qty harus lebih dari 0.`);
          if (!isValidDate(l.due)) throw new HttpError(422, `Baris ${i + 1}: tanggal delivery belum diisi.`);
          return { noPo: str(l.noPo ?? b.noPo), customer: it.customer, itemId: it.itemId, itemName: it.itemName, qty, due: l.due as string, note: str(l.note, 200) };
        });
        await addPos(list, session.name);
        return state();
      }
      case "updatePo": {
        if (!manage) throw new HttpError(403, "Ubah PO hanya untuk leader/admin.");
        const patch: { qty?: number; due?: string; status?: PoStatus; noPo?: string; note?: string } = {};
        if (b.qty !== undefined) {
          const q = int(b.qty);
          if (!(q > 0)) throw new HttpError(422, "Qty harus lebih dari 0.");
          patch.qty = q;
        }
        if (b.due !== undefined) {
          if (!isValidDate(b.due)) throw new HttpError(422, "Tanggal delivery tidak valid.");
          patch.due = b.due as string;
        }
        if (b.status !== undefined) {
          if (!["Open", "Selesai", "Batal"].includes(String(b.status))) throw new HttpError(422, "Status tidak dikenal.");
          patch.status = b.status as PoStatus;
        }
        if (b.noPo !== undefined) patch.noPo = str(b.noPo);
        if (b.note !== undefined) patch.note = str(b.note, 200);
        try {
          await updatePo(int(b.row), str(b.id), patch, session.name);
        } catch (e) {
          throw new HttpError(409, (e as Error).message);
        }
        return state();
      }
      case "deletePo": {
        if (!manage) throw new HttpError(403, "Hapus PO hanya untuk leader/admin.");
        try {
          await deletePo(int(b.row), str(b.id));
        } catch (e) {
          throw new HttpError(409, (e as Error).message);
        }
        return state();
      }
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}
