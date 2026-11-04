// v6.5: quote penyemangat harian di atas form member. Berganti tiap hari dan beda per orang.
export const QUOTES = [
  "Kerja teliti hari ini, bangga dengan hasilnya nanti.",
  "Kualitas bukan kebetulan, tapi kebiasaan yang dilakukan setiap hari.",
  "Satu part yang dicek dengan benar lebih berharga dari seratus yang dilewatkan.",
  "Lelahmu hari ini adalah bukti kamu sedang berjuang. Tetap semangat!",
  "Hasil terbaik datang dari orang yang tidak cepat puas.",
  "Mulai dengan senyum, kerjakan dengan teliti, akhiri dengan syukur.",
  "Tidak ada pekerjaan kecil kalau dikerjakan dengan hati.",
  "Kesalahan kecil yang dicegah hari ini menyelamatkan masalah besar besok.",
  "Jadilah alasan tim ini bangga.",
  "Disiplin hari ini, prestasi esok hari.",
  "Fokus pada proses, hasil akan mengikuti.",
  "Teliti itu keren. Customer senang, kita pun tenang.",
  "Setiap hari adalah kesempatan untuk jadi sedikit lebih baik dari kemarin.",
  "Kerja keras tidak akan mengkhianati hasil.",
  "Semangat pagi! Kamu adalah bagian penting dari kualitas Takai.",
  "Bukan seberapa cepat, tapi seberapa benar.",
  "Jangan takut lambat, takutlah kalau diam di tempat.",
  "Hari ini mungkin berat, tapi kamu lebih kuat.",
  "Kebiasaan baik yang kecil, jika konsisten, hasilnya luar biasa.",
  "Kualitas dimulai dari diri sendiri.",
  "Senyum dulu, baru kerja. Energi positif menular!",
  "Terima kasih sudah bekerja dengan jujur dan teliti hari ini.",
  "Orang hebat bukan yang tidak pernah salah, tapi yang mau belajar dari kesalahan.",
  "Tim yang kompak lahir dari orang-orang yang saling peduli.",
  "Kerja ikhlas, hasil pantas.",
  "Satu langkah kecil setiap hari tetap membawa kita jauh.",
  "Lakukan yang terbaik, biar Tuhan yang menyempurnakan.",
  "Semangatmu hari ini menentukan ceritamu esok hari.",
  "Jangan bandingkan dirimu dengan orang lain, bandingkan dengan dirimu kemarin.",
  "Rapi, bersih, teliti: tiga kunci kerja yang bikin hati tenang.",
];

/** Quote hari itu untuk satu orang: tetap selama sehari, berganti tiap hari, beda antar orang. */
export function quoteHari(key: string, date: string): string {
  let h = 2166136261;
  for (const ch of `q|${key}|${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return QUOTES[(h >>> 0) % QUOTES.length];
}
