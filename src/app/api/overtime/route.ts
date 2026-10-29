import { handle, readJson } from "@/lib/api";
import { HttpError, requireApiRole } from "@/lib/auth";
import { deleteOtPlan, saveOtPlan } from "@/lib/sheets/overtime";

const nameOf = (v: unknown) => {
  const name = String(v ?? "").trim().slice(0, 80);
  if (!name) throw new HttpError(422, "Isi nama rencana.");
  return name;
};

/** POST: simpan rencana lembur (leader/admin). */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireApiRole(["leader", "admin"]);
    const b = await readJson(req);
    const name = nameOf(b.name);
    if (!b.data || typeof b.data !== "object") throw new HttpError(400, "Data rencana kosong.");
    if (JSON.stringify(b.data).length > 45000) throw new HttpError(422, "Rencana terlalu besar untuk disimpan.");
    try {
      await saveOtPlan(name, b.data, session.name);
    } catch (e) {
      throw new HttpError(500, (e as Error).message);
    }
    return Response.json({ ok: true });
  });
}

/** DELETE ?name=: hapus rencana tersimpan. */
export async function DELETE(req: Request) {
  return handle(async () => {
    await requireApiRole(["leader", "admin"]);
    await deleteOtPlan(nameOf(new URL(req.url).searchParams.get("name")));
    return Response.json({ ok: true });
  });
}
