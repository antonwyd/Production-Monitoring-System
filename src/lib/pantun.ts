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
  // v6.5: 100 pantun tambahan (4 Nov 2026)
  "Beli kain di Pasar Baru,\nKainnya halus berwarna biru.\nKerja teliti setiap waktu,\nHasil terbaik datang padamu.",
  "Pohon kelapa tinggi menjulang,\nDaunnya hijau di tepi pantai.\nKerja kerasmu takkan terbuang,\nBahagia esok pasti kau capai.",
  "Makan rujak di siang hari,\nRasanya manis, pedas, dan segar.\nJangan lupa tersenyum hari ini,\nSenyummu membuat tim makin tegar.",
  "Ke pasar pagi membeli sayur,\nSayur bayam segar warnanya.\nWalau lelah jangan mundur,\nKamu kuat, kamu luar biasa.",
  "Kupu-kupu hinggap di bunga,\nBunga mawar merah merekah.\nKerjamu teliti penuh makna,\nSetiap langkahmu membawa berkah.",
  "Naik sepeda ke kota Bandung,\nMampir sebentar membeli tahu.\nJangan biarkan semangat murung,\nHari ini milikmu, ayo maju!",
  "Buah durian dari Medan,\nDibelah dua harum baunya.\nKerjakan dengan penuh perhatian,\nHasil terbaik pasti datangnya.",
  "Bunga teratai di dalam kolam,\nDaunnya lebar hijau berseri.\nWalau lelah dari pagi sampai malam,\nKamu tetap bersinar hari ini.",
  "Pergi ke Bogor naik kereta,\nTurun di stasiun membeli roti.\nSetiap part yang kau periksa,\nBukti kerjamu sepenuh hati.",
  "Pagi cerah burung bernyanyi,\nEmbun menetes di ujung daun.\nTetap semangat jalani hari,\nBahagiamu tumbuh dari tahun ke tahun.",
  "Membuat kue di dapur ibu,\nAdonan diaduk penuh cinta.\nTerima kasih atas kerjamu,\nKamu bagian penting tim kita.",
  "Pohon mangga berbuah lebat,\nBuahnya manis sampai ke hati.\nKamu wanita yang kuat dan hebat,\nTerus melangkah jangan berhenti.",
  "Pergi ke Solo membeli batik,\nBatik tulis bermotif bunga.\nKerja teliti itu cantik,\nHasilnya bikin hati bangga.",
  "Bulan purnama bersinar terang,\nBintang berkelip di langit biru.\nLelah hari ini akan hilang,\nBerganti bahagia untuk dirimu.",
  "Ikan mas di dalam kolam,\nBerenang tenang di sela batu.\nDari pagi hingga malam,\nSemangatmu tak pernah layu.",
  "Beli bunga di toko sebelah,\nBunga lili harum mewangi.\nKalau hari ini terasa lelah,\nIstirahat sejenak, lalu semangat lagi.",
  "Minum teh di sore hari,\nDitemani pisang goreng hangat.\nTerus belajar setiap hari,\nKamu pasti makin hebat.",
  "Jalan-jalan ke Pulau Bali,\nMelihat tari di pinggir pantai.\nKerja teliti sepenuh hati,\nKualitas terbaik pasti tercapai.",
  "Hujan turun rintik-rintik,\nPayung biru dibuka lebar.\nKamu manis, kamu cantik,\nApalagi kalau kerja dengan sabar.",
  "Bunga matahari menghadap timur,\nKelopaknya kuning menyala.\nJangan biarkan semangat luntur,\nKamu hebat di mana saja.",
  "Daun pandan harum baunya,\nDibuat kue untuk lebaran.\nSenyummu manis luar biasa,\nBikin kerja jadi menyenangkan.",
  "Kapal berlayar di lautan biru,\nMembawa muatan ke seberang.\nTerima kasih atas kerja kerasmu,\nHari ini kamu sudah menang.",
  "Pagi-pagi menanam padi,\nSore hari menyiram bunga.\nKerja jujur sepenuh hati,\nRezeki datang tak terduga.",
  "Anak kucing bermain benang,\nBenang merah tergulung rapi.\nKerjamu hari ini bikin senang,\nTeruslah begitu setiap hari.",
  "Ke Cianjur membeli beras,\nBeras pulen putih warnanya.\nKamu wanita yang kuat dan cerdas,\nTim bangga punya kamu di dalamnya.",
  "Sinar mentari menembus jendela,\nHangatnya sampai ke dalam kalbu.\nSemoga harimu penuh bahagia,\nSeperti hangatnya senyummu.",
  "Burung kenari bernyanyi merdu,\nHinggap di dahan pohon cemara.\nTetap semangat wahai sahabatku,\nKamu cahaya bagi kita semua.",
  "Kebun teh di Puncak sana,\nHijau terhampar sejuk dipandang.\nKerja rapi, kerja sempurna,\nHasilnya membuat hati senang.",
  "Beli gula di warung Bu Ani,\nGula merah untuk kolak.\nSatu senyum di pagi ini,\nBikin semangat terus bergerak.",
  "Pelangi muncul sehabis hujan,\nTujuh warna indah sekali.\nSetiap usaha ada balasan,\nPercayalah pada dirimu sendiri.",
  "Pergi ke sawah melihat padi,\nPadi menguning siap dipanen.\nKerjamu teliti setiap hari,\nBikin kualitas makin keren.",
  "Bunga anggrek di pot tanah,\nWarnanya ungu sangat menawan.\nJangan pernah merasa kalah,\nKamu kuat menghadapi tantangan.",
  "Pergi ke pantai mencari kerang,\nKerang putih di atas pasir.\nHari ini kerja dengan riang,\nBesok bahagia terus mengalir.",
  "Minum jus alpukat segar,\nDiberi susu cokelat manis.\nKamu wanita yang tegar,\nSemangatmu tak pernah habis.",
  "Daun kelor daun salam,\nDipetik ibu di kebun belakang.\nKerja teliti siang dan malam,\nHasilnya membuat semua senang.",
  "Pagi berkabut di kaki gunung,\nUdara sejuk menyegarkan jiwa.\nJangan biarkan hatimu murung,\nSenyummu membawa bahagia.",
  "Merpati putih terbang tinggi,\nMelintas di atas atap rumah.\nSemoga harimu penuh rezeki,\nDan langkahmu penuh berkah.",
  "Pergi ke pasar hari Minggu,\nMembeli jeruk manis rasanya.\nKamu hebat, percaya selalu,\nUsahamu pasti ada hasilnya.",
  "Bunga sakura bermekaran,\nWarnanya merah muda menawan.\nKerja teliti penuh kesabaran,\nHasilnya pasti membanggakan.",
  "Lauknya tempe dan telur dadar,\nDimakan pagi sebelum bekerja.\nSemangatmu bikin hati segar,\nTerima kasih sudah berusaha.",
  "Ke Lembang memetik stroberi,\nStroberi merah manis rasanya.\nJadilah versi terbaik diri,\nHari ini, esok, dan selamanya.",
  "Angin sepoi di tepi danau,\nPerahu kecil berlayar pelan.\nKerjamu hari ini sungguh memukau,\nTerima kasih atas ketelitian.",
  "Kain songket dari Palembang,\nBenang emas berkilau indah.\nKerja ikhlas hati pun lapang,\nSetiap langkah jadi berkah.",
  "Burung pipit di atas pagar,\nMencari makan di pagi hari.\nWalau sulit tetaplah tegar,\nKamu mampu, percaya diri.",
  "Pergi ke kebun memetik jambu,\nJambu air merah merona.\nTerima kasih atas kerjamu,\nKamu bintang di tim kita.",
  "Kopi hangat di pagi hari,\nAromanya harum memenuhi ruang.\nSemangat baru setiap hari,\nBersama tim yang penuh sayang.",
  "Bunga mawar di dalam vas,\nDiletakkan di atas meja.\nKerja teliti, kerja ikhlas,\nItulah kunci dari segalanya.",
  "Ombak berdebur di pantai Anyer,\nAnak-anak bermain pasir.\nJangan biarkan semangatmu buyar,\nBahagia untukmu terus mengalir.",
  "Langit senja jingga merona,\nBurung pulang ke sarangnya.\nKerja hari ini sudah sempurna,\nWaktunya istirahat dan bahagia.",
  "Pohon beringin rindang daunnya,\nTempat berteduh di siang hari.\nKamu kuat, kamu berharga,\nJangan lupa sayangi diri sendiri.",
  "Belimbing wuluh asam rasanya,\nDibuat sambal teman makan.\nSenyummu manis luar biasa,\nBikin lelah jadi terlupakan.",
  "Bunga kamboja putih bersih,\nJatuh pelan di halaman.\nTerima kasih, terima kasih,\nUntuk kerja dan kesungguhan.",
  "Ke Yogya naik kereta senja,\nSampai pagi di Stasiun Tugu.\nTerus semangat dalam bekerja,\nBahagia pasti datang padamu.",
  "Bayam hijau kangkung segar,\nDimasak tumis untuk makan siang.\nSetiap hari terus belajar,\nMasa depanmu pasti cemerlang.",
  "Kunang-kunang di malam sunyi,\nCahayanya kecil tapi indah.\nWalau kecil usaha hari ini,\nLama-lama jadi berkah.",
  "Beli payung warna merah,\nUntuk dipakai saat hujan.\nKalau salah jangan menyerah,\nPerbaiki dan terus berjalan.",
  "Tanam melati di halaman,\nHarumnya sampai ke jalan.\nKamu wanita yang menawan,\nKerjamu rapi penuh perhatian.",
  "Ikan lele di dalam empang,\nDiberi makan pagi dan sore.\nHati gembira kerja pun senang,\nHasil kerja tanpa eror.",
  "Mentari pagi bersinar cerah,\nEmbun bening di atas rumput.\nJangan pernah merasa lelah,\nSemangatmu jangan sampai surut.",
  "Burung bangau di tengah sawah,\nMencari ikan di air jernih.\nKerja keras jangan menyerah,\nHasil manis pasti kau raih.",
  "Kue lapis berwarna-warni,\nDisajikan di atas meja.\nSemangat kerja hari ini,\nSenyummu cerahkan semua.",
  "Bunga dahlia warna jingga,\nTumbuh subur di pot tanah liat.\nKamu bunga di tim kita,\nCantik, teliti, dan semangat.",
  "Hujan deras di sore hari,\nAnak-anak bermain air.\nJangan lupa bersyukur hari ini,\nNikmat Tuhan terus mengalir.",
  "Burung camar terbang rendah,\nDi atas laut biru membentang.\nKerja teliti hasilnya indah,\nCustomer puas, hati pun senang.",
  "Pergi ke toko membeli benang,\nBenang wol berwarna ungu.\nKalau hati sedang tak tenang,\nIngat ada tim yang mendukungmu.",
  "Pagi-pagi menyapu halaman,\nDaun kering dikumpulkan.\nTerima kasih teman seperjuangan,\nKerjamu hari ini membanggakan.",
  "Rumah makan di pinggir jalan,\nMenjual sate dan es kelapa.\nSetiap usaha butuh kesabaran,\nHasil terbaik pasti tiba.",
  "Bunga tulip dari Belanda,\nWarnanya merah, kuning, dan ungu.\nKamu hebat dalam segala,\nTerus berkarya setiap waktu.",
  "Anak bebek berbaris rapi,\nBerjalan pelan menuju kolam.\nKerja rapi sepenuh hati,\nHasilnya terang bagai purnama malam.",
  "Pergi ke pasar membeli kelapa,\nKelapa muda segar airnya.\nTeliti kerja jangan lupa,\nCek ulang dulu baru selesai semua.",
  "Bulan sabit di ujung langit,\nBintang kecil berkelip terang.\nWalau hari ini terasa sulit,\nEsok pasti lebih senang.",
  "Air terjun jatuh berderai,\nSejuk segar di kaki bukit.\nKerjamu hari ini selesai,\nWaktunya senyum walau sedikit.",
  "Mangga muda rasanya masam,\nDicocol garam dan cabai.\nKerja teliti tak kenal diam,\nTarget hari ini pasti tercapai.",
  "Kembang sepatu merah menyala,\nTumbuh di pagar depan rumah.\nTerus semangat setiap kala,\nKamu kuat, jangan menyerah.",
  "Pergi ke kebun memetik cabai,\nCabai merah pedas rasanya.\nKerja dengan hati yang damai,\nLelah pun terasa bahagia.",
  "Lilin menyala di dalam kamar,\nCahayanya kecil menerangi gelap.\nKamu wanita yang sabar,\nSemoga bahagiamu selalu lengkap.",
  "Petik daun sirih di halaman,\nDaun sirih hijau dan segar.\nTerima kasih atas kesungguhan,\nKerjamu teliti, hatimu sabar.",
  "Naik perahu di Sungai Musi,\nMelihat jembatan Ampera.\nTerus semangat dan berprestasi,\nKamu kebanggaan kita semua.",
  "Bunga kertas di depan pintu,\nWarnanya ungu sangat cantik.\nKerja tulus setiap waktu,\nHasilnya pasti yang terbaik.",
  "Burung hantu di malam hari,\nMatanya bulat tajam melihat.\nTeliti seperti burung ini,\nTak ada NG yang terlewat.",
  "Pergi ke Garut membeli dodol,\nDodol manis legit rasanya.\nKalau capek jangan dongkol,\nSenyum dulu, beres semua.",
  "Pisang goreng hangat-hangat,\nDimakan bersama secangkir teh.\nTerima kasih untuk semangat,\nKerjamu hari ini juara deh!",
  "Pohon cemara di pinggir jalan,\nBerdiri tegak diterpa angin.\nTetap tegak hadapi tantangan,\nTetap tenang dan tetap yakin.",
  "Beli batik di Pekalongan,\nMotifnya indah penuh warna.\nTerima kasih atas ketelitian,\nKerjamu hari ini sempurna.",
  "Bunga lavender ungu muda,\nHarumnya bikin hati tenang.\nKamu berharga, kamu istimewa,\nJangan lupa, tetaplah riang.",
  "Pagi buta ayam berkokok,\nMatahari mulai menyapa.\nKerja teliti hasilnya cocok,\nCustomer senang, kita bahagia.",
  "Ke Malang memetik apel,\nApel merah manis dan segar.\nKerja rapi jangan asal,\nCek dulu baru keluar.",
  "Anak rusa di tengah hutan,\nBerlari riang mencari ibunya.\nJalani hari dengan senyuman,\nPasti terasa lebih mudah semuanya.",
  "Gerimis turun di sore hari,\nJalanan basah licin sekali.\nHati-hati di jalan nanti,\nSampai rumah dengan selamat lagi.",
  "Pergi ke pasar membeli kain,\nKain sutra halus sekali.\nTerima kasih untuk hari ini,\nBesok kita semangat lagi.",
  "Pohon pisang berbuah satu,\nBuahnya matang kuning warnanya.\nJangan pernah ragu pada dirimu,\nKamu mampu, kamu bisa.",
  "Bunga seroja di tepi kali,\nMekar indah di pagi hari.\nSenyummu manis berseri-seri,\nBikin semangat tim kami.",
  "Laut tenang ombak pun reda,\nNelayan pulang membawa ikan.\nKerja keras tak akan sia-sia,\nTuhan pasti memberi jalan.",
  "Pagi-pagi minum susu,\nSusu sapi segar dan murni.\nTerima kasih atas kerjamu,\nKamu luar biasa hari ini.",
  "Bunga mawar bunga melati,\nDirangkai indah dalam keranjang.\nKerja tekun sepenuh hati,\nHasilnya pasti gemilang.",
  "Jalan ke pasar melewati jembatan,\nDi bawahnya sungai mengalir jernih.\nSetiap hari adalah kesempatan,\nMimpi besar pasti kau raih.",
  "Kelinci putih melompat-lompat,\nMencari wortel di kebun sayur.\nKerja teliti, kerja tepat,\nHasilnya bagus, hati pun bersyukur.",
  "Embun pagi di daun talas,\nBerkilau indah terkena cahaya.\nKerja ikhlas, kerja tuntas,\nItulah tanda wanita perkasa.",
  "Pergi ke toko membeli sisir,\nSisir kayu ukiran Jepara.\nHari ini sudah berakhir,\nTerima kasih, sampai jumpa.",
  "Bintang jatuh di langit malam,\nCepat-cepat membuat harapan.\nSemoga harimu selalu tenteram,\nDan impianmu jadi kenyataan.",
];

export const PESAN_LAKI = "Woeey jangan lupa sholat woeey 🙏";

/** Pantun untuk orang + tanggal: tetap selama hari itu, berganti tiap hari, beda antar orang.
 *  Bergiliran (hari ke-n + geser per orang), jadi satu orang tidak dapat pantun yang sama
 *  sebelum semua pantun keluar (120 hari). */
export function pilihPantun(key: string, date: string): string {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const [y, m, d] = date.split("-").map(Number);
  const hari = Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
  const n = PANTUN.length;
  return PANTUN[(((hari + (h >>> 0)) % n) + n) % n];
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
