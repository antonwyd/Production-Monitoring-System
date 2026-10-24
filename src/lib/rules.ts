// Aturan bisnis R1–R16 dan rumus metrik. Dipakai di form (browser) dan di server,
// sehingga server selalu mengulang semua validasi form.
import type { MasterData, MasterMachine, MasterPart, PartRowInput, Settings, SubmissionInput } from "./types";

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  needsCheck: boolean;
  totals: { qty: number; minNormal: number; minOt: number; lostMin: number; remaining: number; ng: number };
};

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const filled = (v: number | null | undefined) => typeof v === "number" && Number.isFinite(v) && v > 0;

export function isBlankPartRow(r: PartRowInput) {
  return (
    r.categoryId == null &&
    r.partId == null &&
    !filled(r.qtyNormal) &&
    !filled(r.qtyOt) &&
    !filled(r.minNormal) &&
    !filled(r.minOt)
  );
}

export function computeTotals(input: SubmissionInput, normalMin = 480) {
  let qty = 0,
    minNormal = 0,
    minOt = 0,
    ng = 0;
  for (const p of input.parts) {
    qty += num(p.qtyNormal) + num(p.qtyOt);
    minNormal += num(p.minNormal);
    minOt += num(p.minOt);
    ng += p.ng.reduce<number>((a, b) => a + num(b), 0);
  }
  const lostMin = input.lostTimes.reduce((a, l) => a + num(l.minutes), 0);
  return { qty, minNormal, minOt, lostMin, ng, remaining: normalMin - minNormal - lostMin };
}

export function validateSubmission(
  input: SubmissionInput,
  master: MasterData,
  opts: { hasApprovedSameDay?: boolean } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { settings } = master;
  let needsCheck = false;

  // R1
  if (!input.workDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) errors.push("Tanggal wajib diisi.");
  if (input.memberId == null) errors.push("Nama member wajib dipilih.");
  else if (!master.members.some((m) => m.id === input.memberId)) errors.push("Member tidak aktif atau tidak ada di master.");

  // R2
  if (input.parts.length === 0 && input.lostTimes.length === 0) errors.push("Isi minimal satu part atau satu lost time.");

  input.parts.forEach((p, i) => {
    const label = `Part ${i + 1}`;
    for (const v of [p.qtyNormal, p.minNormal, p.qtyOt, p.minOt, ...p.ng]) {
      if (v != null && (!Number.isInteger(v) || v < 0)) {
        errors.push(`${label}: angka harus bilangan bulat ≥ 0.`);
        break;
      }
    }
    // R3
    const cat = master.categories.find((c) => c.id === p.categoryId);
    if (!cat) errors.push(`${label}: kategori wajib dipilih dari master.`);
    const part = master.parts.find((x) => x.id === p.partId);
    if (!part) errors.push(`${label}: part (dan type) wajib dipilih dari master.`);
    else if (cat && part.categoryId !== cat.id) errors.push(`${label}: part tidak termasuk kategori ${cat.name}.`);
    // R4
    if (cat) {
      const catHasMc = master.machines.some((m) => m.categoryId === cat.id);
      if (catHasMc && p.machineId == null) errors.push(`${label}: MC No wajib dipilih (pilih "-" bila tidak pakai mesin).`);
      if (typeof p.machineId === "number") {
        const mc = master.machines.find((m) => m.id === p.machineId);
        if (!mc || mc.categoryId !== cat.id) errors.push(`${label}: MC No tidak valid untuk kategori ini.`);
      }
    }
    // R5
    if (!filled(p.qtyNormal) && !filled(p.qtyOt)) errors.push(`${label}: isi qty normal atau qty OT.`);
    // R6
    if (filled(p.qtyNormal) && !filled(p.minNormal)) errors.push(`${label}: menit normal wajib bila qty normal diisi.`);
    if (filled(p.qtyOt) && !filled(p.minOt)) errors.push(`${label}: menit OT wajib bila qty OT diisi.`);
    // R15: qty per jam dibanding STKI
    if (part && part.stki > 0) {
      const mins = num(p.minNormal) + num(p.minOt);
      const qty = num(p.qtyNormal) + num(p.qtyOt);
      if (mins > 0 && qty > 0) {
        const pct = ((qty / mins) * 60 * 100) / part.stki;
        if (pct > settings.stkiHighPct || pct < settings.stkiLowPct)
          warnings.push(`${label}: qty tidak wajar (${Math.round(pct)}% dari STKI), cek qty dan menit.`);
      }
    }
  });

  // R7
  input.lostTimes.forEach((l, i) => {
    const label = `Lost time ${i + 1}`;
    if (!master.lostTimeTypes.some((t) => t.id === l.lostTimeTypeId)) errors.push(`${label}: jenis wajib dipilih dari master.`);
    if (!filled(l.minutes) || !Number.isInteger(l.minutes)) errors.push(`${label}: menit harus lebih dari 0.`);
  });

  const totals = computeTotals(input, settings.normalMin);
  const used = totals.minNormal + totals.lostMin;
  // R8
  if (used < settings.normalMin)
    errors.push(`Menit normal + lost time baru ${used} dari ${settings.normalMin}. Sisa ${settings.normalMin - used} menit, isi lost time.`);
  // R9
  if (used > settings.normalMin) {
    warnings.push(`Menit normal + lost time ${used}, lebih dari ${settings.normalMin}.`);
    needsCheck = true;
  }
  // R10
  if (totals.minOt > settings.otLimitHrs * 60) {
    warnings.push(`Jam OT ${(totals.minOt / 60).toFixed(1)}, lebih dari ${settings.otLimitHrs} jam.`);
    needsCheck = true;
  }
  // R16
  if (opts.hasApprovedSameDay) {
    warnings.push("Member ini sudah punya laporan Disetujui di tanggal yang sama (kemungkinan dobel).");
    needsCheck = true;
  }

  return { errors: [...new Set(errors)], warnings, needsCheck, totals };
}

// ---------- Pencocokan part dan mesin ----------

/** Abaikan huruf besar/kecil, akhiran "*KD", spasi, dan tanda baca. */
export function normalizePart(s: string): string {
  return s
    .toLowerCase()
    .replace(/\*\s*kd/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function partLabel(p: Pick<MasterPart, "name" | "type">) {
  return p.type ? `${p.name} ${p.type}` : p.name;
}

/** "MC 5" juga menemukan "MC 05". */
export function normalizeMc(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(^|\D)0+(\d)/g, "$1$2");
}

export function groupMachines(machines: MasterMachine[], part: MasterPart | undefined) {
  if (!part) return { main: [] as MasterMachine[], switchable: [] as MasterMachine[], other: machines };
  const key = normalizePart(partLabel(part));
  const keyNoType = normalizePart(part.name);
  const matches = (s: string) => {
    const n = normalizePart(s);
    return n === key || (!part.type && n === keyNoType);
  };
  const main: MasterMachine[] = [];
  const switchable: MasterMachine[] = [];
  const other: MasterMachine[] = [];
  for (const m of machines) {
    if (matches(m.mainPart)) main.push(m);
    else if (m.canSwitchTo.split(",").some((x) => x.trim() && matches(x))) switchable.push(m);
    else other.push(m);
  }
  return { main, switchable, other };
}

// ---------- Metrik ----------

export function achievement(stdHours: number, ratedHours: number): number | null {
  return ratedHours > 0 ? stdHours / ratedHours : null;
}

export function grade(ach: number | null, s: Settings): string {
  if (ach == null) return "-";
  const pct = ach * 100;
  if (pct >= s.gradeA) return "A";
  if (pct >= s.gradeB) return "B";
  if (pct >= s.gradeC) return "C";
  return "D";
}

export function ngRate(totalNg: number, totalQty: number): number | null {
  return totalQty + totalNg > 0 ? totalNg / (totalQty + totalNg) : null;
}

export function settingsFromRows(rows: { key: string; value: string }[]): Settings {
  const m = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  const v = (k: string, d: number) => (Number.isFinite(m[k]) ? m[k] : d);
  return {
    normalMin: v("normal_min", 480),
    otLimitHrs: v("ot_limit_hrs", 4),
    target: v("target", 100),
    gradeA: v("grade_a", 100),
    gradeB: v("grade_b", 90),
    gradeC: v("grade_c", 80),
    stkiHighPct: v("stki_high_pct", 150),
    stkiLowPct: v("stki_low_pct", 30),
    ngPpmMax: v("ng_ppm_max", 1000),
    utilTarget: v("util_target", 85),
    mcHrsDay: v("mc_hrs_day", 8),
  };
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "-" : `${(v * 100).toFixed(digits).replace(".", ",")}%`;

export const fmt = (v: number | null | undefined, digits = 0) =>
  v == null ? "-" : v.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits });
