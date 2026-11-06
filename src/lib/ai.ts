// "Tanya AI": asisten tanya-jawab di dashboard. Claude menjawab HANYA dari data laporan produksi aplikasi ini,
// diambil lewat tool di bawah (dihitung di server dari Sheet yang sama dengan report lain).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { addDays, todayJakarta } from "./dates";
import { ALL, buildForecastReport } from "./forecast";
import { add, bahanOf, emptyAgg, loadFacts, ngLabeler, type Agg, type Fact } from "./reports";
import { achievement } from "./rules";
import { loadMaster } from "./service";
import { readForecast } from "./sheets/forecast";
import type { MasterData } from "./types";

/** Model default; bisa diganti lewat env AI_MODEL tanpa ubah kode (mis. claude-haiku-5-5 untuk hemat). */
export const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type ChatTurn = { role: "user" | "assistant"; content: string };

const MAX_DAYS = 400;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Tanggal YYYY-MM-DD");
const r1 = (v: number) => Math.round(v * 10) / 10;
const pct = (v: number | null) => (v == null ? null : r1(v * 100));
const has = (hay: string, needle?: string) => !needle || hay.toLowerCase().includes(needle.toLowerCase().trim());

function checkRange(from: string, to: string) {
  if (from > to) throw new Error("from harus <= to");
  if (addDays(from, MAX_DAYS) < to) throw new Error(`Rentang maksimal ${MAX_DAYS} hari`);
}

const filterSchema = {
  kategori: z.string().optional().describe("Filter nama kategori (sebagian nama cukup), mis. 'PF Iron Cage'"),
  proses: z.string().optional().describe("Filter proses, mis. 'Seiretsu', 'Senbetsu', 'Bowl PF', 'Drum PF'"),
  member: z.string().optional().describe("Filter nama member/operator (sebagian nama cukup)"),
  part: z.string().optional().describe("Filter nama part/type (sebagian cukup), mis. '627' atau 'GDD627'"),
  mesin: z.string().optional().describe("Filter MC No, mis. 'MC 06'"),
};
type Filters = { kategori?: string; proses?: string; member?: string; part?: string; mesin?: string };

async function facts(master: MasterData, from: string, to: string, f: Filters) {
  checkRange(from, to);
  const { facts, lost } = await loadFacts(master, from, to);
  const procOf = new Map(master.categories.map((c) => [c.id, c.process]));
  const ok = (x: Fact) =>
    has(x.categoryName, f.kategori) &&
    has(procOf.get(x.categoryId) ?? "", f.proses) &&
    has(x.memberName, f.member) &&
    has(x.part, f.part) &&
    (!f.mesin || x.mcNo.replace(/\s/g, "").toLowerCase() === f.mesin.replace(/\s/g, "").toLowerCase());
  return { facts: facts.filter(ok), lost, procOf };
}

function aggOut<T extends object>(a: Agg, extra: T) {
  return {
    ...extra,
    qty_ok: a.qty,
    ng: a.ng,
    ng_rate_pct: a.qty + a.ng > 0 ? Math.round((a.ng / (a.qty + a.ng)) * 1e5) / 1e3 : null,
    achievement_pct: pct(achievement(a.std, a.rated)),
    jam_normal: r1(a.minNormal / 60),
    jam_ot: r1(a.minOt / 60),
    baris: a.count,
  };
}

const GROUPS = ["total", "tanggal", "member", "kategori", "proses", "part", "mesin", "lot", "bahan"] as const;

export function makeTools(master: MasterData) {
  const produksi = betaZodTool({
    name: "data_produksi",
    description:
      "Ringkasan produksi dari laporan yang SUDAH DISETUJUI leader: qty OK, NG, NG rate %, achievement % (vs standar STKI/Std MC), jam normal & OT. " +
      "Bisa dikelompokkan per tanggal/member/kategori/proses/part/mesin/lot/bahan dan difilter. Pakai ini untuk pertanyaan qty, rata-rata, ranking, produktivitas.",
    inputSchema: z.object({
      from: date,
      to: date,
      group_by: z.enum(GROUPS).describe("Pengelompokan baris hasil"),
      ...filterSchema,
      sort: z.enum(["qty", "ng", "ng_rate", "achievement", "key"]).optional().describe("Urutan (default qty terbesar; key = urut nama/tanggal)"),
      limit: z.number().int().min(1).max(100).optional().describe("Jumlah baris maksimal (default 40)"),
    }),
    run: async (inp) => {
      const { facts: fs, procOf } = await facts(master, inp.from, inp.to, inp);
      const keyOf: Record<(typeof GROUPS)[number], (f: Fact) => string> = {
        total: () => "Total",
        tanggal: (f) => f.workDate,
        member: (f) => f.memberName,
        kategori: (f) => f.categoryName,
        proses: (f) => procOf.get(f.categoryId) || f.categoryName,
        part: (f) => f.part,
        mesin: (f) => (f.mcNo === "-" ? "(tanpa mesin)" : `${f.categoryName} ${f.mcNo}`),
        lot: (f) => f.lot,
        bahan: (f) => bahanOf(f) ?? "(lain)",
      };
      const map = new Map<string, { a: Agg; days: Set<string>; members: Set<string> }>();
      for (const f of fs) {
        const k = keyOf[inp.group_by](f);
        const e = map.get(k) ?? { a: emptyAgg(), days: new Set(), members: new Set() };
        add(e.a, f);
        e.days.add(f.workDate);
        e.members.add(f.memberName);
        map.set(k, e);
      }
      let rows = [...map.entries()].map(([k, e]) =>
        aggOut(e.a, { kelompok: k, hari_kerja: e.days.size, jumlah_member: e.members.size, qty_per_hari: Math.round(e.a.qty / Math.max(1, e.days.size)) }),
      );
      const s = inp.sort ?? (inp.group_by === "tanggal" ? "key" : "qty");
      const val = (r: (typeof rows)[number]) => (s === "qty" ? r.qty_ok : s === "ng" ? r.ng : s === "ng_rate" ? r.ng_rate_pct ?? -1 : s === "achievement" ? r.achievement_pct ?? -1 : 0);
      rows = s === "key" ? rows.sort((a, b) => a.kelompok.localeCompare(b.kelompok)) : rows.sort((a, b) => val(b) - val(a));
      const limit = inp.limit ?? 40;
      return JSON.stringify({ periode: `${inp.from} s/d ${inp.to}`, dikelompokkan_per: inp.group_by, total_kelompok: rows.length, rows: rows.slice(0, limit), dipotong: rows.length > limit });
    },
  });

  const ngJenis = betaZodTool({
    name: "data_ng_per_jenis",
    description: "Rincian NG per jenis NG (nama jenis sesuai grup NG kategori), opsional per part atau per member. Untuk pertanyaan 'NG apa yang paling banyak'.",
    inputSchema: z.object({
      from: date,
      to: date,
      ...filterSchema,
      per: z.enum(["jenis", "part", "member", "kategori"]).optional().describe("jenis = total per jenis NG; part/member/kategori = jenis NG dipecah per itu"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (inp) => {
      const { facts: fs } = await facts(master, inp.from, inp.to, inp);
      const label = ngLabeler(master.ngGroups);
      const per = inp.per ?? "jenis";
      const map = new Map<string, number>();
      let qty = 0;
      for (const f of fs) {
        qty += f.qty;
        f.ng.forEach((v, i) => {
          if (!v) return;
          const name = label(f.ngGroupId, i) || `NG${i + 1}`;
          const k = per === "jenis" ? name : `${per === "part" ? f.part : per === "member" ? f.memberName : f.categoryName} | ${name}`;
          map.set(k, (map.get(k) ?? 0) + v);
        });
      }
      const total = [...map.values()].reduce((a, b) => a + b, 0);
      const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ [per === "jenis" ? "jenis_ng" : `${per} | jenis_ng`]: k, ng: v, porsi_pct: total ? r1((v / total) * 100) : 0 }));
      const limit = inp.limit ?? 30;
      return JSON.stringify({ periode: `${inp.from} s/d ${inp.to}`, total_ng: total, total_qty_ok: qty, rows: rows.slice(0, limit), dipotong: rows.length > limit });
    },
  });

  const lostTime = betaZodTool({
    name: "data_lost_time",
    description: "Lost time & Another Job (menit) dari laporan yang disetujui, dikelompokkan per jenis/member/tanggal/grup. Grup LOST_TIME = waktu hilang, ANOTHER_JOB = pekerjaan lain.",
    inputSchema: z.object({
      from: date,
      to: date,
      group_by: z.enum(["jenis", "member", "tanggal", "grup"]),
      member: z.string().optional(),
      jenis: z.string().optional().describe("Filter nama jenis lost time (sebagian cukup)"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (inp) => {
      checkRange(inp.from, inp.to);
      const { lost } = await loadFacts(master, inp.from, inp.to);
      const map = new Map<string, { menit: number; ot: number; kali: number }>();
      for (const l of lost) {
        if (!has(l.memberName, inp.member) || !has(l.name, inp.jenis)) continue;
        const k = inp.group_by === "jenis" ? `${l.name} (${l.group})` : inp.group_by === "member" ? l.memberName : inp.group_by === "tanggal" ? l.workDate : l.group;
        const e = map.get(k) ?? { menit: 0, ot: 0, kali: 0 };
        e.menit += l.minutes;
        if (l.ot) e.ot += l.minutes;
        e.kali++;
        map.set(k, e);
      }
      const rows = [...map.entries()]
        .map(([k, e]) => ({ [inp.group_by]: k, menit: Math.round(e.menit), menit_saat_ot: Math.round(e.ot), jumlah_entri: e.kali }))
        .sort((a, b) => (inp.group_by === "tanggal" ? String(a.tanggal).localeCompare(String(b.tanggal)) : b.menit - a.menit));
      const limit = inp.limit ?? 40;
      return JSON.stringify({ periode: `${inp.from} s/d ${inp.to}`, rows: rows.slice(0, limit), dipotong: rows.length > limit });
    },
  });

  const forecast = betaZodTool({
    name: "data_forecast_po",
    description: "Forecast customer vs actual PO per bulan (PO dicatat per tanggal kirim). Berisi KPI s/d tanggal batas, per customer, per part, dan per hari.",
    inputSchema: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).describe("Bulan YYYY-MM"),
      customer: z.string().optional().describe("Nama customer; kosong = semua"),
      part: z.string().optional().describe("Part tertentu; kosong = semua"),
    }),
    run: async (inp) => {
      const { fc, po } = await readForecast();
      const r = buildForecastReport(fc, po, { month: inp.month, customer: inp.customer || ALL, part: inp.part, today: todayJakarta() });
      return JSON.stringify({
        bulan: r.month,
        customer: r.customer,
        customers: r.customers,
        batas_perbandingan: r.upto,
        kpi: r.kpi,
        per_customer: r.perCustomer,
        per_part: r.parts.slice(0, 60),
        per_hari: r.days,
        bulan_tersedia: r.months,
      });
    },
  });

  const masterTool = betaZodTool({
    name: "data_master",
    description: "Daftar kategori (dengan proses), member aktif (dengan section), mesin per kategori, jenis lost time, dan setting target (achievement, batas NG). Pakai untuk mencocokkan nama sebelum memfilter.",
    inputSchema: z.object({ bagian: z.enum(["kategori", "member", "mesin", "lost_time", "setting", "part"]) }),
    run: async ({ bagian }) => {
      const cat = new Map(master.categories.map((c) => [c.id, c.name]));
      const out =
        bagian === "kategori"
          ? master.categories.map((c) => ({ kategori: c.name, proses: c.process }))
          : bagian === "member"
            ? master.members.map((m) => ({ nama: m.name, section: m.area || "QA" }))
            : bagian === "mesin"
              ? master.machines.map((m) => ({ kategori: cat.get(m.categoryId), mc: m.mcNo, line: m.line, part_utama: m.mainPart }))
              : bagian === "lost_time"
                ? master.lostTimeTypes.map((t) => ({ jenis: t.name, grup: t.group }))
                : bagian === "part"
                  ? master.parts.map((p) => ({ kategori: cat.get(p.categoryId), part: p.name, type: p.type, stki_pcs_per_jam: p.stki }))
                  : {
                      menit_normal_per_hari: master.settings.normalMin,
                      target_achievement_pct: master.settings.target,
                      batas_ng_pct: master.settings.ngPpmMax / 1e4,
                      grade_A_B_C_pct: [master.settings.gradeA, master.settings.gradeB, master.settings.gradeC],
                      target_utilisasi_mesin_pct: master.settings.utilTarget,
                    };
      return JSON.stringify(out);
    },
  });

  return [produksi, ngJenis, lostTime, forecast, masterTool];
}

function systemPrompt(today: string) {
  return `Kamu adalah "Asisten Laporan Produksi QA" di aplikasi web PT Takai Seiki Indonesia. Pengguna adalah leader, manajemen, atau admin produksi.

Tugasmu: menjawab pertanyaan tentang laporan produksi QA (qty, NG, achievement/produktivitas, jam kerja & lembur, lost time, mesin, member, forecast vs PO customer) berdasarkan data dari tool. Hari ini ${today} (WIB). Laporan hari ini biasanya baru masuk sore, jadi bila pengguna tidak menyebut tanggal untuk "hari ini", sebutkan bila datanya belum lengkap.

Aturan:
- Ambil angka HANYA dari tool. Jangan menebak atau mengarang angka. Bila data tidak ada, katakan terus terang.
- Bila nama kategori/member/part ambigu, cek dulu dengan data_master atau pakai filter sebagian nama.
- Data produksi hanya berisi laporan yang sudah disetujui leader. Sabtu/Minggu = hari libur (semua jam = OT).
- Achievement = jam standar (qty ÷ STKI atau Std MC) ÷ jam kerja; NG rate = NG ÷ (OK + NG).
- Pertanyaan di luar laporan produksi dan pekerjaan pabrik (mis. politik, hiburan, PR sekolah, coding): tolak dengan sopan dalam satu kalimat dan tawarkan contoh pertanyaan seputar laporan produksi.
- Jawab dalam Bahasa Indonesia yang santai tapi sopan, singkat dan langsung ke inti. Gunakan format angka Indonesia (1.234.567; 12,5%). Sebutkan periode data yang dipakai. Boleh pakai tabel markdown kecil atau poin-poin bila membantu, maksimal ±15 baris. Beri insight singkat bila berguna (mis. siapa tertinggi/terendah, tren naik/turun).`;
}

/** Jalankan satu pertanyaan (dengan riwayat percakapan singkat). Mengembalikan teks jawaban. */
export async function askAi(history: ChatTurn[], user: { name: string; role: string }): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = new Anthropic();
  const master = await loadMaster();
  const today = todayJakarta();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  const runner = client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 8000,
    max_iterations: 8,
    system: [
      { type: "text", text: systemPrompt(today), cache_control: { type: "ephemeral" } },
      { type: "text", text: `Pengguna yang bertanya: ${user.name} (${user.role}).` },
    ],
    messages,
    tools: makeTools(master),
    output_config: { effort: "low" },
    // Bila model menolak karena filter keamanan, server otomatis mencoba model cadangan yang sesuai.
    ...(AI_MODEL.startsWith("claude-haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });
  let input = 0;
  let output = 0;
  let last: Anthropic.Beta.BetaMessage | null = null;
  for await (const msg of runner) {
    last = msg;
    input += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
    output += msg.usage.output_tokens;
  }
  if (!last) throw new Error("Tidak ada jawaban.");
  if (last.stop_reason === "refusal") return { text: "Maaf, pertanyaan ini tidak bisa saya jawab. Coba tanyakan seputar laporan produksi.", usage: { input, output } };
  const text = last.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text: text || "Maaf, belum ada jawaban. Coba ulangi pertanyaannya dengan lebih spesifik.", usage: { input, output } };
}
