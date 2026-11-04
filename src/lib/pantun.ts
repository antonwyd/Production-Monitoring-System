// Pesan penyemangat di layar "Laporan terkirim" (permintaan Anton, 4 Nov 2026).
// v6.5 (Anton, 4 Nov 2026): tema per hari kerja, Sabtu/Minggu tidak ada pesan.
//   Senin pantun kehidupan, Selasa pantun penyemangat, Rabu pantun jenaka,
//   Kamis peribahasa + artinya, Jumat tebak-tebakan lucu.
// P dan L sama-sama dapat; L memakai pantun yang netral (tanpa wanita/cantik/menawan)
// dan tetap dapat pengingat sholat. Jenis kelamin kosong: tidak ada pesan.

export const PANTUN: string[] = [
  // v6.5 (4 Nov 2026): 100 pantun kata mutiara hidup, menggantikan 20 pantun v6.1
  "Beli kain di Pasar Baru,\nKainnya halus berwarna biru.\nSyukuri apa yang ada di tanganmu,\nBahagia datang tanpa kau tunggu.",
  "Pohon kelapa tinggi menjulang,\nDaunnya hijau di tepi pantai.\nUsaha yang tulus takkan terbuang,\nBahagia esok pasti kau capai.",
  "Makan rujak di siang hari,\nRasanya manis, pedas, dan segar.\nHidup tak selalu sesuai mimpi,\nNamun hati yang kuat tetap tegar.",
  "Ke pasar pagi membeli sayur,\nSayur bayam segar warnanya.\nWalau lelah jangan mundur,\nKamu kuat, kamu luar biasa.",
  "Kupu-kupu hinggap di bunga,\nBunga mawar merah merekah.\nHidup sederhana penuh makna,\nHati yang bersyukur selalu berkah.",
  "Naik sepeda ke kota Bandung,\nMampir sebentar membeli tahu.\nJangan biarkan hatimu murung,\nHari ini milikmu, ayo maju!",
  "Buah durian dari Medan,\nDibelah dua harum baunya.\nSabar itu memang tak mudah dijalankan,\nTapi manis sekali buahnya.",
  "Bunga teratai di dalam kolam,\nDaunnya lebar hijau berseri.\nSeberat apa pun hari yang kelam,\nSelalu ada pagi yang berseri.",
  "Pergi ke Bogor naik kereta,\nTurun di stasiun membeli roti.\nBahagia bukan soal harta,\nTapi tentang tenangnya hati.",
  "Pagi cerah burung bernyanyi,\nEmbun menetes di ujung daun.\nTetap semangat jalani hari,\nBahagiamu tumbuh dari tahun ke tahun.",
  "Membuat kue di dapur ibu,\nAdonan diaduk penuh cinta.\nDoa ibu selalu menyertaimu,\nJangan lupa membalas dengan cinta.",
  "Pohon mangga berbuah lebat,\nBuahnya manis sampai ke hati.\nKamu wanita yang kuat dan hebat,\nTerus melangkah jangan berhenti.",
  "Pergi ke Solo membeli batik,\nBatik tulis bermotif bunga.\nHati yang baik itulah yang cantik,\nLebih berharga dari permata.",
  "Bulan purnama bersinar terang,\nBintang berkelip di langit biru.\nLelah hari ini akan hilang,\nBerganti bahagia untuk dirimu.",
  "Ikan mas di dalam kolam,\nBerenang tenang di sela batu.\nHidup seperti siang dan malam,\nSetelah gelap, terang pun tentu.",
  "Beli bunga di toko sebelah,\nBunga lili harum mewangi.\nKalau hari ini terasa lelah,\nIstirahat sejenak, lalu semangat lagi.",
  "Minum teh di sore hari,\nDitemani pisang goreng hangat.\nTerus belajar setiap hari,\nKamu pasti makin hebat.",
  "Jalan-jalan ke Pulau Bali,\nMelihat tari di pinggir pantai.\nJalani hidup sepenuh hati,\nImpian indah pasti tercapai.",
  "Hujan turun rintik-rintik,\nPayung biru dibuka lebar.\nKamu manis, kamu cantik,\nApalagi kalau hatimu sabar.",
  "Bunga matahari menghadap timur,\nKelopaknya kuning menyala.\nJangan biarkan semangat luntur,\nKamu hebat di mana saja.",
  "Daun pandan harum baunya,\nDibuat kue untuk lebaran.\nSenyummu manis luar biasa,\nBikin hidup jadi menyenangkan.",
  "Kapal berlayar di lautan biru,\nMembawa muatan ke seberang.\nJangan bandingkan dirimu,\nSetiap orang punya waktunya untuk menang.",
  "Pagi-pagi menanam padi,\nSore hari menyiram bunga.\nBerbuat baik sepenuh hati,\nRezeki datang tak terduga.",
  "Anak kucing bermain benang,\nBenang merah tergulung rapi.\nHati yang ikhlas selalu tenang,\nWalau badai datang menghampiri.",
  "Ke Cianjur membeli beras,\nBeras pulen putih warnanya.\nKamu wanita yang kuat dan cerdas,\nMasa depan cerah menantinya.",
  "Sinar mentari menembus jendela,\nHangatnya sampai ke dalam kalbu.\nSemoga harimu penuh bahagia,\nSeperti hangatnya senyummu.",
  "Burung kenari bernyanyi merdu,\nHinggap di dahan pohon cemara.\nTetap semangat wahai sahabatku,\nKamu cahaya bagi keluarga.",
  "Kebun teh di Puncak sana,\nHijau terhampar sejuk dipandang.\nHidup tak harus sempurna,\nCukup dijalani dengan hati lapang.",
  "Beli gula di warung Bu Ani,\nGula merah untuk kolak.\nSatu senyum di pagi ini,\nBikin semangat terus bergerak.",
  "Pelangi muncul sehabis hujan,\nTujuh warna indah sekali.\nSetiap usaha ada balasan,\nPercayalah pada dirimu sendiri.",
  "Pergi ke sawah melihat padi,\nPadi menguning siap dipanen.\nMakin berisi makin merunduk diri,\nRendah hati itu paling keren.",
  "Bunga anggrek di pot tanah,\nWarnanya ungu sangat menawan.\nJangan pernah merasa kalah,\nKamu kuat menghadapi tantangan.",
  "Pergi ke pantai mencari kerang,\nKerang putih di atas pasir.\nJalani hari dengan riang,\nRezeki pun terus mengalir.",
  "Minum jus alpukat segar,\nDiberi susu cokelat manis.\nKamu wanita yang tegar,\nSemangatmu tak pernah habis.",
  "Daun kelor daun salam,\nDipetik ibu di kebun belakang.\nJangan simpan dendam semalam,\nMaafkan, hati pun jadi tenang.",
  "Pagi berkabut di kaki gunung,\nUdara sejuk menyegarkan jiwa.\nJangan biarkan hatimu murung,\nSenyummu membawa bahagia.",
  "Merpati putih terbang tinggi,\nMelintas di atas atap rumah.\nSemoga harimu penuh rezeki,\nDan langkahmu penuh berkah.",
  "Pergi ke pasar hari Minggu,\nMembeli jeruk manis rasanya.\nKamu hebat, percaya selalu,\nUsahamu pasti ada hasilnya.",
  "Bunga sakura bermekaran,\nWarnanya merah muda menawan.\nSemua indah pada waktunya, kawan,\nAsal kita tetap dalam kesabaran.",
  "Lauknya tempe dan telur dadar,\nDimakan pagi bersama keluarga.\nHidup sederhana bikin hati segar,\nBersyukur itu kunci bahagia.",
  "Ke Lembang memetik stroberi,\nStroberi merah manis rasanya.\nJadilah versi terbaik diri,\nHari ini, esok, dan selamanya.",
  "Angin sepoi di tepi danau,\nPerahu kecil berlayar pelan.\nTak perlu tergesa, tak perlu galau,\nHidup indah kalau dinikmati perlahan.",
  "Kain songket dari Palembang,\nBenang emas berkilau indah.\nHati yang ikhlas terasa lapang,\nSetiap langkah jadi berkah.",
  "Burung pipit di atas pagar,\nMencari makan di pagi hari.\nWalau sulit tetaplah tegar,\nKamu mampu, percaya diri.",
  "Pergi ke kebun memetik jambu,\nJambu air merah merona.\nSayangi ayah, sayangi ibu,\nSurga dunia ada pada mereka.",
  "Kopi hangat di pagi hari,\nAromanya harum memenuhi ruang.\nAwali hari dengan syukur di hati,\nInsya Allah semua jadi terang.",
  "Bunga mawar di dalam vas,\nDiletakkan di atas meja.\nHidup jujur, hati ikhlas,\nItulah kunci dari segalanya.",
  "Ombak berdebur di pantai Anyer,\nAnak-anak bermain pasir.\nJangan biarkan mimpimu buyar,\nBahagia untukmu terus mengalir.",
  "Langit senja jingga merona,\nBurung pulang ke sarangnya.\nRumah adalah tempat paling bahagia,\nBersama orang-orang tercinta.",
  "Pohon beringin rindang daunnya,\nTempat berteduh di siang hari.\nKamu kuat, kamu berharga,\nJangan lupa sayangi diri sendiri.",
  "Belimbing wuluh asam rasanya,\nDibuat sambal teman makan.\nSenyummu manis luar biasa,\nBikin lelah jadi terlupakan.",
  "Bunga kamboja putih bersih,\nJatuh pelan di halaman.\nHati yang bersih penuh kasih,\nMembuat hidup jadi tenteram.",
  "Ke Yogya naik kereta senja,\nSampai pagi di Stasiun Tugu.\nHidup ini memang perjalanan saja,\nNikmati setiap langkahmu.",
  "Bayam hijau kangkung segar,\nDimasak tumis untuk makan siang.\nSetiap hari terus belajar,\nMasa depanmu pasti cemerlang.",
  "Kunang-kunang di malam sunyi,\nCahayanya kecil tapi indah.\nKebaikan kecil hari ini,\nLama-lama jadi berkah.",
  "Beli payung warna merah,\nUntuk dipakai saat hujan.\nKalau jatuh jangan menyerah,\nBangkit lagi dan terus berjalan.",
  "Tanam melati di halaman,\nHarumnya sampai ke jalan.\nKamu wanita yang menawan,\nHatimu baik penuh perhatian.",
  "Ikan lele di dalam empang,\nDiberi makan pagi dan sore.\nHati gembira hidup pun senang,\nJangan biarkan sedih berlama-lama, oke?",
  "Mentari pagi bersinar cerah,\nEmbun bening di atas rumput.\nJangan pernah merasa lelah,\nSemangatmu jangan sampai surut.",
  "Burung bangau di tengah sawah,\nMencari ikan di air jernih.\nBerjuang terus jangan menyerah,\nMimpi indah pasti kau raih.",
  "Kue lapis berwarna-warni,\nDisajikan di atas meja.\nHidup ini cuma sekali,\nIsi dengan kebaikan saja.",
  "Bunga dahlia warna jingga,\nTumbuh subur di pot tanah liat.\nKamu bunga di keluarga,\nCantik, sabar, dan penuh semangat.",
  "Hujan deras di sore hari,\nAnak-anak bermain air.\nJangan lupa bersyukur hari ini,\nNikmat Tuhan terus mengalir.",
  "Burung camar terbang rendah,\nDi atas laut biru membentang.\nHati yang baik membuat wajah indah,\nSiapa memandang pun ikut senang.",
  "Pergi ke toko membeli benang,\nBenang wol berwarna ungu.\nKalau hati sedang tak tenang,\nIngat ada Tuhan yang menjagamu.",
  "Pagi-pagi menyapu halaman,\nDaun kering dikumpulkan.\nSahabat sejati itu teman,\nYang hadir saat kau butuhkan.",
  "Rumah makan di pinggir jalan,\nMenjual sate dan es kelapa.\nSetiap mimpi butuh kesabaran,\nHari indah pasti tiba.",
  "Bunga tulip dari Belanda,\nWarnanya merah, kuning, dan ungu.\nJangan takut untuk berbeda,\nJadilah dirimu setiap waktu.",
  "Anak bebek berbaris rapi,\nBerjalan pelan menuju kolam.\nLembut tutur, baik budi,\nHidup terang bagai purnama malam.",
  "Pergi ke pasar membeli kelapa,\nKelapa muda segar airnya.\nKebaikan jangan sampai lupa,\nSekecil apa pun ada pahalanya.",
  "Bulan sabit di ujung langit,\nBintang kecil berkelip terang.\nWalau hari ini terasa sulit,\nEsok pasti lebih senang.",
  "Air terjun jatuh berderai,\nSejuk segar di kaki bukit.\nHari ini sudah selesai,\nWaktunya senyum walau sedikit.",
  "Mangga muda rasanya masam,\nDicocol garam dan cabai.\nHidup kadang manis kadang masam,\nJalani saja dengan hati damai.",
  "Kembang sepatu merah menyala,\nTumbuh di pagar depan rumah.\nTerus semangat setiap kala,\nKamu kuat, jangan menyerah.",
  "Pergi ke kebun memetik cabai,\nCabai merah pedas rasanya.\nJalani hidup dengan hati yang damai,\nLelah pun terasa bahagia.",
  "Lilin menyala di dalam kamar,\nCahayanya kecil menerangi gelap.\nKamu wanita yang sabar,\nSemoga bahagiamu selalu lengkap.",
  "Petik daun sirih di halaman,\nDaun sirih hijau dan segar.\nJangan menyerah pada keadaan,\nBadai pasti berlalu, tetaplah sabar.",
  "Naik perahu di Sungai Musi,\nMelihat jembatan Ampera.\nTerus bermimpi dan berprestasi,\nKamu kebanggaan keluarga.",
  "Bunga kertas di depan pintu,\nWarnanya ungu sangat cantik.\nBerbuat baik setiap waktu,\nBalasannya pasti yang terbaik.",
  "Burung hantu di malam hari,\nMatanya bulat tajam melihat.\nJagalah lisan, jagalah hati,\nHidup tenang, hati pun selamat.",
  "Pergi ke Garut membeli dodol,\nDodol manis legit rasanya.\nKalau capek jangan dongkol,\nSenyum dulu, beres semua.",
  "Pisang goreng hangat-hangat,\nDimakan bersama secangkir teh.\nJangan lupa makan dan istirahat,\nSehat itu mahal, iya kan deh!",
  "Pohon cemara di pinggir jalan,\nBerdiri tegak diterpa angin.\nTetap tegak hadapi tantangan,\nTetap tenang dan tetap yakin.",
  "Beli batik di Pekalongan,\nMotifnya indah penuh warna.\nHidup penuh warna dan pilihan,\nPilihlah yang membuatmu bahagia.",
  "Bunga lavender ungu muda,\nHarumnya bikin hati tenang.\nKamu berharga, kamu istimewa,\nJangan lupa, tetaplah riang.",
  "Pagi buta ayam berkokok,\nMatahari mulai menyapa.\nJangan khawatirkan hari esok,\nTuhan sudah mengatur semua.",
  "Ke Malang memetik apel,\nApel merah manis dan segar.\nMasalah datang jangan bebal,\nHadapi dengan kepala dingin dan sabar.",
  "Anak rusa di tengah hutan,\nBerlari riang mencari ibunya.\nJalani hari dengan senyuman,\nPasti terasa lebih mudah semuanya.",
  "Gerimis turun di sore hari,\nJalanan basah licin sekali.\nHati-hati di jalan nanti,\nSampai rumah dengan selamat lagi.",
  "Pergi ke pasar membeli kain,\nKain sutra halus sekali.\nTerima kasih untuk hari ini,\nBesok kita semangat lagi.",
  "Pohon pisang berbuah satu,\nBuahnya matang kuning warnanya.\nJangan pernah ragu pada dirimu,\nKamu mampu, kamu bisa.",
  "Bunga seroja di tepi kali,\nMekar indah di pagi hari.\nSenyummu manis berseri-seri,\nMembawa bahagia ke sana kemari.",
  "Laut tenang ombak pun reda,\nNelayan pulang membawa ikan.\nDoa dan usaha tak akan sia-sia,\nTuhan pasti memberi jalan.",
  "Pagi-pagi minum susu,\nSusu sapi segar dan murni.\nPeluk erat orang yang kau rindu,\nWaktu bersama tak bisa diganti.",
  "Bunga mawar bunga melati,\nDirangkai indah dalam keranjang.\nHidup tekun sepenuh hati,\nMasa depan pasti gemilang.",
  "Jalan ke pasar melewati jembatan,\nDi bawahnya sungai mengalir jernih.\nSetiap hari adalah kesempatan,\nMimpi besar pasti kau raih.",
  "Kelinci putih melompat-lompat,\nMencari wortel di kebun sayur.\nApa pun yang kau dapat,\nTerimalah dengan rasa syukur.",
  "Embun pagi di daun talas,\nBerkilau indah terkena cahaya.\nHati ikhlas, jiwa yang luas,\nItulah tanda wanita perkasa.",
  "Pergi ke toko membeli sisir,\nSisir kayu ukiran Jepara.\nHari ini sudah berakhir,\nTerima kasih, sampai jumpa.",
  "Bintang jatuh di langit malam,\nCepat-cepat membuat harapan.\nSemoga harimu selalu tenteram,\nDan impianmu jadi kenyataan.",
];

/** Pantun penyemangat (isi baris 3-4 tentang semangat/berjuang); sisanya pantun kehidupan. */
const RE_SEMANGAT = /semangat|kuat|hebat|menyerah|mampu|tegar|mimpi|impian|lelah|berjuang|bangkit|sulit|maju|berhenti|tantangan|bisa|capai|raih|belajar/i;
const isiPantun = (p: string) => p.split("\n").slice(2).join(" ");
export const PANTUN_SEMANGAT = PANTUN.filter((p) => RE_SEMANGAT.test(isiPantun(p)));
export const PANTUN_HIDUP = PANTUN.filter((p) => !RE_SEMANGAT.test(isiPantun(p)));
/** Cocok untuk laki-laki (tanpa kata khusus perempuan). */
const netral = (p: string) => !/wanita|cantik|menawan/i.test(p);

export const JENAKA: string[] = [
  "Beli tahu di pasar baru,\nPulangnya mampir beli pepaya.\nCapek seharian itu sudah tentu,\nMakan dulu, baru mikirin dia.",
  "Ikan hiu makan tomat,\nTomatnya merah besar sekali.\nHari ini sudah tamat,\nBesok kita ketemu lagi.",
  "Pergi ke pasar membeli terasi,\nTerasinya bau sampai ke jalan.\nKalau lapar jangan emosi,\nMakan dulu, baru ngomong pelan-pelan.",
  "Kucing belang makan ikan,\nIkannya dicuri dari dapur.\nKalau ngantuk jangan ditahan,\nSampai rumah langsung tidur.",
  "Jalan-jalan ke kota Paris,\nLihat menara tinggi sekali.\nKalau dompet sudah menipis,\nTunggu gajian, sabar lagi.",
  "Ada kodok pakai kacamata,\nLompat-lompat di pinggir kali.\nSenyum dulu, jangan cemberut saja,\nNanti cepat tua, rugi sekali.",
  "Makan bakso di pinggir jalan,\nBaksonya besar seperti bola.\nKalau ada masalah pelan-pelan,\nJangan panik, nanti botak kepala.",
  "Ayam jago berkokok pagi,\nBangunkan semua yang masih tidur.\nKalau mau rezeki lancar lagi,\nJangan kebanyakan rebahan di kasur.",
  "Ke warung beli kerupuk,\nKerupuk dimakan sambil nonton TV.\nJangan kebanyakan mengantuk,\nNanti mimpi ketemu mantan lagi.",
  "Cicak-cicak di dinding,\nDiam-diam merayap.\nKalau gajian jangan pusing,\nHabisnya cuma sekejap.",
  "Buah semangka buah durian,\nDibeli di pasar dekat stasiun.\nHidup jangan terlalu serius, kawan,\nNanti keriput sebelum tahun depan.",
  "Naik motor ke Cikampek,\nMampir sebentar beli kopi.\nWalaupun badan sudah capek,\nSenyum dulu biar tetap happy.",
  "Ada bebek pakai sepatu,\nJalan-jalan ke pasar ikan.\nHidup ini cuma sekali, tahu,\nJangan lupa bahagia dan makan.",
  "Pergi mancing dapat sepatu,\nSepatunya bolong di ujungnya.\nKalau lelah tunggu dulu,\nSebentar lagi gajian katanya.",
  "Burung pipit makan jagung,\nJagung dimakan sampai habis.\nJangan sering-sering bingung,\nNanti uban tumbuh tipis-tipis.",
  "Si Kancil mencuri timun,\nKetahuan Pak Tani langsung lari.\nKalau ngantuk jangan melamun,\nNanti disangka patung berdiri.",
  "Beli es teh di warung sebelah,\nEs tehnya kebanyakan gula.\nKalau hari ini banyak masalah,\nTarik napas, minum, ketawa saja.",
  "Ke Bandung beli peuyeum,\nPeuyeum manis dimakan sore.\nAyo dong sedikit senyum,\nKalau cemberut kayak HP error.",
  "Ikan teri ikan tongkol,\nDimasak balado pedas sekali.\nJangan suka bikin dongkol,\nMending traktir teman sendiri.",
  "Pagi-pagi makan bubur,\nAda yang diaduk, ada yang tidak.\nBoleh beda selera, tetap akur,\nJangan sampai pertemanan rusak.",
  "Monyet naik sepeda roda tiga,\nSambil makan kacang rebus.\nKalau ada rezeki bagi juga,\nBiar tidak dibilang rakus.",
  "Jalan-jalan ke Ancol,\nLihat lumba-lumba melompat tinggi.\nKalau capek jangan ngomel,\nNanti cepat tua, rugi sendiri.",
  "Kambing makan rumput tetangga,\nTetangganya marah sambil teriak.\nRumput tetangga memang lebih hijau juga,\nTapi rumah sendiri tetap paling enak.",
  "Sapi makan rumput hijau,\nLalu tidur di bawah pohon.\nKalau lapar jangan galau,\nKe warteg dulu, jangan bengong.",
  "Pergi ke pasar membeli bawang,\nBawang dipotong bikin menangis.\nKalau sedih jangan ditimbang,\nNanti beratnya bikin meringis.",
  "Ada semut naik gajah,\nGajahnya tidak merasa.\nKalau lapar lihat saja wajah,\nKelihatan jelas tanpa ditanya.",
  "Burung hantu tidurnya siang,\nMalam hari matanya melotot.\nJangan suka begadang panjang,\nBesok pagi ketiduran sambil mengorok.",
  "Beli sayur di Pasar Senen,\nPulangnya naik angkot kuning.\nGaji belum turun sudah direncanakan,\nUjung-ujungnya bikin pusing.",
  "Anak ayam turun ke kali,\nMandi-mandi sambil bernyanyi.\nKalau mood lagi sepi,\nNyanyi dangdut biar happy lagi.",
  "Kura-kura jalannya lambat,\nTapi menang lomba sama kelinci.\nPelan-pelan asal selamat,\nYang penting sampai, jangan berhenti.",
  "Pergi ke Bali naik pesawat,\nDi pesawat dapat roti.\nKalau stres jangan dibawa berat,\nMakan es krim biar adem hati.",
  "Lele goreng sambal terasi,\nDimakan pakai nasi hangat.\nDitanya kapan nikah jangan emosi,\nJawab saja: tunggu promo, semangat!",
  "Ada kucing pakai topi,\nDuduk santai di atas pagar.\nNiat diet dari kemarin pagi,\nLihat gorengan langsung bubar.",
  "Mancing ikan dapat sandal,\nSandalnya jepit warna biru.\nPulang naik motor jangan bandel,\nIngat di rumah ada yang menunggu.",
  "Beli kuota di konter depan,\nHabis dipakai nonton drama.\nHidup jangan dibawa beban,\nSantai dikit, ngopi bersama.",
  "Pergi ke hutan lihat beruang,\nBeruangnya lagi makan madu.\nKalau dompet sudah tak beruang,\nJangan sedih, senyum dulu.",
  "Pohon jambu di depan rumah,\nBuahnya dicuri kalong tadi malam.\nKalau ditegur jangan marah,\nSenyum saja biar suasana kalem.",
  "Ke Jogja beli bakpia,\nBakpia isi kacang hijau.\nHari ini pengen bahagia,\nEh hujan, lupa bawa payung, galau.",
  "Ada ayam pakai dasi,\nMau pergi ke kondangan.\nKalau ambil makanan di pesta nasi,\nSecukupnya, jangan borongan.",
  "Nenek-nenek naik sepeda,\nPulang dari pasar beli bayam.\nKalau ketemu mantan di jalan raya,\nPura-pura lupa nama, diam.",
  "Jalan pagi di hari Minggu,\nLihat orang jualan cilok.\nKalau capek jangan ragu,\nRebahan sebentar, asal jangan mengorok.",
  "Bawa payung warna ungu,\nPayungnya bolong kena angin.\nKalau rindu bilang dulu,\nJangan diam kayak patung lilin.",
  "Anak kambing main ayunan,\nAyunannya patah, kambing jatuh.\nHidup ini memang penuh ujian,\nUntung bukan ujian matematika, huh.",
  "Pagi-pagi beli lontong,\nLontong sayur pakai kerupuk.\nKalau ada yang ngutang, tolong,\nIngat bayar, jangan pura-pura mengantuk.",
  "Burung merak ekornya indah,\nDipamerkan di depan teman.\nLaporan sudah terkirim, lega sudah,\nWaktunya pulang dan makan-makan.",
  "Pak Tani pergi ke pasar,\nBeli pupuk dan cangkul baru.\nKalau perut sudah lapar,\nLihat teman pun kayak bakso, lucu.",
  "Tukang sate kipas-kipas,\nAsapnya ke mana-mana.\nKalau gajian jangan boros lepas,\nIngat akhir bulan masih lama.",
  "Pergi ke kebun lihat kodok,\nKodoknya lompat ke dalam ember.\nKalau ngantuk jangan duduk-duduk,\nNanti tidur sampai Desember.",
  "Makan durian sampai kenyang,\nDuriannya jatuh kena kepala.\nKalau pinjam barang orang,\nKembalikan sebelum lupa.",
  "Kupu-kupu terbang tinggi,\nHinggap di bunga sebelah rumah.\nSampai jumpa besok pagi,\nJangan lupa mandi biar wangi dan ramah.",
];

export const TEBAK: { q: string; a: string }[] = [
  { q: "Sayur apa yang paling dingin?", a: "Kembang kol (cold) 🥶" },
  { q: "Kenapa ayam kalau berkokok matanya merem?", a: "Karena sudah hafal teksnya 🐓" },
  { q: "Hewan apa yang bersaudara?", a: "Katak beradik 🐸" },
  { q: "Ikan apa yang bisa terbang?", a: "Ikan lele-lawar 🦇" },
  { q: "Tahu apa yang tidak bisa dimakan?", a: "Tahu-tahu sudah akhir bulan 😅" },
  { q: "Huruf apa yang paling kedinginan?", a: "Huruf B, karena di tengah-tengah AC ❄️" },
  { q: "Kenapa nyamuk suka menggigit?", a: "Karena kalau mencium nanti dikira pacaran 🦟" },
  { q: "Gajah apa yang belalainya pendek?", a: "Gajah pesek 🐘" },
  { q: "Kenapa pohon kelapa di depan rumah harus ditebang?", a: "Karena kalau dicabut berat 🌴" },
  { q: "Ada 5 burung di pohon, ditembak satu, sisa berapa?", a: "Tidak ada, yang lain kabur semua 🐦" },
  { q: "Apa yang punya kaki tapi tidak bisa jalan?", a: "Meja 🪑" },
  { q: "Apa yang makin diisi makin ringan?", a: "Balon gas 🎈" },
  { q: "Apa yang punya leher tapi tidak punya kepala?", a: "Botol 🍾" },
  { q: "Apa yang makin dipotong makin tinggi?", a: "Celana ✂️" },
  { q: "Apa yang punya gigi tapi tidak bisa menggigit?", a: "Sisir 😁" },
  { q: "Apa yang naik terus tapi tidak pernah turun?", a: "Umur 🎂" },
  { q: "Apa yang selalu datang tapi tidak pernah tiba?", a: "Besok 📅" },
  { q: "Ayam apa yang paling besar?", a: "Ayam semesta 🌌" },
  { q: "Buah apa yang paling durhaka?", a: "Melon Kundang 🍈" },
  { q: "Kota apa yang warganya bapak-bapak semua?", a: "Bapakpapan 👨" },
  { q: "Ikan apa yang suka berhenti?", a: "Ikan pa-us (pause) 🐋" },
  { q: "Hewan apa yang paling kaya?", a: "Beruang (ber-uang) 🐻" },
  { q: "Jam apa yang tidak bisa dipakai?", a: "Jam karet ⏰" },
  { q: "Kenapa matahari tenggelam?", a: "Karena tidak bisa berenang ☀️" },
  { q: "Kenapa jerapah lehernya panjang?", a: "Karena kepalanya jauh dari badan 🦒" },
  { q: "Apa yang ada di tengah-tengah laut?", a: "Huruf U (la-U-t) 🌊" },
  { q: "Apa yang hitam, putih, hitam, putih, hitam, putih?", a: "Zebra guling-guling 🦓" },
  { q: "Kenapa kita tidur di malam hari?", a: "Karena kalau tidur siang di tempat kerja ketahuan atasan 😴" },
  { q: "Pintu apa yang didorong-dorong tidak bisa terbuka?", a: "Pintu yang tulisannya \"Tarik\" 🚪" },
  { q: "Apa yang ada di ujung langit?", a: "Huruf T (langi-T) 🔤" },
  { q: "Dibeli warnanya hitam, dipakai merah, dibuang abu-abu. Apa itu?", a: "Arang 🔥" },
  { q: "Apa yang lebih besar dari gajah tapi tidak berat?", a: "Bayangan gajah 🐘" },
  { q: "Apa yang makin dikeringkan makin basah?", a: "Handuk 🧺" },
  { q: "Apa yang punya mata tapi tidak bisa melihat?", a: "Jarum 🪡" },
  { q: "Apa yang punya kepala dan ekor tapi tidak punya badan?", a: "Uang koin 🪙" },
  { q: "Kenapa burung terbang ke selatan saat musim dingin?", a: "Karena kalau jalan kaki kejauhan 🐦" },
  { q: "Apa yang bisa pecah walau tidak disentuh?", a: "Janji 🤞" },
  { q: "Tanggal berapa yang paling ditunggu semua orang?", a: "Tanggal gajian 💰" },
  { q: "Apa yang makin banyak diambil makin besar?", a: "Lubang 🕳️" },
  { q: "Apa yang naik turun tapi tidak bergerak?", a: "Tangga 🪜" },
  { q: "Apa yang bisa keliling dunia tapi tetap di pojokan?", a: "Perangko ✉️" },
  { q: "Apa yang bisa ditangkap tapi tidak bisa dilempar?", a: "Pilek 🤧" },
  { q: "Apa yang selalu di depan kita tapi tidak bisa dilihat?", a: "Masa depan 🔮" },
  { q: "Kenapa orang tidur pakai bantal?", a: "Karena kalau pakai panci, berisik 🍳" },
  { q: "Kenapa nasi goreng warnanya cokelat?", a: "Karena kalau putih namanya nasi putih 🍛" },
  { q: "Apa yang ada di tengah-tengah kota?", a: "Huruf T (ko-T-a) 🏙️" },
  { q: "Apa yang bisa bicara semua bahasa?", a: "Gema 🗣️" },
  { q: "Kenapa ayam menyeberang jalan?", a: "Karena mau ke seberang 🐔" },
  { q: "Kalau diberi makan dia hidup, diberi minum dia mati. Apa itu?", a: "Api 🔥" },
  { q: "Hewan apa yang paling hormat?", a: "Undur-undur 🐞" },
];

export const PERIBAHASA: { q: string; a: string }[] = [
  { q: "Sedikit demi sedikit, lama-lama menjadi bukit.", a: "Hal kecil yang dilakukan terus-menerus lama-lama jadi besar." },
  { q: "Berakit-rakit ke hulu, berenang-renang ke tepian. Bersakit-sakit dahulu, bersenang-senang kemudian.", a: "Bersusah payah dulu, nanti senangnya belakangan." },
  { q: "Di mana bumi dipijak, di situ langit dijunjung.", a: "Hormati aturan dan adat tempat kita berada." },
  { q: "Air beriak tanda tak dalam.", a: "Orang yang banyak omong biasanya ilmunya sedikit." },
  { q: "Bagai padi, makin berisi makin merunduk.", a: "Makin pandai seseorang, makin rendah hati." },
  { q: "Ada gula, ada semut.", a: "Di mana ada rezeki, di situ orang berdatangan." },
  { q: "Berat sama dipikul, ringan sama dijinjing.", a: "Suka dan duka ditanggung bersama." },
  { q: "Bersatu kita teguh, bercerai kita runtuh.", a: "Kalau kompak kita kuat, kalau pecah kita lemah." },
  { q: "Hemat pangkal kaya, rajin pangkal pandai.", a: "Kalau hemat jadi kaya, kalau rajin jadi pintar." },
  { q: "Tak ada rotan, akar pun jadi.", a: "Kalau tidak ada yang terbaik, pakai yang ada." },
  { q: "Malu bertanya sesat di jalan.", a: "Jangan malu bertanya kalau tidak tahu." },
  { q: "Nasi sudah menjadi bubur.", a: "Yang sudah terjadi tidak bisa diulang, ambil pelajarannya." },
  { q: "Sekali dayung, dua tiga pulau terlampaui.", a: "Sekali usaha, beberapa tujuan tercapai." },
  { q: "Tong kosong nyaring bunyinya.", a: "Orang yang sedikit ilmunya biasanya paling ramai bicara." },
  { q: "Air susu dibalas air tuba.", a: "Kebaikan dibalas kejahatan. Jangan sampai kita begitu." },
  { q: "Seperti katak dalam tempurung.", a: "Orang yang pengetahuannya sempit karena tidak mau belajar." },
  { q: "Gajah di pelupuk mata tak tampak, kuman di seberang lautan tampak.", a: "Kesalahan sendiri tidak terlihat, kesalahan orang lain kelihatan jelas." },
  { q: "Bagai air di daun talas.", a: "Orang yang pendiriannya mudah berubah-ubah." },
  { q: "Lain lubuk lain ikannya, lain padang lain belalangnya.", a: "Tiap tempat punya kebiasaan masing-masing." },
  { q: "Habis manis sepah dibuang.", a: "Setelah tidak berguna lalu ditinggalkan. Jangan begitu ke teman." },
  { q: "Ringan tangan.", a: "Suka menolong orang lain." },
  { q: "Besar pasak daripada tiang.", a: "Pengeluaran lebih besar daripada pendapatan. Hati-hati, ya!" },
  { q: "Tak kenal maka tak sayang.", a: "Kenali dulu, baru bisa sayang." },
  { q: "Ada udang di balik batu.", a: "Ada maksud tersembunyi di balik sesuatu." },
  { q: "Bagai pinang dibelah dua.", a: "Dua orang yang sangat mirip atau serasi." },
  { q: "Rajin pangkal pandai.", a: "Orang yang rajin belajar akan jadi pintar." },
  { q: "Guru kencing berdiri, murid kencing berlari.", a: "Kelakuan orang yang dicontoh akan ditiru lebih parah oleh yang meniru." },
  { q: "Diam-diam menghanyutkan.", a: "Orang pendiam ternyata banyak ilmunya." },
  { q: "Patah tumbuh hilang berganti.", a: "Yang hilang akan ada gantinya." },
  { q: "Bagai kacang lupa kulitnya.", a: "Orang yang lupa asal-usulnya setelah sukses." },
  { q: "Air tenang menghanyutkan.", a: "Orang yang tenang biasanya berpikiran dalam." },
  { q: "Bumi tak selebar daun kelor.", a: "Dunia ini luas, masih banyak kesempatan lain." },
  { q: "Setinggi-tinggi bangau terbang, surutnya ke kubangan juga.", a: "Sejauh-jauhnya merantau, pasti rindu kampung halaman." },
  { q: "Sambil menyelam minum air.", a: "Mengerjakan dua hal sekaligus." },
  { q: "Ibarat menegakkan benang basah.", a: "Mengerjakan hal yang mustahil berhasil." },
  { q: "Bagai mencari jarum dalam jerami.", a: "Mencari sesuatu yang sangat sulit ditemukan." },
  { q: "Mulutmu harimaumu.", a: "Hati-hati bicara, ucapan bisa mencelakakan diri sendiri." },
  { q: "Buah jatuh tak jauh dari pohonnya.", a: "Sifat anak biasanya mirip orang tuanya." },
  { q: "Kecil-kecil cabai rawit.", a: "Biar kecil tapi hebat." },
  { q: "Karena nila setitik, rusak susu sebelanga.", a: "Satu kesalahan kecil bisa merusak semua kebaikan." },
  { q: "Seperti air dengan minyak.", a: "Dua hal yang tidak bisa bersatu." },
  { q: "Tiada gading yang tak retak.", a: "Tidak ada yang sempurna, semua pasti ada kekurangannya." },
  { q: "Bagai bumi dan langit.", a: "Perbedaan yang sangat jauh." },
  { q: "Jauh di mata dekat di hati.", a: "Walau berjauhan, tetap dekat di hati." },
  { q: "Hujan emas di negeri orang, hujan batu di negeri sendiri, lebih baik di negeri sendiri.", a: "Sesenang-senangnya di tempat orang, lebih enak di rumah sendiri." },
  { q: "Bagai telur di ujung tanduk.", a: "Keadaan yang sangat genting." },
  { q: "Ada asap ada api.", a: "Setiap kejadian pasti ada sebabnya." },
  { q: "Dalam laut dapat diduga, dalam hati siapa tahu.", a: "Isi hati orang sulit ditebak." },
  { q: "Gali lubang tutup lubang.", a: "Berutang untuk membayar utang lain. Sebaiknya dihindari." },
  { q: "Rezeki tak akan tertukar.", a: "Setiap orang sudah punya rezekinya masing-masing, jangan iri." },
];

export const PESAN_LAKI = "Woeey jangan lupa sholat woeey 🙏";

export type Tema = "kehidupan" | "semangat" | "jenaka" | "peribahasa" | "tebak";
export type Pesan = { pesan: string; tema?: Tema; jawab?: string; sholat?: string };

/** Tema per hari (0 = Minggu ... 6 = Sabtu). Sabtu/Minggu kosong. */
export const TEMA_HARI: (Tema | null)[] = [null, "kehidupan", "semangat", "jenaka", "peribahasa", "tebak", null];

function geser(key: string): number {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function nomorHari(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

/** Isi hari itu untuk satu orang: tema sesuai hari, isi bergiliran per minggu (geser per orang),
 *  jadi satu orang tidak dapat isi yang sama sebelum daftar tema itu habis. */
export function pilihIsi(key: string, date: string, gender: "L" | "P" | "" = "P"): Pesan {
  const n = nomorHari(date);
  const tema = TEMA_HARI[(((n + 4) % 7) + 7) % 7]; // 1 Jan 1970 = Kamis
  if (!tema) return { pesan: "" };
  const i = Math.floor((n + 3) / 7) + (geser(key) % 1000); // nomor minggu (mulai Senin)
  const ambil = <T,>(xs: T[]) => xs[i % xs.length];
  if (tema === "jenaka") return { pesan: ambil(JENAKA), tema };
  if (tema === "tebak" || tema === "peribahasa") {
    const x = ambil(tema === "tebak" ? TEBAK : PERIBAHASA);
    return { pesan: x.q, tema, jawab: x.a };
  }
  let daftar = tema === "semangat" ? PANTUN_SEMANGAT : PANTUN_HIDUP;
  if (gender === "L") daftar = daftar.filter(netral);
  return { pesan: ambil(daftar), tema };
}

/** Kompatibel lama: teks pantun/isi untuk orang + tanggal. */
export function pilihPantun(key: string, date: string): string {
  return pilihIsi(key, date, "P").pesan;
}

/** L/P dari isi kolom Jenis Kelamin (L, P, Laki-laki, Perempuan, Pria, Wanita, M, F). */
export function jenisKelamin(v: string): "L" | "P" | "" {
  const t = v.trim().toLowerCase();
  if (/^(l|laki|laki-laki|pria|m|male|cowok)$/.test(t)) return "L";
  if (/^(p|perempuan|wanita|f|female|cewek)$/.test(t)) return "P";
  return "";
}

export function pesanKirim(gender: "L" | "P" | "", key: string, date: string): Pesan {
  if (!gender) return { pesan: "" };
  const isi = pilihIsi(key, date, gender);
  return gender === "L" && isi.pesan ? { ...isi, sholat: PESAN_LAKI } : isi;
}
