import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import { key, PROCESSES, type PoStatus, type Process } from "@/lib/po";
import { addBox, addPos, readPoState, updatePo } from "@/lib/sheets/po";

const ALL = ["operator", "leader", "manager", "admin"] as const;
const str = (v: unknown, max = 80) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : NaN;
};
const conflict = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    throw new HttpError(409, (e as Error).message);
  }
};

async function state() {
  return Response.json(await readPoState(), { headers: { "Cache-Control": "no-store" } });
}

/** GET: master customer + PO (untuk muat ulang otomatis). */
export async function GET() {
  return handle(async () => {
    await requireApiRole([...ALL]);
    return state();
  });
}

/** POST { action }: box (semua yang login) | addPo, updatePo (leader/admin). Mengembalikan data terbaru. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole([...ALL]);
    const b = await readJson(req);
    const manage = session.role === "leader" || session.role === "admin";

    if (b.action === "box") {
      const process = PROCESSES.find((p) => p === b.process) as Process | undefined;
      if (!process) throw new HttpError(422, "Pilih Seiretsu atau Senbetsu.");
      const delta = int(b.delta);
      if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 200) throw new HttpError(422, "Jumlah box tidak valid.");
      await conflict(() => addBox(int(b.row), str(b.id), process, delta, session.name));
      return state();
    }

    if (!manage) throw new HttpError(403, "Input dan ubah PO hanya untuk leader/admin.");

    if (b.action === "addPo") {
      const cur = await readPoState();
      const customer = str(b.customer);
      if (!isValidDate(b.due)) throw new HttpError(422, "Isi delivery date.");
      const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
      if (!lines.length) throw new HttpError(422, "Isi qty minimal satu part.");
      if (lines.length > 100) throw new HttpError(422, "Maksimal 100 part sekali simpan.");
      const list = lines.map((l) => {
        const it = cur.items.find((i) => key(i.customer, i.itemId) === key(customer, str(l.itemId)));
        if (!it) throw new HttpError(422, `Part ${str(l.itemId)} tidak ada di Master Customer ${customer}.`);
        if (!(it.pcsPerBox > 0)) throw new HttpError(422, `Pcs/Box untuk ${it.itemName} belum diisi di Master Customer.`);
        const qty = int(l.qty);
        if (!(qty > 0)) throw new HttpError(422, `Qty ${it.itemName} tidak valid.`);
        return { customer: it.customer, itemId: it.itemId, itemName: it.itemName, pcsPerBox: it.pcsPerBox, qty, due: b.due as string, noPo: str(b.noPo) };
      });
      await addPos(list, session.name);
      return state();
    }

    if (b.action === "updatePo") {
      const patch: Parameters<typeof updatePo>[2] = {};
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
        if (!["Open", "Dikirim", "Batal", "Dihapus"].includes(String(b.status))) throw new HttpError(422, "Status tidak dikenal.");
        patch.status = b.status as PoStatus | "Dihapus";
      }
      if (b.noPo !== undefined) patch.noPo = str(b.noPo);
      if (b.box && typeof b.box === "object") {
        patch.box = {};
        for (const pr of PROCESSES) {
          const v = (b.box as Record<string, unknown>)[pr];
          if (v === undefined) continue;
          const x = int(v);
          if (!(x >= 0)) throw new HttpError(422, `Box ${pr} tidak valid.`);
          patch.box[pr] = x;
        }
      }
      await conflict(() => updatePo(int(b.row), str(b.id), patch, session.name));
      return state();
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}
