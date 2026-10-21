import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { MASTER_DEFS, type MasterDef } from "./adminConfig";
import { invalidateMaster, ValidationError } from "./service";

const TABLES: Record<string, PgTable & { id?: unknown }> = {
  members: s.members,
  users: s.users,
  categories: s.categories,
  parts: s.parts,
  machines: s.machines,
  "lost-time-types": s.lostTimeTypes,
  "ng-codes": s.ngCodes,
  "ng-groups": s.ngGroups,
  settings: s.settings,
};

export function getDef(key: string): MasterDef | undefined {
  return MASTER_DEFS.find((d) => d.key === key);
}

export async function adminOptions(db: DB) {
  const [categories, ngGroups, members] = await Promise.all([
    db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(asc(s.categories.name)),
    db.select({ id: s.ngGroups.id, name: s.ngGroups.name }).from(s.ngGroups).orderBy(asc(s.ngGroups.name)),
    db.select({ id: s.members.id, name: s.members.name, nik: s.members.nik }).from(s.members).orderBy(asc(s.members.name)),
  ]);
  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
    ngGroups: ngGroups.map((c) => ({ value: c.id, label: c.name })),
    members: members.map((m) => ({ value: m.id, label: `${m.name} (${m.nik})` })),
    roles: s.ROLES.map((r) => ({ value: r, label: r })),
    ltGroups: [
      { value: "LOST_TIME", label: "Lost Time" },
      { value: "ANOTHER_JOB", label: "Another Job" },
    ],
  };
}

export async function listMaster(db: DB, key: string) {
  const def = getDef(key);
  const table = TABLES[key];
  if (!def || !table) throw new ValidationError(["Master tidak dikenal."]);
  const rows = (await db.select().from(table as never)) as Record<string, unknown>[];
  return rows
    .map((r) => {
      const { pinHash: _p, ...rest } = r;
      return rest;
    })
    .sort((a, b) => (typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : String(a.key).localeCompare(String(b.key))));
}

function coerce(def: MasterDef, body: Record<string, unknown>, isCreate: boolean) {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const f of def.fields) {
    if (!(f.key in body)) {
      if (isCreate && f.required) errors.push(`${f.label} wajib diisi.`);
      continue;
    }
    const v = body[f.key];
    if (f.type === "bool") out[f.key] = v === true || v === "true";
    else if (f.type === "number") {
      const n = Number(v);
      if (v === "" || v == null || !Number.isFinite(n)) {
        if (f.required) errors.push(`${f.label} harus angka.`);
      } else out[f.key] = n;
    } else if (f.type === "select") {
      if (v === "" || v == null) {
        if (f.required) errors.push(`${f.label} wajib dipilih.`);
        else out[f.key] = null;
      } else out[f.key] = f.options === "roles" || f.options === "ltGroups" ? String(v) : Number(v);
    } else if (f.type === "pin") {
      if (typeof v === "string" && v.trim()) {
        if (!/^\d{4,8}$/.test(v.trim())) errors.push("PIN harus 4–8 digit angka.");
        else out.pinHash = bcrypt.hashSync(v.trim(), 10);
      }
    } else {
      const str = typeof v === "string" ? v.trim() : String(v ?? "");
      if (f.required && !str) errors.push(`${f.label} wajib diisi.`);
      out[f.key] = str;
    }
  }
  if (def.key === "users" && isCreate && !out.pinHash) errors.push("PIN wajib diisi untuk user baru.");
  if (def.key === "ng-codes" && out.code != null && !(Number.isInteger(out.code) && (out.code as number) >= 1 && (out.code as number) <= 10))
    errors.push("Kode NG harus 1–10.");
  if (def.key === "parts" && out.stki != null && !((out.stki as number) > 0)) errors.push("STKI harus lebih dari 0.");
  if (errors.length) throw new ValidationError(errors);
  return out;
}

function friendlyDbError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const cause = (e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
  if (cause === "23505" || /duplicate key|unique/i.test(msg)) throw new ValidationError(["Data sudah ada (duplikat)."]);
  throw e;
}

export async function saveMaster(db: DB, key: string, body: Record<string, unknown>, userId: number) {
  const def = getDef(key);
  const table = TABLES[key] as never as PgTable & Record<string, unknown>;
  if (!def || !table) throw new ValidationError(["Master tidak dikenal."]);
  const idKey = def.idKey ?? "id";
  const idVal = body[idKey];
  const isCreate = idKey === "id" ? idVal == null || idVal === "" : !(await exists(db, key, String(idVal)));
  const data = coerce(def, body, isCreate);
  const col = (table as Record<string, unknown>)[idKey] as never;
  try {
    let saved: Record<string, unknown>;
    let before: Record<string, unknown> | null = null;
    if (isCreate) {
      [saved] = (await db.insert(table).values(data as never).returning()) as Record<string, unknown>[];
    } else {
      const id = idKey === "id" ? Number(idVal) : String(idVal);
      [before] = (await db.select().from(table as never).where(eq(col, id))) as Record<string, unknown>[];
      if (!before) throw new ValidationError(["Data tidak ditemukan."]);
      delete data[idKey];
      [saved] = (await db.update(table).set(data as never).where(eq(col, id)).returning()) as Record<string, unknown>[];
    }
    const strip = (r: Record<string, unknown> | null) => {
      if (!r) return null;
      const { pinHash: _p, ...rest } = r;
      return rest;
    };
    await db.insert(s.auditLog).values({
      userId,
      action: isCreate ? "create" : "update",
      tableName: key,
      recordId: String(saved[idKey]),
      before: strip(before),
      after: strip(saved),
    });
    invalidateMaster();
    return strip(saved);
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    friendlyDbError(e);
  }
}

async function exists(db: DB, key: string, id: string) {
  if (key !== "settings") return false;
  const r = await db.select().from(s.settings).where(eq(s.settings.key, id));
  return r.length > 0;
}
