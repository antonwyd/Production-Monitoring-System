// v6.2: karakter member yang naik level, dan tips harian (NG / K3) di atas form.
// Level dihitung ulang setiap kali dari data (Antrian Validasi + Input - Production), tidak disimpan,
// jadi bisa naik dan bisa TURUN bila kualitas 30 hari terakhir jatuh di bawah syarat levelnya.

export type Karakter = { id: string; emoji: string; nama: string };

/** Pilihan karakter. Kebanyakan member wanita, jadi yang imut & wanita di depan. */
export const KARAKTER: Karakter[] = [
  { id: "hijab", emoji: "🧕", nama: "Mbak Hijab" },
  { id: "putri", emoji: "👸", nama: "Putri" },
  { id: "peri", emoji: "🧚‍♀️", nama: "Peri" },
  { id: "pekerja-w", emoji: "👩‍🏭", nama: "Mbak QA" },
  { id: "unicorn", emoji: "🦄", nama: "Unicorn" },
  { id: "kelinci", emoji: "🐰", nama: "Kelinci" },
  { id: "kucing", emoji: "🐱", nama: "Kucing" },
  { id: "hamster", emoji: "🐹", nama: "Hamster" },
  { id: "panda", emoji: "🐼", nama: "Panda" },
  { id: "koala", emoji: "🐨", nama: "Koala" },
  { id: "kupu", emoji: "🦋", nama: "Kupu-kupu" },
  { id: "anakayam", emoji: "🐥", nama: "Anak Ayam" },
  { id: "beruang", emoji: "🧸", nama: "Teddy" },
  { id: "rubah", emoji: "🦊", nama: "Rubah" },
  { id: "pekerja-l", emoji: "👨‍🏭", nama: "Mas QA" },
  { id: "macan", emoji: "🐯", nama: "Macan" },
  { id: "singa", emoji: "🦁", nama: "Singa" },
  { id: "elang", emoji: "🦅", nama: "Elang" },
  { id: "robot", emoji: "🤖", nama: "Robot" },
  { id: "ninja", emoji: "🥷", nama: "Ninja" },
];

export function karakterDari(id: string, gender: "L" | "P" | ""): Karakter & { dipilih: boolean } {
  const k = KARAKTER.find((x) => x.id === id.trim());
  if (k) return { ...k, dipilih: true };
  const def = KARAKTER.find((x) => x.id === (gender === "L" ? "macan" : "kelinci"))!;
  return { ...def, dipilih: false };
}

export type Level = { lv: number; nama: string; poin: number; ach: number; tanpaTolak?: boolean };

/** Syarat tiap level: poin terkumpul + achievement rata-rata 30 hari terakhir (NG rate tidak dipakai, keputusan Anton 4 Nov). */
export const LEVELS: Level[] = [
  { lv: 1, nama: "Pemula", poin: 0, ach: 0 },
  { lv: 2, nama: "Semangat", poin: 50, ach: 0.8 },
  { lv: 3, nama: "Si Rajin", poin: 150, ach: 0.85 },
  { lv: 4, nama: "Andalan", poin: 300, ach: 0.9 },
  { lv: 5, nama: "Juara QA", poin: 500, ach: 0.95, tanpaTolak: true },
];

/** Satu hari kerja seorang member. ach/ng dari baris Input - Production yang sudah disetujui. */
export type HariMember = {
  date: string;
  disetujui: boolean;
  /** Waktu kirim (Jakarta, "yyyy-MM-dd HH:mm[:ss]") kiriman pertama yang disetujui di tanggal ini; "" bila belum ada. */
  kirim: string;
  /** Menit lembur orang di hari itu (part manual OT + waktu operator OT di mesin + lost time OT). */
  otMin: number;
  /** Sabtu/Minggu: semua kerja dihitung OT. */
  libur: boolean;
  ditolak: boolean; // ada kiriman yang ditolak di tanggal ini
  diedit: boolean; // kiriman disetujui setelah diedit leader
  std: number; // jam standar (qty / standar)
  rated: number; // jam kerja (atau jam mesin untuk baris MC)
  qty: number;
  ng: number;
};

export const ACH_HARIAN = 0.9;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Batas kirim (menit sejak 00:00) = jam kerja selesai + 30 menit (aturan Anton 4 Nov 2026).
 * Hari biasa: kerja selesai 16:00, lembur langsung menyambung (lembur 1 jam selesai 17:00, 2,5 jam selesai 18:30).
 * Hari libur: 8 jam pertama dianggap seperti hari biasa (selesai 16:00), sisanya menyambung.
 */
export function batasKirim(h: Pick<HariMember, "otMin" | "libur">): number {
  const ot = Math.max(0, Math.round(h.otMin || 0));
  return 16 * 60 + 30 + (h.libur ? Math.max(0, ot - 480) : ot);
}

/**
 * Poin waktu kirim, dari jam kirim kiriman pertama yang disetujui:
 * paling lambat 30 menit setelah jam kerja selesai = +2, lewat dari itu (atau besoknya) = -1.
 */
export function poinKirim(h: Pick<HariMember, "date" | "kirim" | "otMin" | "libur">): { poin: number; label: string } {
  if (!h.kirim) return { poin: 0, label: "" };
  const hari = h.kirim.slice(0, 10),
    jam = h.kirim.slice(11, 16);
  const batas = batasKirim(h);
  const telat = { poin: -1, label: `Kirim terlambat (${hari === h.date ? jam : "besoknya"}, batas ${hhmm(batas)})` };
  if (hari < h.date) return { poin: 2, label: "Kirim tepat waktu" }; // diisi lebih awal (jarang)
  if (hari > h.date) return telat;
  const m = Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5));
  return m <= batas ? { poin: 2, label: `Kirim ≤ ${hhmm(batas)} (${jam})` } : telat;
}

export function poinHari(h: HariMember) {
  if (!h.disetujui) return { total: 0, rincian: [] as string[] };
  const r: string[] = ["Disetujui +2"];
  let total = 2;
  const k = poinKirim(h);
  if (k.label) r.push(`${k.label} ${k.poin > 0 ? "+" : ""}${k.poin}`);
  total += k.poin;
  const plus = (ok: boolean, label: string) => {
    if (ok) (r.push(`${label} +2`), (total += 2));
  };
  // Langsung disetujui +2; pernah ditolak atau diedit leader -1.
  if (h.ditolak || h.diedit) (r.push(`${h.ditolak ? "Pernah ditolak" : "Diedit leader"} -1`), (total -= 1));
  else plus(true, "Tanpa revisi");
  plus(h.rated > 0 && h.std / h.rated >= ACH_HARIAN, "Achievement ≥ 90%");
  return { total, rincian: r };
}

export type HasilLevel = {
  level: Level;
  poin: number;
  next: Level | null;
  /** 0..1 menuju level berikutnya (poin saja). */
  progress: number;
  ach30: number | null;
  ng30: number | null;
  tolak30: number;
  /** Syarat kualitas yang belum terpenuhi untuk level berikutnya, kalimat pendek. */
  kurang: string[];
  /** Level yang seharusnya didapat dari poin saja (untuk info "tertahan kualitas"). */
  lvPoin: number;
  hari: number;
  hariIni: { total: number; rincian: string[] } | null;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function hitungLevel(days: HariMember[], today: string): HasilLevel {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  let poin = 0;
  for (const h of sorted) poin += poinHari(h).total;
  poin = Math.max(0, poin);
  const batas = geserTanggal(today, -29);
  const last = sorted.filter((h) => h.date >= batas && h.date <= today);
  const std = last.reduce((a, h) => a + h.std, 0),
    rated = last.reduce((a, h) => a + h.rated, 0),
    qty = last.reduce((a, h) => a + h.qty, 0),
    ng = last.reduce((a, h) => a + h.ng, 0);
  const ach30 = rated > 0 ? std / rated : null;
  const ng30 = qty + ng > 0 ? ng / (qty + ng) : null;
  const tolak30 = last.filter((h) => h.ditolak).length;
  const lolos = (L: Level) =>
    L.lv === 1 || (ach30 != null && ach30 >= L.ach && (!L.tanpaTolak || tolak30 === 0));
  let level = LEVELS[0];
  for (const L of LEVELS) if (poin >= L.poin && lolos(L)) level = L;
  const lvPoin = [...LEVELS].reverse().find((L) => poin >= L.poin)!.lv;
  const next = LEVELS.find((L) => L.lv === level.lv + 1) ?? null;
  const kurang: string[] = [];
  if (next) {
    if (poin < next.poin) kurang.push(`${next.poin - poin} poin lagi`);
    if (ach30 == null || ach30 < next.ach) kurang.push(`Achievement 30 hari ${ach30 == null ? "-" : pct(ach30)} (perlu ${pct(next.ach)})`);
    if (next.tanpaTolak && tolak30 > 0) kurang.push(`Tidak boleh ada laporan ditolak 30 hari (ada ${tolak30})`);
  }
  const span = next ? next.poin - level.poin : 1;
  const progress = next ? Math.max(0, Math.min(1, (poin - level.poin) / span)) : 1;
  const h0 = sorted.find((h) => h.date === today);
  return {
    level,
    poin,
    next,
    progress,
    ach30,
    ng30,
    tolak30,
    kurang,
    lvPoin,
    hari: sorted.filter((h) => h.disetujui).length,
    hariIni: h0 ? poinHari(h0) : null,
  };
}

export function geserTanggal(date: string, days: number) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

// ---------- Tips harian ----------

export const TIPS_NG = [
  "Cek 5 pcs pertama setiap ganti lot atau setting. NG ketahuan di awal = tidak menumpuk.",
  "Bandingkan part dengan sampel OK (limit sample) bila ragu. Jangan menebak.",
  "Pisahkan part NG langsung ke box merah, jangan ditaruh di meja kerja.",
  "Bersihkan meja dan alat dari geram/serpihan sebelum mulai. Kotoran = baret & dent.",
  "Pegang part di sisi luar, jangan sampai jatuh atau terbentur. Satu benturan bisa jadi dent.",
  "Cek alat ukur (kalibrasi & nol) sebelum dipakai. Alat salah = keputusan salah.",
  "Jika NG yang sama muncul 3x berturut-turut, stop dan lapor leader. Jangan diteruskan.",
  "Catat jenis NG dengan benar di form. Data NG yang tepat membantu cari akar masalah.",
  "Susun part di box dengan rapi dan beri sekat. Part yang bertumpuk mudah tergores.",
  "Pastikan pencahayaan cukup saat inspeksi visual. Cacat kecil sering lolos di tempat redup.",
  "Jangan campur lot dalam satu box. Lot tercampur menyulitkan telusur bila ada keluhan.",
  "Istirahatkan mata sebentar tiap 1 jam inspeksi. Mata lelah = NG lolos.",
  "Setelah ganti tool atau dies, cek ukuran part pertama sebelum produksi jalan.",
  "Bila ragu OK atau NG, tanya leader. Lebih baik bertanya daripada part NG terkirim ke customer.",
  "Ikuti urutan cek di WI (instruksi kerja). Melompati langkah adalah awal dari NG.",
];

export const TIPS_K3 = [
  "Matikan mesin dan pasang tanda sebelum membersihkan atau mengambil part yang tersangkut.",
  "Selalu pakai APD sesuai area: sarung tangan, kacamata, sepatu safety, dan earplug.",
  "Jangan memakai perhiasan, gelang, atau baju longgar di dekat mesin berputar.",
  "Rambut panjang diikat dan dimasukkan ke dalam topi atau jilbab agar tidak tertarik mesin.",
  "Lantai basah atau berminyak? Segera bersihkan atau beri tanda agar tidak terpeleset.",
  "Angkat box berat dengan menekuk lutut, punggung tetap lurus. Minta bantuan jika terlalu berat.",
  "Jangan mematikan atau melewati sensor dan pengaman mesin, walau untuk sebentar.",
  "Ketahui lokasi APAR, kotak P3K, dan jalur evakuasi di area kerja kamu.",
  "Laporkan kondisi tidak aman (kabel terkelupas, pengaman rusak) ke leader hari itu juga.",
  "Jalan di jalur pejalan kaki dan waspada forklift di area gudang.",
  "Simpan pisau, cutter, dan alat tajam di tempatnya setelah dipakai.",
  "Minum air yang cukup dan istirahat sesuai jadwal. Badan lelah mudah celaka.",
  "Jangan bercanda atau main HP di dekat mesin yang sedang jalan.",
  "Tekan tombol emergency stop bila ada bahaya, lalu panggil leader.",
  "Jaga area kerja tetap 5S: rapi, bersih, tidak ada barang di jalan lewat.",
];

/**
 * Tips hari itu, berganti setiap hari. DIMATIKAN dulu (4 Nov 2026): Anton akan menyiapkan isi tips kualitas sendiri.
 * Untuk menyalakan: TIPS_AKTIF = true (dan TIPS_K3_AKTIF untuk selang-seling dengan K3).
 */
export const TIPS_AKTIF = false;
export const TIPS_K3_AKTIF = false;
export function tipHari(date: string): { jenis: "NG" | "K3"; teks: string } | null {
  if (!TIPS_AKTIF) return null;
  const n = Math.floor(Date.parse(`${date}T00:00:00Z`) / 864e5);
  if (!TIPS_K3_AKTIF) return { jenis: "NG", teks: TIPS_NG[n % TIPS_NG.length] };
  const half = Math.floor(n / 2);
  return n % 2 === 0 ? { jenis: "NG", teks: TIPS_NG[half % TIPS_NG.length] } : { jenis: "K3", teks: TIPS_K3[half % TIPS_K3.length] };
}
