import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const ROLES = ["operator", "leader", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const SUBMISSION_STATUS = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const LOST_TIME_GROUPS = ["LOST_TIME", "ANOTHER_JOB"] as const;
export type LostTimeGroup = (typeof LOST_TIME_GROUPS)[number];

export const ngGroups = pgTable("ng_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const ngCodes = pgTable(
  "ng_codes",
  {
    id: serial("id").primaryKey(),
    ngGroupId: integer("ng_group_id")
      .notNull()
      .references(() => ngGroups.id),
    code: integer("code").notNull(), // 1..10
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("ng_codes_group_code").on(t.ngGroupId, t.code)],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  process: text("process").notNull(),
  // Area produksi (mis. PF, Seiretsu, Senbetsu); dipakai untuk membatasi leader.
  area: text("area").notNull(),
  ngGroupId: integer("ng_group_id").references(() => ngGroups.id),
  active: boolean("active").notNull().default(true),
});

export const parts = pgTable(
  "parts",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    type: text("type").notNull().default(""),
    stki: doublePrecision("stki").notNull(), // standar pcs per jam
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("parts_cat_name_type").on(t.categoryId, t.name, t.type)],
);

export const machines = pgTable(
  "machines",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    mcNo: text("mc_no").notNull(),
    line: text("line").notNull().default(""),
    // Nama part utama, mis. "6902-J D1". Dicocokkan dengan nama part + type.
    mainPart: text("main_part").notNull().default(""),
    // Daftar part (dipisah koma) yang bisa dikerjakan setelah ganti type.
    canSwitchTo: text("can_switch_to").notNull().default(""),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("machines_cat_mc").on(t.categoryId, t.mcNo)],
);

export const lostTimeTypes = pgTable("lost_time_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  group: text("group").$type<LostTimeGroup>().notNull(),
  active: boolean("active").notNull().default(true),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull().unique(),
  name: text("name").notNull(),
  area: text("area").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").$type<Role>().notNull(),
  // Area yang dipegang leader. Kosong = semua area.
  area: text("area").notNull().default(""),
  pinHash: text("pin_hash").notNull(),
  memberId: integer("member_id").references(() => members.id),
  active: boolean("active").notNull().default(true),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(), // QA + yyMMddHHmmss + 2 digit acak
    workDate: date("work_date").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    submittedBy: integer("submitted_by").references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").$type<SubmissionStatus>().notNull().default("pending"),
    leaderId: integer("leader_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    leaderNote: text("leader_note"),
    needsCheck: boolean("needs_check").notNull().default(false),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("submissions_status").on(t.status),
    index("submissions_member_date").on(t.memberId, t.workDate),
  ],
);

export const productionRows = pgTable(
  "production_rows",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id),
    machineId: integer("machine_id").references(() => machines.id),
    qtyNormal: integer("qty_normal").notNull().default(0),
    minNormal: integer("min_normal").notNull().default(0),
    qtyOt: integer("qty_ot").notNull().default(0),
    minOt: integer("min_ot").notNull().default(0),
    lot: text("lot").notNull().default(""),
    oiban: text("oiban").notNull().default(""),
    ng1: integer("ng1").notNull().default(0),
    ng2: integer("ng2").notNull().default(0),
    ng3: integer("ng3").notNull().default(0),
    ng4: integer("ng4").notNull().default(0),
    ng5: integer("ng5").notNull().default(0),
    ng6: integer("ng6").notNull().default(0),
    ng7: integer("ng7").notNull().default(0),
    ng8: integer("ng8").notNull().default(0),
    ng9: integer("ng9").notNull().default(0),
    ng10: integer("ng10").notNull().default(0),
    // Snapshot STKI saat approve, agar perubahan master tidak mengubah report lama.
    stkiSnapshot: doublePrecision("stki_snapshot"),
  },
  (t) => [index("production_rows_submission").on(t.submissionId)],
);

export const lostTimeRows = pgTable(
  "lost_time_rows",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    lostTimeTypeId: integer("lost_time_type_id")
      .notNull()
      .references(() => lostTimeTypes.id),
    minutes: integer("minutes").notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [index("lost_time_rows_submission").on(t.submissionId)],
);

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const NG_KEYS = ["ng1", "ng2", "ng3", "ng4", "ng5", "ng6", "ng7", "ng8", "ng9", "ng10"] as const;
export type NgKey = (typeof NG_KEYS)[number];
