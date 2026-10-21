// Definisi tabel master untuk halaman admin (dipakai browser dan server).

export type FieldType = "text" | "number" | "bool" | "select" | "pin";
export type OptionSource = "categories" | "ngGroups" | "members" | "roles" | "ltGroups";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: OptionSource;
  hint?: string;
};

export type MasterDef = { key: string; title: string; description: string; fields: Field[]; idKey?: string };

export const MASTER_DEFS: MasterDef[] = [
  {
    key: "members",
    title: "Member",
    description: "Inactive = hilang dari picker form, data lama tetap ada.",
    fields: [
      { key: "nik", label: "NIK", type: "text", required: true },
      { key: "name", label: "Nama", type: "text", required: true },
      { key: "area", label: "Area", type: "text", hint: "mis. PF, Seiretsu, Senbetsu" },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "users",
    title: "User & peran",
    description: "Akun login (NIK + PIN). Leader hanya melihat member di areanya; area kosong = semua.",
    fields: [
      { key: "nik", label: "NIK / user", type: "text", required: true },
      { key: "name", label: "Nama", type: "text", required: true },
      { key: "role", label: "Peran", type: "select", options: "roles", required: true },
      { key: "area", label: "Area", type: "text" },
      { key: "memberId", label: "Member (operator)", type: "select", options: "members" },
      { key: "pin", label: "PIN baru", type: "pin", hint: "Kosongkan bila tidak diganti" },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "categories",
    title: "Kategori proses",
    description: "NG group menentukan label NG1–NG10 di form.",
    fields: [
      { key: "name", label: "Kategori", type: "text", required: true },
      { key: "process", label: "Proses", type: "text", required: true },
      { key: "area", label: "Area", type: "text", required: true },
      { key: "ngGroupId", label: "NG Group", type: "select", options: "ngGroups" },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "parts",
    title: "Part & STKI",
    description: "STKI = standar pcs per jam, dasar hitung efisiensi. Unik per kategori + part + type.",
    fields: [
      { key: "categoryId", label: "Kategori", type: "select", options: "categories", required: true },
      { key: "name", label: "Part", type: "text", required: true },
      { key: "type", label: "Type", type: "text" },
      { key: "stki", label: "STKI (pcs/jam)", type: "number", required: true },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "machines",
    title: "Mesin (MC)",
    description: '"Bisa ganti ke" boleh berisi banyak part dipisah koma.',
    fields: [
      { key: "categoryId", label: "Kategori", type: "select", options: "categories", required: true },
      { key: "mcNo", label: "MC No", type: "text", required: true },
      { key: "line", label: "Line", type: "text" },
      { key: "mainPart", label: "Part utama", type: "text", hint: "mis. 6902-J D1" },
      { key: "canSwitchTo", label: "Bisa ganti ke", type: "text" },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "lost-time-types",
    title: "Jenis lost time",
    description: "Grup menentukan pemisahan Lost Time dan Another Job di Dashboard.",
    fields: [
      { key: "name", label: "Jenis", type: "text", required: true },
      { key: "group", label: "Grup", type: "select", options: "ltGroups", required: true },
      { key: "active", label: "Aktif", type: "bool" },
    ],
  },
  {
    key: "ng-codes",
    title: "Kode NG",
    description: "Tiap NG group punya 10 nama NG sendiri.",
    fields: [
      { key: "ngGroupId", label: "NG Group", type: "select", options: "ngGroups", required: true },
      { key: "code", label: "Kode (1–10)", type: "number", required: true },
      { key: "name", label: "Nama NG", type: "text", required: true },
    ],
  },
  {
    key: "ng-groups",
    title: "NG group",
    description: "Kelompok nama NG, dipasang ke kategori.",
    fields: [{ key: "name", label: "Nama", type: "text", required: true }],
  },
  {
    key: "settings",
    title: "Setting",
    description: "Berlaku untuk semua. Grade dalam persen achievement.",
    idKey: "key",
    fields: [
      { key: "key", label: "Parameter", type: "text", required: true },
      { key: "value", label: "Nilai", type: "text", required: true },
    ],
  },
];

export const SETTING_LABELS: Record<string, string> = {
  normal_min: "Waktu kerja normal per hari (menit)",
  ot_limit_hrs: "Batas OT per member per hari (jam)",
  target: "Target achievement (%)",
  grade_a: "Grade A (≥ %)",
  grade_b: "Grade B (≥ %)",
  grade_c: "Grade C (≥ %)",
  stki_high_pct: "Peringatan qty di atas (% STKI)",
  stki_low_pct: "Peringatan qty di bawah (% STKI)",
};
