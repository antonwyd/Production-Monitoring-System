// Data untuk halaman Perencanaan (Rencana Hari Ini) dan penyimpanan rencana ke tab "Rencana Harian".
// Tab "Rencana Harian" (dibuat otomatis saat pertama simpan), satu baris per segmen penugasan:
//   A Tanggal | B Status | C Nama | D Kategori | E Part | F MC | G Mulai | H Selesai | I Oleh | J Waktu | K Data
// Baris Nama "#RENCANA" menyimpan isi lengkap (JSON, kolom K) supaya rencana bisa dibuka lagi persis.
// Simpan ulang tanggal yang sama = baris lama dikosongkan, baris baru ditambahkan.
import "server-only";
import { addDays, nowJakarta } from "../dates";
import { compute, dayEnd, familyOf, mcKey, norm, spans, toClock, buildMaster, typeKey, type PlanState, type RawMaster, type PPerson } from "../planning";
import { fromPoCode, partKey } from "../overtime";
import { readForecast } from "./forecast";
import { add, emptyAgg, loadFacts } from "../reports";
import { loadMaster } from "../service";
import { apiMaster, bacaKehadiran, bacaCache, masterSettings, planMaster, sheetsIO, tandaiTidakMasukOleh, batalTidakMasukOleh } from "./qa";

export const SHEET_PLAN = "Rencana Harian";
const HEAD = ["Tanggal", "Status", "Nama", "Kategori", "Part", "MC", "Mulai", "Selesai", "Oleh", "Waktu", "Data"];
const META = "#RENCANA";
export type SavedInfo = { status: string; by: string; at: string };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const t = (v: unknown) => (s(v) === "" ? "" : `'${s(v)}`);
const dOf = (v: unknown) => (typeof v === "number" ? new Date(Math.round((v - 25569) * 86400) * 1000).toISOString().slice(0, 10) : s(v).slice(0, 10));
const isQa = (section: string) => !section || /\bqa\b/i.test(section);

/** Setting opsional Master Data: "Max MC per operator - <Kategori>", "Planning efficiency - <Kategori>" / "Planning efficiency". */
function settingFor(set: Record<string, unknown>, label: string, cat?: string): number | null {
  const keys = Object.keys(set);
  const k = (cat && keys.find((x) => x.toLowerCase() === `${label} - ${cat}`.toLowerCase())) || keys.find((x) => x.toLowerCase() === label.toLowerCase());
  if (!k || s(set[k]) === "") return null;
  const v = Number(String(set[k]).replace("%", "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function readSaved(date: string): Promise<{ state: PlanState; info: SavedInfo } | null> {
  const [g] = await bacaCache(`'${SHEET_PLAN}'!A2:K`);
  for (const r of g ?? []) {
    if (dOf(r[0]) !== date || s(r[2]) !== META) continue;
    try {
      return { state: JSON.parse(s(r[10])) as PlanState, info: { status: s(r[1]), by: s(r[8]), at: s(r[9]) } };
    } catch {
      return null;
    }
  }
  return null;
}

export type PlanPage = {
  raw: RawMaster;
  state: PlanState;
  /** Rencana awal (dari laporan hari kerja terakhir), untuk menampilkan perubahan. */
  initial: PlanState;
  saved: SavedInfo | null;
  /** Tanggal laporan yang dipakai sebagai dasar penugasan awal. */
  basis: string | null;
  /** Efisiensi & batas MC: asal angkanya. */
  source: Record<string, string>;
  /** PO kirim tanggal ini per produk (kunci produk), dari tab "PO Harian". */
  po?: Record<string, number>;
  /** Aktual (laporan sudah disetujui) tanggal ini per "Kategori|id part". */
  actual?: Record<string, number>;
};

export async function loadPlanPage(date: string): Promise<PlanPage> {
  const [am, pm, set, master, absen, saved] = await Promise.all([apiMaster(), planMaster(), masterSettings(), loadMaster(), bacaKehadiran(date), readSaved(date)]);
  const { facts: all } = await loadFacts(master, addDays(date, -30), date);
  const facts = all.filter((f) => f.workDate < date);
  const todayFacts = all.filter((f) => f.workDate === date);
  // PO kirim tanggal ini (kode customer "GDD627*D1  J" -> 627-J D1).
  const po: Record<string, number> = {};
  try {
    const { po: rows } = await readForecast();
    for (const r of rows) {
      if (r.tanggal !== date) continue;
      const p = fromPoCode(r.part);
      if (!p) continue;
      const key = `${/^GDD/i.test(r.part.trim()) ? "iron" : familyOf("plastik")}|${partKey(p.name)}|${typeKey(p.type)}`;
      po[key] = (po[key] ?? 0) + r.qty;
    }
  } catch {
    /* tab PO Harian belum ada: lewati */
  }

  const categories = am.categories.map((c) => ({ name: c.name, process: c.process }));
  const eff: Record<string, number> = {};
  const maxMc: Record<string, number> = {};
  const source: Record<string, string> = {};
  for (const c of categories) {
    const fs = facts.filter((f) => f.categoryName === c.name);
    const a = emptyAgg();
    fs.forEach((f) => add(a, f));
    const se = settingFor(set, "Planning efficiency", c.name);
    if (se) {
      eff[c.name] = se > 5 ? se / 100 : se;
      source[`eff|${c.name}`] = "Master Data";
    } else if (a.rated > 0 && a.std > 0) {
      eff[c.name] = a.std / a.rated;
      source[`eff|${c.name}`] = "achievement 30 hari";
    }
    const per = new Map<string, Set<string>>();
    for (const f of fs) if (f.mcNo !== "-") (per.get(`${f.workDate}|${f.memberName}`) ?? per.set(`${f.workDate}|${f.memberName}`, new Set()).get(`${f.workDate}|${f.memberName}`)!).add(f.mcNo);
    const sm = settingFor(set, "Max MC per operator", c.name);
    if (sm) {
      maxMc[c.name] = sm;
      source[`max|${c.name}`] = "Master Data";
    } else if (per.size) {
      maxMc[c.name] = Math.min(6, Math.max(...[...per.values()].map((x) => x.size)));
      source[`max|${c.name}`] = "terbanyak 30 hari";
    }
  }

  const members = am.members.filter((x) => isQa(x.section)).map((x) => ({ name: x.name, nik: x.nik }));
  const raw: RawMaster = {
    categories,
    parts: pm.parts,
    machines: am.machines.map((x) => ({ category: x.category, mc: x.mc, line: x.line, main: x.main, alt: x.alt })),
    members,
    normalMin: pm.normalMin,
    otLimitHrs: pm.otLimitHrs,
    maxMc,
    eff,
  };
  const m = buildMaster(raw);

  // Penugasan awal: hari kerja terakhir tiap member (30 hari), kategori dengan menit terbanyak.
  const partIn = (cat: string, label: string) => m.parts.find((p) => p.category === cat && norm(p.label) === norm(label))?.id ?? m.parts.find((p) => p.category === cat && norm(p.name) === norm(label))?.id;
  const lastOf = new Map<string, string>();
  for (const f of facts) if ((lastOf.get(f.memberName) ?? "") < f.workDate) lastOf.set(f.memberName, f.workDate);
  const basis = [...lastOf.values()].sort().pop() ?? null;
  const machines: Record<string, string> = {};
  const latestMc = new Map<string, string>();
  for (const f of [...facts].sort((a, b) => a.workDate.localeCompare(b.workDate))) if (f.mcNo !== "-") latestMc.set(mcKey(f.categoryName, f.mcNo), f.part);
  for (const mc of m.machines) {
    const k = mcKey(mc.category, mc.mc);
    const last = latestMc.get(k);
    machines[k] = (last && partIn(mc.category, last)) || mc.opts[0] || "";
  }
  const taken = new Set<string>();
  const order = [...members].sort((a, b) => (lastOf.get(b.name) ?? "").localeCompare(lastOf.get(a.name) ?? ""));
  const people: PPerson[] = order.map((mem) => {
    const day = lastOf.get(mem.name);
    if (!day) return { name: mem.name, segs: [] };
    const fs = facts.filter((f) => f.memberName === mem.name && f.workDate === day);
    const byCat = new Map<string, number>();
    fs.forEach((f) => byCat.set(f.categoryName, (byCat.get(f.categoryName) ?? 0) + f.minNormal + f.minOt + 1));
    const cat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const c = m.cats.find((x) => x.name === cat);
    if (!c) return { name: mem.name, segs: [] };
    if (c.mc) {
      const mcs = [...new Set(fs.filter((f) => f.categoryName === cat && f.mcNo !== "-").map((f) => f.mcNo))]
        .filter((x) => m.machines.some((y) => y.category === cat && y.mc === x) && !taken.has(mcKey(cat, x)))
        .sort()
        .slice(0, m.maxMc[cat] ?? 3);
      mcs.forEach((x) => taken.add(mcKey(cat, x)));
      return { name: mem.name, segs: mcs.length ? [{ at: 420, cat, mcs }] : [] };
    }
    const byPart = new Map<string, number>();
    fs.filter((f) => f.categoryName === cat).forEach((f) => byPart.set(f.part, (byPart.get(f.part) ?? 0) + f.minNormal + f.minOt + 1));
    const part = partIn(cat, [...byPart.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
    return { name: mem.name, segs: part ? [{ at: 420, cat, part }] : [] };
  });
  people.sort((a, b) => a.name.localeCompare(b.name));
  const initial: PlanState = { date, ot: 0, machines, targets: {}, people };

  let state: PlanState = saved?.state ?? structuredClone(initial);
  // Orang baru di Master Data ikut muncul (cadangan); yang sudah tidak aktif dibuang.
  const names = new Set(members.map((x) => x.name));
  state = { ...state, people: [...state.people.filter((p) => names.has(p.name)), ...members.filter((x) => !state.people.some((p) => p.name === x.name)).map((x) => ({ name: x.name, segs: [] }))] };
  // Tanda tidak masuk dari tab Kehadiran selalu ikut (bisa juga ditandai leader di halaman validasi).
  const abs = new Map(absen.map((a) => [a.member, a.alasan]));
  state.people = state.people.map((p) => (abs.has(p.name) ? { ...p, absent: abs.get(p.name) } : saved ? p : { ...p, absent: undefined }));
  for (const k of Object.keys(machines)) if (!(k in state.machines)) state.machines[k] = machines[k];
  // Belum ada rencana tersimpan: target = PO kirim hari ini (semua proses).
  if (!saved && !Object.keys(state.targets ?? {}).length) state.targets = Object.fromEntries(Object.entries(po).map(([k, q]) => [k, { pf: q, seiretsu: q, senbetsu: q }]));
  const actual: Record<string, number> = {};
  for (const f of todayFacts) {
    const id = partIn(f.categoryName, f.part);
    if (id) actual[`${f.categoryName}|${id}`] = (actual[`${f.categoryName}|${id}`] ?? 0) + f.qty;
  }

  return { raw, state, initial, saved: saved?.info ?? null, basis, source, po, actual };
}

async function ensureTab() {
  const io = sheetsIO();
  const counts = await io.rowCounts();
  if (!counts[SHEET_PLAN]) {
    if (!io.addTab) throw new Error(`Tab "${SHEET_PLAN}" belum ada di Google Sheet.`);
    await io.addTab(SHEET_PLAN);
    await io.update([{ range: `'${SHEET_PLAN}'!A1:K1`, values: [HEAD] }]);
  }
}

/** Simpan rencana (Draft / Dikonfirmasi). Konfirmasi juga menyamakan tab Kehadiran untuk tanggal itu. */
export async function savePlan(state: PlanState, status: "Draft" | "Dikonfirmasi", by: string) {
  const page = await loadPlanPage(state.date); // validasi nama/kategori terhadap Master Data terbaru
  const m = buildMaster(page.raw);
  const known = new Set(m.members.map((x) => x.name));
  const people = state.people.filter((p) => known.has(p.name));
  const clean: PlanState = { date: state.date, ot: Math.max(0, Math.min(m.otLimitMin, Math.round(state.ot || 0))), machines: state.machines ?? {}, targets: state.targets ?? {}, people };
  const json = JSON.stringify(clean);
  if (json.length > 45000) throw new Error("Rencana terlalu besar untuk disimpan.");

  await ensureTab();
  const io = sheetsIO();
  const [g] = await io.get([`'${SHEET_PLAN}'!A2:C`], "UNFORMATTED_VALUE");
  const old = (g ?? []).map((r, i) => ({ r, row: i + 2 })).filter((x) => dOf(x.r[0]) === state.date);
  if (old.length) await io.update(old.map((x) => ({ range: `'${SHEET_PLAN}'!A${x.row}:K${x.row}`, values: [Array(11).fill("")] })));

  const when = nowJakarta();
  const end = dayEnd(m, clean.ot);
  const rows: string[][] = [[t(state.date), status, META, "", "", "", "", "", by, when, t(json)]];
  const res = compute(m, clean, end);
  for (const p of people) {
    if (p.absent) {
      rows.push([t(state.date), status, t(p.name), "Tidak masuk", t(p.absent), "", "", "", by, when, ""]);
      continue;
    }
    const sp = spans(p, end).filter((x) => x.cat);
    if (!sp.length) rows.push([t(state.date), status, t(p.name), "Cadangan", "", "", "", "", by, when, ""]);
    for (const x of sp) {
      const part = x.part ? m.parts.find((q) => q.id === x.part)?.label : (x.mcs ?? []).map((id) => m.parts.find((q) => q.id === clean.machines[mcKey(x.cat, id)])?.label ?? "?").join(", ");
      rows.push([t(state.date), status, t(p.name), t(x.cat), t(part ?? ""), t((x.mcs ?? []).join(", ")), t(toClock(x.at)), t(toClock(x.to)), by, when, ""]);
    }
  }
  await io.append(`'${SHEET_PLAN}'!A:K`, rows);

  if (status === "Dikonfirmasi") {
    const absen = await bacaKehadiran(state.date);
    for (const p of people) {
      const ada = absen.find((a) => a.member === p.name);
      if (p.absent && (!ada || ada.alasan !== p.absent)) await tandaiTidakMasukOleh(by, state.date, p.name, p.absent, "Dari Rencana Hari Ini");
      if (!p.absent && ada) await batalTidakMasukOleh(state.date, p.name);
    }
  }
  return { ok: true, at: when, issues: res.issues.filter((i) => i.level === "error").length };
}
