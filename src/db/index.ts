import path from "node:path";
import fs from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Membuat koneksi database.
 * - DATABASE_URL terisi: PostgreSQL biasa (mis. Supabase) lewat node-postgres.
 * - DATABASE_URL kosong: PGlite (PostgreSQL di proses, tanpa server) di ./data/pglite,
 *   atau di memori bila dataDir = "memory://".
 * Migrasi dijalankan otomatis saat koneksi dibuat.
 */
export async function createDb(opts: { url?: string; dataDir?: string } = {}): Promise<DB> {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // Supabase dan PostgreSQL cloud lain mewajibkan SSL; server lokal biasanya tidak.
    const local = /@(localhost|127\.0\.0\.1|db|postgres)(:|\/)/.test(url);
    const ssl = process.env.DATABASE_SSL === "false" || local ? undefined : { rejectUnauthorized: false };
    const db = drizzle(new Pool({ connectionString: url, max: 5, ssl }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = opts.dataDir ?? process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pglite");
  if (!dataDir.startsWith("memory://")) fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const globalForDb = globalThis as unknown as { __qaDb?: Promise<DB> };

/** Koneksi bersama untuk aplikasi. Dibuat sekali per proses. */
export function getDb(): Promise<DB> {
  if (!globalForDb.__qaDb) {
    globalForDb.__qaDb = createDb().then(async (db) => {
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      return db;
    });
    globalForDb.__qaDb.catch(() => {
      globalForDb.__qaDb = undefined;
    });
  }
  return globalForDb.__qaDb;
}
