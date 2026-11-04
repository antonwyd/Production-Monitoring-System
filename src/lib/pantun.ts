// Pesan penyemangat di layar "Laporan terkirim" (permintaan Anton, 4 Nov 2026).
// Perempuan (Users kolom G = P): satu pantun acak, tetap sama untuk orang & tanggal yang sama.
// Laki-laki (L): pengingat sholat. Kosong: tidak ada pesan.

export const PANTUN: string[] = [
  "Pagi hari membeli jamu,\nPulangnya mampir membeli roti.\nTetap semangat menjalani harimu,\nSenyummu indah, menenangkan hati.",
  "Bunga mawar tumbuh di taman,\nDisiram hujan setiap pagi.\nTetaplah kuat dalam perjalanan,\nKamu lebih hebat dari yang kamu sadari.",
  "Jalan-jalan ke tepi kali,\nMelihat bunga sedang merekah.\nTetap tersenyum setiap hari,\nSebab senyummu begitu indah.",
  "Burung berkicau di atas dahan,\nAngin berembus membawa berita.\nJangan menyerah pada keadaan,\nKamu punya kekuatan yang luar biasa.",
  "Pergi ke pasar membeli mangga,\nTidak lupa membeli pepaya.\nTetaplah menjadi wanita berharga,\nCantik paras dan baik hatinya.",
  "Langit cerah di pagi hari,\nBurung terbang melintasi awan.\nJangan lelah memperbaiki diri,\nKeindahanmu bukan sekadar penampilan.",
  "Bunga melati di dekat jendela,\nHarumnya sampai ke ruang tamu.\nSemoga bahagia selalu menyertaimu,\nKarena dunia terasa indah melihat senyummu.",
  "Pergi berlibur ke kota Medan,\nPulang membawa kain sutra.\nTetap semangat mengejar impian,\nJangan pernah lupa betapa berharganya dirimu.",
  "Air mengalir menuju lautan,\nIkan berenang di antara batu.\nJangan takut menghadapi tantangan,\nKamu lebih kuat dari yang kamu tahu.",
  "Bunga kenanga tumbuh berjajar,\nWarnanya indah terkena cahaya.\nTeruslah bermimpi dan terus belajar,\nSebab masa depanmu masih luar biasa.",
  "Pagi-pagi membeli sarapan,\nSecangkir kopi teman cerita.\nSemoga harimu penuh kebahagiaan,\nSebab kamu pantas mendapatkannya.",
  "Indah senja di tepi pantai,\nOmbak berlari menyentuh kaki.\nTetaplah jadi pribadi yang baik,\nSebab itulah cantik yang paling berarti.",
  "Bunga di taman tumbuh bersemi,\nKupu-kupu datang menghampiri.\nJangan pernah berhenti bermimpi,\nSenyummu pantas menghiasi hari.",
  "Matahari terbit di ufuk timur,\nCahayanya hangat menyinari bumi.\nKalau hari ini terasa berat dan mundur,\nIngat, kamu tetap hebat di mata diri sendiri.",
  "Pergi ke toko membeli pita,\nPita berwarna merah delima.\nKecantikanmu terlihat nyata,\nNamun kebaikanmu jauh lebih istimewa.",
  "Bulan bersinar di malam hari,\nBintang menemani dengan cahayanya.\nJangan terlalu keras pada diri sendiri,\nKamu sudah hebat dengan caramu.",
  "Jalan setapak menuju permai,\nDi kanan kiri tumbuh melati.\nSemoga langkahmu selalu damai,\nDan bahagiamu tak pernah berhenti.",
  "Hujan reda muncul pelangi,\nWarnanya indah menghiasi langit.\nTetaplah tersenyum setiap hari,\nKarena pesonamu memang sulit ditandingi.",
  "Pergi ke taman melihat bunga,\nBunga bermekaran indah warnanya.\nTak perlu menjadi orang lain untuk istimewa,\nJadilah dirimu, itu sudah luar biasa.",
  "Burung merpati terbang berdua,\nHinggap sebentar di pohon jati.\nTetap semangat menjalani dunia,\nCantik wajahmu, indah pula hati.",
];

export const PESAN_LAKI = "Woeey jangan lupa sholat woeey 🙏";

/** Nomor pantun untuk orang + tanggal: tetap selama hari itu, berganti tiap hari, beda antar orang. */
export function pilihPantun(key: string, date: string): string {
  let h = 2166136261;
  for (const ch of `${key}|${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return PANTUN[(h >>> 0) % PANTUN.length];
}

/** L/P dari isi kolom Jenis Kelamin (L, P, Laki-laki, Perempuan, Pria, Wanita, M, F). */
export function jenisKelamin(v: string): "L" | "P" | "" {
  const t = v.trim().toLowerCase();
  if (/^(l|laki|laki-laki|pria|m|male|cowok)$/.test(t)) return "L";
  if (/^(p|perempuan|wanita|f|female|cewek)$/.test(t)) return "P";
  return "";
}

export function pesanKirim(gender: "L" | "P" | "", key: string, date: string): string {
  if (gender === "L") return PESAN_LAKI;
  if (gender === "P") return pilihPantun(key, date);
  return "";
}
