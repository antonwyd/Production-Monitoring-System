import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import type { DB } from "./index";
import * as s from "./schema";
import { newSubmissionId, todayJakarta, addDays } from "@/lib/dates";

/**
 * Master data awal dari PRD. Nama NG, part dan STKI di sini adalah CONTOH:
 * ganti lewat halaman Admin atau impor dari Google Sheet v1.
 */
const NG_GROUPS: Record<string, string[]> = {
  "Iron Cage": ["Part Tercampur", "Kizu", "Dent", "Karat", "Bari", "Pecah", "Bengkok", "Hole", "Kotor", "Lain-lain"],
  "Plastic Cage": ["Part Tercampur", "Kizu", "Short Shot", "Flash", "Retak", "Bubble", "Warna", "Hole", "Kotor", "Lain-lain"],
  Shield: ["Part Tercampur", "Kizu", "Dent", "Penyok", "Karat", "Bari", "Bengkok", "Hole", "Kotor", "Lain-lain"],
  Drum: ["Part Tercampur", "Kizu", "Dent", "Over Pole", "Kurang Pole", "Bari", "Pecah", "Hole", "Kotor", "Lain-lain"],
};

const CATEGORIES: { name: string; process: string; area: string; ng: string }[] = [
  { name: "Seiretsu Iron Cage", process: "Seiretsu", area: "Seiretsu", ng: "Iron Cage" },
  { name: "Seiretsu Plastik Cage", process: "Seiretsu", area: "Seiretsu", ng: "Plastic Cage" },
  { name: "Senbetsu Iron Cage", process: "Senbetsu", area: "Senbetsu", ng: "Iron Cage" },
  { name: "Senbetsu Shield", process: "Senbetsu", area: "Senbetsu", ng: "Shield" },
  { name: "Senbetsu Plastik Cage", process: "Senbetsu", area: "Senbetsu", ng: "Plastic Cage" },
  { name: "PF Iron Cage", process: "PF", area: "PF", ng: "Iron Cage" },
  { name: "PF Plastik", process: "PF", area: "PF", ng: "Plastic Cage" },
  { name: "Drum PF", process: "PF", area: "PF", ng: "Drum" },
];

const PARTS: Record<string, [string, string, number][]> = {
  "Seiretsu Iron Cage": [["608JCL-1-J", "D1", 6656], ["6202-J", "D1", 5200], ["6203-J", "D2", 4800]],
  "Seiretsu Plastik Cage": [["608-P", "", 5600], ["6000-P", "", 6000]],
  "Senbetsu Iron Cage": [["6201-J", "D1", 3600], ["6301-J", "D1", 3200]],
  "Senbetsu Shield": [["6201-ZZ", "", 4200], ["6202-ZZ", "", 4000]],
  "Senbetsu Plastik Cage": [["608-P", "", 3800], ["6001-P", "", 3600]],
  "PF Iron Cage": [["6902-J", "D1", 1100], ["6803-J", "D1", 1200], ["6904-J", "D2", 950], ["6005-J*KD", "D1", 900]],
  "PF Plastik": [["6000-P", "", 1500], ["6201-P", "", 1300], ["6302-P", "", 1100]],
  "Drum PF": [["DR-608", "", 800], ["DR-6202", "", 700]],
};

const MACHINES: { category: string; count: number; pad: boolean; line: string }[] = [
  { category: "PF Iron Cage", count: 29, pad: true, line: "EXPO" },
  { category: "PF Plastik", count: 14, pad: false, line: "PL" },
  { category: "Drum PF", count: 11, pad: true, line: "DRUM" },
];

const LOST_TIME: [string, s.LostTimeGroup][] = [
  ["Pumping", "LOST_TIME"],
  ["Istirahat Sakit", "LOST_TIME"],
  ["Training", "LOST_TIME"],
  ["MCU", "LOST_TIME"],
  ["Evaluasi", "LOST_TIME"],
  ["Perbaikan Mesin PF", "ANOTHER_JOB"],
  ["Setting Mesin PF", "ANOTHER_JOB"],
  ["Helper", "ANOTHER_JOB"],
  ["Reinspect", "ANOTHER_JOB"],
  ["Double Check", "ANOTHER_JOB"],
  ["Ganti Pole / Copot Pole", "ANOTHER_JOB"],
  ["5S", "ANOTHER_JOB"],
  ["Support Another Section", "ANOTHER_JOB"],
  ["Master Ulang", "ANOTHER_JOB"],
  ["Sortir Pole", "ANOTHER_JOB"],
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  normal_min: "480",
  ot_limit_hrs: "4",
  target: "100",
  grade_a: "100",
  grade_b: "90",
  grade_c: "80",
  stki_high_pct: "150",
  stki_low_pct: "30",
};

const DEMO_MEMBERS: [string, string, string][] = [
  ["201003", "Harjuki", "PF"],
  ["201015", "Siti Rahma", "PF"],
  ["201022", "Budi Santoso", "PF"],
  ["201031", "Dewi Lestari", "PF"],
  ["201044", "Agus Pratama", "PF"],
  ["201057", "Rina Wulandari", "PF"],
  ["202001", "Eko Saputra", "Seiretsu"],
  ["202014", "Nur Aini", "Seiretsu"],
  ["203002", "Joko Susilo", "Senbetsu"],
  ["203019", "Maya Sari", "Senbetsu"],
];

export async function seedIfEmpty(db: DB) {
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from categories`)).rows as { n: number }[];
  if (n > 0) return false;
  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === "1" : !process.env.DATABASE_URL;
  await seed(db, { demo });
  return true;
}

export async function seed(db: DB, opts: { demo: boolean }) {
  await db.transaction(async (tx) => {
    const groupIds: Record<string, number> = {};
    for (const [name, codes] of Object.entries(NG_GROUPS)) {
      const [g] = await tx.insert(s.ngGroups).values({ name }).returning();
      groupIds[name] = g.id;
      await tx.insert(s.ngCodes).values(codes.map((n, i) => ({ ngGroupId: g.id, code: i + 1, name: n })));
    }
    const catIds: Record<string, number> = {};
    for (const c of CATEGORIES) {
      const [row] = await tx
        .insert(s.categories)
        .values({ name: c.name, process: c.process, area: c.area, ngGroupId: groupIds[c.ng] })
        .returning();
      catIds[c.name] = row.id;
    }
    for (const [cat, list] of Object.entries(PARTS)) {
      await tx.insert(s.parts).values(list.map(([name, type, stki]) => ({ categoryId: catIds[cat], name, type, stki })));
    }
    for (const m of MACHINES) {
      const list = PARTS[m.category];
      const rows = Array.from({ length: m.count }, (_, i) => {
        const main = list[i % list.length];
        const alt = list[(i + 1) % list.length];
        return {
          categoryId: catIds[m.category],
          mcNo: `MC ${m.pad ? String(i + 1).padStart(2, "0") : i + 1}`,
          line: m.line,
          mainPart: `${main[0]} ${main[1]}`.trim(),
          canSwitchTo: `${alt[0]} ${alt[1]}`.trim(),
        };
      });
      await tx.insert(s.machines).values(rows);
    }
    await tx.insert(s.lostTimeTypes).values(LOST_TIME.map(([name, group]) => ({ name, group })));
    await tx.insert(s.settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));

    const adminPin = process.env.ADMIN_PIN || "1234";
    await tx.insert(s.users).values({
      nik: process.env.ADMIN_NIK || "admin",
      name: "Anton Wahyudi",
      role: "admin",
      pinHash: bcrypt.hashSync(adminPin, 10),
    });

    if (!opts.demo) return;

    const pin = bcrypt.hashSync("1234", 10);
    const memberRows = await tx
      .insert(s.members)
      .values(DEMO_MEMBERS.map(([nik, name, area]) => ({ nik, name, area })))
      .returning();
    for (const m of memberRows) {
      await tx.insert(s.users).values({ nik: m.nik, name: m.name, role: "operator", area: m.area, pinHash: pin, memberId: m.id });
    }
    const [leader] = await tx
      .insert(s.users)
      .values({ nik: "L001", name: "Dian Kartika", role: "leader", area: "PF", pinHash: pin })
      .returning();
    await tx.insert(s.users).values({ nik: "M001", name: "Kepala Produksi", role: "manager", pinHash: pin });

    // Data contoh agar dashboard tidak kosong: 10 hari kerja terakhir untuk member PF.
    const allParts = await tx.select().from(s.parts);
    const allMachines = await tx.select().from(s.machines);
    const ltTypes = await tx.select().from(s.lostTimeTypes);
    const pfMembers = memberRows.filter((m) => m.area === "PF");
    const pfCats = ["PF Iron Cage", "PF Plastik", "Drum PF"].map((n) => catIds[n]);
    let rnd = 7;
    const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    const today = todayJakarta();
    let seq = 0;
    for (let d = 10; d >= 1; d--) {
      const workDate = addDays(today, -d);
      const dow = new Date(workDate + "T00:00:00Z").getUTCDay();
      if (dow === 0) continue;
      for (const [mi, m] of pfMembers.entries()) {
        const catId = pfCats[(mi + d) % pfCats.length];
        const catParts = allParts.filter((p) => p.categoryId === catId);
        const catMcs = allMachines.filter((x) => x.categoryId === catId);
        const part = catParts[Math.floor(rand() * catParts.length)];
        const mc = catMcs[Math.floor(rand() * catMcs.length)];
        const lostMin = [0, 15, 30, 45, 60][Math.floor(rand() * 5)];
        const minNormal = 480 - lostMin;
        const eff = 0.75 + rand() * 0.35;
        const qtyNormal = Math.round((part.stki * minNormal * eff) / 60);
        const withOt = rand() < 0.3;
        const minOt = withOt ? 120 : 0;
        const qtyOt = withOt ? Math.round((part.stki * minOt * eff) / 60) : 0;
        const id = newSubmissionId(new Date(Date.now() - d * 86400000 + seq++ * 1000));
        const ng = (p: number) => (rand() < p ? Math.floor(rand() * 12) : 0);
        await tx.insert(s.submissions).values({
          id,
          workDate,
          memberId: m.id,
          status: "approved",
          leaderId: leader.id,
          decidedAt: new Date(),
          submittedAt: new Date(workDate + "T09:00:00Z"),
        });
        await tx.insert(s.productionRows).values({
          submissionId: id,
          partId: part.id,
          machineId: mc?.id ?? null,
          qtyNormal,
          minNormal,
          qtyOt,
          minOt,
          lot: `L${workDate.slice(5).replace("-", "")}${(mi % 3) + 1}`,
          ng1: ng(0.2),
          ng2: ng(0.6),
          ng3: ng(0.4),
          ng5: ng(0.2),
          ng8: ng(0.15),
          stkiSnapshot: part.stki,
        });
        if (lostMin > 0) {
          const lt = ltTypes[Math.floor(rand() * ltTypes.length)];
          await tx.insert(s.lostTimeRows).values({ submissionId: id, lostTimeTypeId: lt.id, minutes: lostMin });
        }
      }
    }
  });
}
