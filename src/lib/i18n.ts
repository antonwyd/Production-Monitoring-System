// Terjemahan halaman report ke bahasa Jepang (untuk Presdir).
// Kunci = teks Indonesia persis seperti tampil di halaman. Teks yang tidak ada di kamus dicoba lewat pola
// (tanggal, angka + satuan) lalu potongan frasa; sisanya tetap bahasa Indonesia.
// Nama member, part, mesin, lot, dan isi Master Data sengaja tidak diterjemahkan.

export type Lang = "id" | "ja";
export const LANG_COOKIE = "lang";

export function parseLang(v: string | null | undefined): Lang {
  return v === "ja" ? "ja" : "id";
}

/** Dari header Cookie (route handler / server). */
export function langFromCookieHeader(cookie: string | null | undefined): Lang {
  const m = /(?:^|;\s*)lang=([^;]+)/.exec(cookie ?? "");
  return parseLang(m?.[1]);
}

const JA: Record<string, string> = {
  // ---- Menu & umum
  Dashboard: "ダッシュボード",
  "Input Produksi": "生産入力",
  "Validasi Leader": "リーダー承認",
  "Production Report": "生産レポート",
  "Forecast vs PO": "フォーキャスト vs PO",
  "Rencana Lembur": "残業計画",
  Analisa: "分析",
  "Kualitas (NG)": "品質（不良）",
  Kualitas: "品質",
  Produktivitas: "生産性",
  "Waktu & Lost Time": "時間・ロスタイム",
  Mesin: "設備",
  "Master Data": "マスターデータ",
  "Akun & Hak Akses": "アカウント・権限",
  Tools: "ツール",
  Main: "メイン",
  Keluar: "ログアウト",
  "Lebarkan menu": "メニューを広げる",
  "Lipat menu": "メニューをたたむ",
  "Buka menu": "メニューを開く",
  Home: "ホーム",
  Input: "入力",
  Lainnya: "その他",
  "Form member": "メンバー入力",
  Manajemen: "経営陣",
  Leader: "リーダー",
  Admin: "管理者",
  Operator: "作業者",
  "Memuat…": "読み込み中…",
  "Muat ulang": "再読み込み",
  "Hari sebelumnya": "前日",
  "Hari berikutnya": "翌日",
  "Pilih tanggal": "日付を選択",
  "Pilih bulan": "月を選択",
  "Bulan sebelumnya": "前月",
  "Bulan berikutnya": "翌月",
  Unduh: "ダウンロード",
  "Unduh Excel atau PDF": "Excel / PDF をダウンロード",
  Tutup: "閉じる",
  Setujui: "承認",
  Tolak: "差戻し",
  "Setujui laporan ini?": "この報告を承認しますか？",
  "Tolak laporan ini?": "この報告を差し戻しますか？",
  "Alasan penolakan (akan dilihat member)": "差戻し理由（メンバーに表示されます）",
  "Buka di halaman validasi": "承認ページで開く",
  "Tidak ada laporan yang menunggu validasi.": "承認待ちの報告はありません。",
  "Laporan masuk ke sheet.": "報告はシートに登録されました。",
  "Member akan melihat alasannya.": "メンバーに理由が表示されます。",
  "Gagal memproses.": "処理に失敗しました。",
  Gagal: "失敗",
  Buka: "開く",
  Kirim: "送信",
  Detail: "詳細",
  Semua: "すべて",
  Tabel: "表",
  Grafik: "グラフ",
  Heatmap: "ヒートマップ",
  Aksi: "操作",
  "Lihat detail ›": "詳細を見る ›",
  "Lihat semua ›": "すべて見る ›",
  "Lipat lagi": "たたむ",
  "Belum ada data.": "データがありません。",
  "Belum ada data di periode ini.": "この期間のデータはありません。",
  "belum ada data": "データなし",
  "Production Monitoring System": "生産モニタリングシステム",
  "PT Takai Seiki Indonesia": "PT Takai Seiki Indonesia",
  "QA Production": "QA 生産",
  "Selamat Datang 👋": "ようこそ 👋",
  "Masuk ke sistem untuk melanjutkan": "続けるにはログインしてください",
  "Monitoring produksi, kualitas, dan produktivitas secara real-time.": "生産・品質・生産性をリアルタイムでモニタリング。",

  // ---- Periode & tanggal
  "Hari Ini": "本日",
  "Hari ini": "本日",
  "hari ini": "本日",
  Kemarin: "昨日",
  "Minggu ini": "今週",
  "Bulan ini": "今月",
  "Bulan lalu": "先月",
  "7 hari": "7日間",
  "14 hari": "14日間",
  "30 hari": "30日間",
  Dari: "開始",
  Sampai: "終了",
  Tanggal: "日付",
  Bulan: "月",
  Hari: "日",
  Minggu: "週",
  "Minggu mulai": "週の開始日",
  "Per hari": "日別",
  "Per minggu": "週別",
  "Per tanggal": "日付別",
  "Per periode": "期間別",
  "di tanggal ini": "この日",
  "Hari terakhir": "最終日",
  "Tanggal pertama": "初回日付",
  "Periode laporan": "レポート期間",
  "vs kemarin": "前日比",
  "vs periode lalu": "前期間比",
  "vs periode sebelumnya": "前期間比",
  "sama dgn periode lalu": "前期間と同じ",
  "belum ada pembanding": "比較データなし",
  sementara: "暫定",
  Senin: "月曜日",
  Selasa: "火曜日",
  Rabu: "水曜日",
  Kamis: "木曜日",
  Jumat: "金曜日",
  Sabtu: "土曜日",

  // ---- KPI dashboard
  "Total Produksi": "総生産数",
  "Total produksi": "総生産数",
  "NG Quantity": "不良数",
  "Lost Time": "ロスタイム",
  "Lost time": "ロスタイム",
  "lost time": "ロスタイム",
  "Laporan Masuk": "報告提出状況",
  "Laporan masuk": "報告提出",
  "laporan masuk": "報告提出",
  "Menunggu Validasi": "承認待ち",
  "Menunggu validasi": "承認待ち",
  "Menunggu Validasi Leader": "リーダー承認待ち",
  "Laporan menunggu validasi": "承認待ちの報告",
  "laporan menunggu validasi": "件の報告が承認待ち",
  Achievement: "達成率",
  "Achievement rata-rata": "平均達成率",
  "NG rate": "不良率",
  "NG Rate": "不良率",
  "NG pcs": "不良数",
  "NG (pcs)": "不良数（pcs）",
  "Total NG": "不良総数",
  NG: "不良",
  "NG rate per material": "材料別不良率",
  "Semua sudah kirim": "全員提出済み",
  "Tidak ada antrian": "承認待ちなし",
  "Buka antrian validasi ›": "承認待ちを開く ›",
  "Rekap bulanan ›": "月次集計 ›",
  "Ulang tahun hari ini:": "本日の誕生日：",
  "Jangan lupa ucapkan selamat! 🎉": "お祝いの言葉をお忘れなく！🎉",
  "Laporan harian (Excel)": "日報（Excel）",
  "Laporan harian (PDF)": "日報（PDF）",
  "Detail produksi, lost time, antrian, belum kirim": "生産明細・ロスタイム・承認待ち・未提出",
  "Untuk rapat pagi atau dikirim ke WhatsApp": "朝礼用・WhatsApp 送信用",
  "Tren": "推移",
  "Produksi per Proses": "工程別生産",
  "Status Mesin": "設備状況",
  "Mesin dengan NG Tertinggi": "不良が最も多い設備",
  "Laporan Belum Masuk": "未提出の報告",
  "Top 5 Lost Time": "ロスタイム上位5",
  "Perbantuan section lain": "他部署からの応援",
  "Dilaporkan jalan": "稼働報告あり",
  "NG di atas batas": "不良が上限超過",
  "Tidak ada laporan": "報告なし",
  "Belum ada proses di Master Data.": "マスターデータに工程がありません。",
  "Belum ada mesin di Master Data.": "マスターデータに設備がありません。",
  "Status berdasarkan laporan produksi yang disetujui, bukan sinyal mesin langsung. Setup/stop belum tercatat di data.":
    "状況は承認済みの生産報告に基づきます（設備からの直接信号ではありません）。段取り・停止はまだ記録されていません。",
  "Diurutkan dari NG pcs terbanyak.": "不良数の多い順。",
  "Mesin di laporan terakhirnya (14 hari)": "直近の報告の設備（14日間）",
  "Mesin biasa": "通常の設備",
  Terlambat: "遅延",
  "Lewat 15:00": "15:00 経過",
  "Belum waktunya": "期限前",
  "Semua member sudah kirim laporan.": "全メンバーが報告済みです。",
  "Belum ada member yang diharapkan lapor.": "報告対象のメンバーはいません。",
  "Hanya member section QA. Data shift belum ada, jadi batas lapor memakai jam 15:00.":
    "QA 部署のメンバーのみ。シフトデータがないため、報告期限は 15:00 としています。",
  "Ditolak, belum dikirim ulang:": "差戻し・未再提出：",
  "Rekap bulanan": "月次集計",
  "Hasil diperiksa": "検査数",
  "Hasil diperiksa (pcs)": "検査数（pcs）",
  "Kiriman member yang belum disetujui atau ditolak leader.": "リーダーがまだ承認・差戻ししていないメンバーの報告。",
  "Jumlah pcs OK (normal + lembur) dari laporan yang sudah disetujui. Achievement = jam standar (hasil ÷ STKI, mesin PF pakai Std MC) ÷ jam kerja (baris mesin pakai jam mesin jalan).":
    "承認済み報告の良品数（定時＋残業）。達成率 ＝ 標準時間（生産数 ÷ STKI、PF 設備は Std MC）÷ 作業時間（設備行は稼働時間）。",
  "NG (pcs) dari laporan disetujui. NG rate = NG ÷ (OK + NG). Press PT = lot material diawali 31, Press JPN = lot diawali 01, Plastik = semua kategori Plastik.":
    "承認済み報告の不良数。不良率 ＝ 不良 ÷（良品＋不良）。Press PT ＝ 材料ロットが 31 で始まる、Press JPN ＝ 01 で始まる、プラスチック ＝ プラスチックの全カテゴリ。",
  "Total menit Lost Time (grup Lost Time di Master Data). Persen = Lost Time ÷ total menit kerja orang (normal + lembur + lost time + another job). Another Job dihitung terpisah.":
    "ロスタイムの合計（分）。割合 ＝ ロスタイム ÷ 総作業時間（定時＋残業＋ロスタイム＋付帯作業）。付帯作業は別集計。",
  "Member yang sudah kirim ÷ member yang diharapkan lapor (semua member Active section QA, ditambah member section lain yang ikut lapor hari itu sebagai perbantuan). Member yang ditandai leader tidak masuk (Cuti/Sakit/Izin/Alpa) tidak dihitung.":
    "提出済みメンバー ÷ 報告対象メンバー（QA 部署の在籍者全員＋当日応援で報告した他部署メンバー）。リーダーが欠勤（有給・病欠・私用・無断）とした者は除外。",
  "Achievement vs target": "達成率 vs 目標",

  // ---- Kolom & istilah report
  "Hasil Produksi": "生産数",
  "Hasil produksi": "生産数",
  Hasil: "生産数",
  "Hasil (pcs)": "生産数（pcs）",
  "Hasil (pcs) & Achievement (%)": "生産数（pcs）と達成率（%）",
  "Hasil per hari (pcs)": "日別生産数（pcs）",
  "Hasil per jam": "時間当たり生産数",
  "Hasil ALL (pcs)": "合計生産数（pcs）",
  "ALL (pcs)": "合計（pcs）",
  Produksi: "生産",
  Proses: "工程",
  "Semua proses": "全工程",
  Kategori: "カテゴリ",
  "Semua kategori": "全カテゴリ",
  "Per kategori": "カテゴリ別",
  Part: "品番",
  "Part / Type": "品番 / タイプ",
  "Per part": "品番別",
  "Semua part": "全品番",
  "Total part": "品番数",
  "Top 10 part": "上位10品番",
  "Cari part": "品番検索",
  "Cari part, mis. 627D1": "品番検索（例：627D1）",
  Lot: "ロット",
  Oiban: "追番",
  "Per lot": "ロット別",
  "Cari lot / oiban": "ロット / 追番検索",
  "Cari lot atau oiban, mis. 0123": "ロットまたは追番を検索（例：0123）",
  Member: "メンバー",
  "Semua member": "全メンバー",
  "Per member": "メンバー別",
  Section: "部署",
  Status: "状況",
  Line: "ライン",
  Grade: "評価",
  Target: "目標",
  target: "目標",
  Batas: "上限",
  Kumulatif: "累計",
  kumulatif: "累計",
  Jam: "時間",
  Menit: "分",
  Orang: "人数",
  Porsi: "構成比",
  Tindakan: "対策",
  No: "No",
  Keterangan: "備考",
  Catatan: "メモ",
  Alasan: "理由",
  Jenis: "種類",
  Grup: "グループ",
  Kejadian: "発生件数",
  Isi: "内容",
  "Jam kerja": "作業時間",
  "Jam kerja normal": "定時作業時間",
  "Jam kerja/mesin": "作業時間 / 設備",
  "Jam standar": "標準時間",
  "Jam standar MC": "設備標準時間",
  "Jam rated (orang/mesin)": "定格時間（人 / 設備）",
  "Jam OT": "残業時間",
  "Jam lembur (OT)": "残業時間（OT）",
  "Jam efektif produksi": "実生産時間",
  "Jam jalan": "稼働時間",
  "Jam tersedia": "可用時間",
  "Jam mesin jalan": "設備稼働時間",
  "Jam kirim": "送信時刻",
  "Total menit": "合計（分）",
  "Total menit normal": "定時合計（分）",
  "Lost Time (jam)": "ロスタイム（時間）",
  "Lost Time (mnt)": "ロスタイム（分）",
  "Lost time (menit)": "ロスタイム（分）",
  "Another Job": "付帯作業",
  "Another Job (jam)": "付帯作業（時間）",
  "Another Job (mnt)": "付帯作業（分）",
  "Lost Time per minggu (jam)": "週別ロスタイム（時間）",
  "Waktu hilang": "損失時間",
  "Waktu hilang (jam)": "損失時間（時間）",
  "Potensi hilang (pcs)": "損失見込み数（pcs）",
  "Rincian lost time": "ロスタイム明細",
  "Pareto NG (pcs)": "不良パレート（pcs）",
  "Pareto NG per jenis (pcs)": "不良種類別パレート（pcs）",
  "Pareto Lost Time & Another Job (jam)": "ロスタイム・付帯作業パレート（時間）",
  "Achievement per hari": "日別達成率",
  "Achievement per member": "メンバー別達成率",
  "Achievement per kategori": "カテゴリ別達成率",
  "Achievement 6 bulan": "達成率（6か月）",
  "NG rate 6 bulan": "不良率（6か月）",
  "NG rate (%)": "不良率（%）",
  "Member dengan achievement tertinggi": "達成率上位のメンバー",
  "Member lapor": "報告メンバー数",
  "Hari lapor": "報告日数",
  "Hari kerja": "稼働日数",
  "hari kerja": "稼働日",
  "Hari kerja lengkap": "完了した稼働日",
  "Total per part (semua kategori)": "品番別合計（全カテゴリ）",
  "Total per hari": "日別合計",
  "Rekap per member": "メンバー別集計",
  "Rekap per kategori": "カテゴリ別集計",
  "Per jenis": "種類別",
  "Per jenis NG": "不良種類別",
  "Jenis NG": "不良種類",
  "Grup NG": "不良グループ",
  "Jumlah jenis NG": "不良種類数",
  "NG per jenis": "種類別不良",
  "NG dominan": "主な不良",
  "NG terbanyak": "最多不良",
  "Part dengan NG": "不良のある品番",
  "Part diproduksi": "生産品番数",
  "Part dengan NG terbanyak": "不良数の多い品番",
  "Part dengan NG rate tertinggi (produksi ≥ 500 pcs)": "不良率の高い品番（生産 ≥ 500 pcs）",
  "Part x jenis NG": "品番 × 不良種類",
  "Rincian NG": "不良明細",
  "Tren NG rate harian": "日別不良率推移",
  "Tren rate": "不良率推移",
  "NG per lot (urut NG tertinggi)": "ロット別不良（不良の多い順）",
  "Lot NG tertinggi": "不良最多ロット",
  "Detail per jenis NG": "不良種類別詳細",
  "Detail per lot": "ロット別詳細",
  "Catatan NG Lain-lain": "その他不良のメモ",
  "NG Lain-lain": "その他不良",
  "10 terbesar": "上位10",
  "Top 10": "上位10",
  "Jenis cacat terbanyak": "最も多い不良種類",
  "NG per part & proses": "品番・工程別不良",
  "NG per lot & oiban": "ロット・追番別不良",
  "Lihat part": "品番を見る",
  "Lihat semua lot ›": "全ロットを見る ›",
  "Hapus filter jenis ×": "種類フィルター解除 ×",
  "Pilih part untuk melihat rincian.": "品番を選ぶと明細を表示します。",
  "Belum ada NG di periode ini.": "この期間に不良はありません。",
  "Belum ada part dengan NG di periode ini.": "この期間に不良のある品番はありません。",
  "Urut NG rate hanya part dengan produksi ≥ 500 pcs.": "不良率順は生産 ≥ 500 pcs の品番のみ。",
  "Batang = NG (pcs), garis = kumulatif (%). Fokus perbaikan pada jenis sampai kumulatif ±80%.":
    "棒 ＝ 不良数（pcs）、線 ＝ 累計（%）。累計約 80% までの種類を重点的に改善。",
  "Press PT = lot diawali 31 · Press JPN = lot diawali 01 · Plastik = kategori Plastik":
    "Press PT ＝ ロット 31 始まり · Press JPN ＝ ロット 01 始まり · プラスチック ＝ プラスチックカテゴリ",
  "OK yang sudah disetujui": "承認済みの良品",
  "yang diproduksi di periode ini": "この期間に生産",
  Plastik: "プラスチック",
  Iron: "鉄",
  "(tanpa lot)": "（ロットなし）",
  "Sesuai target": "目標達成",
  "✓ Sesuai target": "✓ 目標達成",
  "Di luar target": "目標未達",
  "Di bawah target": "目標未達",
  Sesuai: "達成",
  "Di luar": "未達",
  OK: "OK",
  "Tidak jalan": "停止",
  "tidak jalan": "停止",
  "Mesin jalan": "稼働設備",
  "Hari jalan": "稼働日数",
  Utilisasi: "稼働率",
  "Utilisasi mesin yang jalan": "稼働設備の稼働率",
  "Utilisasi mesin yang jalan (urut tertinggi)": "稼働設備の稼働率（高い順）",
  Efisiensi: "効率",
  "Efisiensi vs Std MC": "効率 vs 設備標準",
  "OEE (kira-kira)": "OEE（概算）",
  "Semua mesin": "全設備",
  "Cari mesin, line, atau kategori…": "設備・ライン・カテゴリを検索…",
  "Mesin ini tidak jalan di rentang ini.": "この設備は期間中稼働していません。",
  "Belum ada mesin jalan di periode ini.": "この期間に稼働した設備はありません。",
  "Belum ada mesin jalan.": "稼働した設備はありません。",
  "Tidak ada mesin yang cocok.": "該当する設備はありません。",
  "Tren harian utilisasi & efisiensi": "稼働率・効率の日別推移",
  "Angka = utilisasi harian (%). Makin gelap makin tinggi. Titik = mesin tidak jalan hari itu.":
    "数値 ＝ 日別稼働率（%）。濃いほど高い。点 ＝ その日は停止。",
  "Laporan Mesin": "設備レポート",
  "Laporan Kualitas (NG)": "品質レポート（不良）",
  "Laporan NG per Part": "品番別不良レポート",
  "Laporan NG per Lot": "ロット別不良レポート",
  "Laporan Waktu & Lost Time": "時間・ロスタイムレポート",
  "Laporan Disiplin Lapor": "報告規律レポート",
  "Produktivitas Harian": "日別生産性",
  "Produktivitas Member": "メンバー生産性",
  "Production Report · Detail per Part": "生産レポート · 品番別詳細",
  "Production Report · Rekap Bulanan": "生産レポート · 月次集計",
  "Laporan Hari Ini": "本日のレポート",
  "Laporan Produksi QA": "QA 生産レポート",
  "Detail produksi (disetujui)": "生産明細（承認済み）",
  "Detail per part": "品番別詳細",
  "Pcs per kategori & part, periode bebas": "カテゴリ・品番別数量（期間自由）",
  "Total sebulan per kategori & member": "カテゴリ・メンバー別の月合計",
  "Status & hasil semua member": "全メンバーの状況と生産数",
  "Semua atau satu member": "全員または1名",
  "Pencapaian plan per section (laporan Presdir)": "部署別計画達成（社長向け）",
  "Jenis report": "レポート種類",
  "Plan vs Actual": "計画 vs 実績",
  "Hasil per tanggal per kategori. Pilih Bulan ini untuk rekap sebulan.": "日付・カテゴリ別の生産数。月集計は「今月」を選択。",
  "Hasil = qty normal + OT yang sudah disetujui. Kolom per kategori lalu ALL. Pakai kotak Cari part untuk satu part, mis. 627D1.":
    "生産数 ＝ 承認済みの定時＋残業数量。カテゴリ別の列、最後に合計。1品番だけ見るには品番検索（例：627D1）。",
  "Pilih nama di filter Member untuk detail per hari dan per part.": "日別・品番別の詳細はメンバーフィルターで名前を選択。",
  "Baris mesin dihitung dengan jam mesin jalan": "設備行は設備稼働時間で計算",
  "dari jam normal, sisanya lost time + another job": "定時のうち、残りはロスタイム＋付帯作業",
  "lost time, tanpa Another Job": "ロスタイム（付帯作業を除く）",
  "Member, tanggal, part": "メンバー・日付・品番",
  "· hanya laporan yang sudah disetujui": "· 承認済みの報告のみ",
  "· dari semua kiriman, termasuk yang menunggu dan ditolak": "· 承認待ち・差戻しを含む全提出分",
  "pcs, yang sudah disetujui": "pcs（承認済み）",
  "Belum ada laporan yang disetujui di periode ini.": "この期間に承認済みの報告はありません。",
  Disetujui: "承認済",
  Ditolak: "差戻し",
  Menunggu: "承認待ち",
  "Masih menunggu": "承認待ち",
  "Belum lapor": "未報告",
  "Belum kirim": "未提出",
  "belum kirim": "未提出",
  "Sudah kirim": "提出済み",
  "Sudah lapor (disetujui)": "報告済み（承認済）",
  "Tidak masuk": "欠勤",
  "tidak masuk": "欠勤",
  Cuti: "有給休暇",
  Sakit: "病欠",
  Izin: "私用休",
  Alpa: "無断欠勤",
  "Perlu dicek": "要確認",
  "Dikirim di hari yang sama": "当日提出",
  "Rata-rata waktu validasi (jam)": "平均承認時間（時間）",
  "Ditolak leader": "リーダー差戻し",
  "Kirim di hari yang sama per member": "メンバー別当日提出",
  "Tepat hari itu": "当日",
  Kiriman: "提出数",
  "Hari yang sama": "当日",
  "Lebih dari H+1": "翌日以降",
  "Tepat waktu": "期限内",
  "Hari tidak lapor": "未報告日数",
  "Alasan penolakan": "差戻し理由",
  "hanya lost time": "ロスタイムのみ",
  "Excel (.xlsx)": "Excel（.xlsx）",
  "Kop + angka vs target + semua tabel, siap cetak A4": "ヘッダー＋目標比＋全表、A4 印刷用",
  "Untuk dikirim atau dicetak, dengan kotak tanda tangan": "送付・印刷用（署名欄付き）",

  // ---- Excel / PDF
  "PT. TAKAI SEIKI INDONESIA": "PT. TAKAI SEIKI INDONESIA",
  Dibuat: "作成",
  Diperiksa: "確認",
  "Nama / Tgl": "氏名 / 日付",
  Halaman: "ページ",
  "Angka utama": "主要指標",
  Indikator: "指標",
  Nilai: "値",
  Laporan: "レポート",
  "Rincian di sheet lain": "明細は別シート",
  "Angka dihitung dari laporan yang sudah disetujui leader.": "数値はリーダー承認済みの報告から算出。",
  "Nama:                         Tgl:": "氏名：                         日付：",
};

// Frasa di dalam teks yang lebih panjang (dipakai bila teks tidak ada persis di kamus). Urut dari terpanjang.
const PHRASES: [string, string][] = Object.entries<string>({
  "orang-hari": "人日",
  Dibuat: "作成",
  "Belum ada data di periode ini.": "この期間のデータはありません。",
  "laporan menunggu validasi": "件の報告が承認待ち",
  "hari ada laporan disetujui": "日分の承認済み報告",
  "belum kirim": "未提出",
  "tidak masuk": "欠勤",
  "Termasuk": "内訳：",
  perbantuan: "応援",
  "Jam kerja:": "作業時間：",
  "jam normal": "時間（定時）",
  "jam OT": "時間（残業）",
  "jam lalu": "時間前",
  "Tertua dikirim": "最古の提出",
  "rata-rata": "平均",
  "pcs/hari": "pcs/日",
  "hari terakhir": "日間",
  lengkap: "完了",
  "Ranking NG rate hanya untuk mesin dengan produksi": "不良率ランキングは生産数が次以上の設備のみ：",
  "mesin di bawahnya tidak diranking": "台はランキング対象外",
  "Menampilkan 6 tertua dari": "古い順に6件表示 / 全",
  "Hanya grup Lost Time.": "ロスタイムグループのみ。",
  "dihitung terpisah.": "は別集計。",
  "Lost time dicatat per member, belum per mesin.": "ロスタイムはメンバー単位で記録（設備単位ではない）。",
  "Lost time dibagi ke proses sesuai porsi menit kerja member.": "ロスタイムはメンバーの作業時間比率で工程に配分。",
  "Klik proses untuk memfilter dashboard.": "工程をクリックするとダッシュボードを絞り込みます。",
  "Hasil, NG, achievement, lost time, dan tren dihitung dari laporan yang sudah disetujui": "生産数・不良・達成率・ロスタイム・推移は承認済みの報告から算出",
  "laporan masuk sudah disetujui": "件の提出報告が承認済み",
  "Belum ada NG dari mesin": "設備の不良なし：",
  "Tidak ada lost time": "ロスタイムなし：",
  "menit kerja": "分（作業時間）",
  "Tampilkan semua": "すべて表示",
  "Proses": "工程",
  "batas": "上限",
  "poin": "pt",
  "jenis": "種類",
  "laporan": "件",
  "menit": "分",
  "mnt": "分",
  "orang": "人",
  "mesin": "台",
  "baris": "行",
  "lagi": "件",
  "jam": "時間",
  "hari": "日",
  "sama": "同じ",
  Tren: "推移",
  Normal: "定時",
  Achievement: "達成率",
  dari: "/",
  "Data per": "データ更新",
  "Semua proses": "全工程",
  "(Sakit)": "（病欠）",
  "(Cuti)": "（有給休暇）",
  "(Izin)": "（私用休）",
  "(Alpa)": "（無断欠勤）",
  Kemarin: "昨日",
  "Hari Ini": "本日",
  "hari ini": "本日",
  "di tanggal ini": "この日",
  "Semua member": "全メンバー",
  target: "目標",
})
  // Semua kunci kamus yang terdiri dari beberapa kata juga dipakai sebagai frasa.
  .concat(Object.entries(JA).filter(([k]) => /\s/.test(k) && k.length >= 6))
  .sort((a, b) => b[0].length - a[0].length);

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_ID: Record<string, string> = { Senin: "月", Selasa: "火", Rabu: "水", Kamis: "木", Jumat: "金", Sabtu: "土", Minggu: "日" };
const monthIdx = (m: string) => {
  const i = BULAN_ID.indexOf(m);
  return i >= 0 ? i : BLN_ID.indexOf(m);
};
const MON = `(${[...BULAN_ID, ...BLN_ID].join("|")})`;

/** Angka gaya Indonesia (1.234,5) -> gaya Jepang (1,234.5). */
function angka(s: string) {
  return s.replace(/\d[\d.,]*\d/g, (m) => {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(m)) return m.replace(/\./g, "\u0001").replace(/,/g, ".").replace(/\u0001/g, ",");
    if (/^\d+,\d+$/.test(m)) return m.replace(",", ".");
    return m;
  });
}

const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  // "Senin, 10 November 2026"
  [new RegExp(`(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu), (\\d{1,2}) ${MON} (\\d{4})`, "g"), (_, h, d, m, y) => `${y}年${monthIdx(m) + 1}月${Number(d)}日（${HARI_ID[h]}）`],
  [new RegExp(`\\b(\\d{1,2}) ${MON} (\\d{4})`, "g"), (_, d, m, y) => `${y}年${monthIdx(m) + 1}月${Number(d)}日`],
  [new RegExp(`\\b${MON} (\\d{4})\\b`, "g"), (_, m, y) => `${y}年${monthIdx(m) + 1}月`],
  [new RegExp(`\\b(\\d{1,2}) ${MON}\\b`, "g"), (_, d, m) => `${monthIdx(m) + 1}月${Number(d)}日`],
  [new RegExp(`^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)$`), (_, h) => `${HARI_ID[h]}曜日`],
  [new RegExp(`^${MON}$`), (_, m) => `${monthIdx(m) + 1}月`],
  [/\bLaporan bulan\b/g, () => "月次レポート"],
  [/^(\d+(?:[.,]\d+)?)rb$/, (_, n) => `${n}千`],
  [/^Bulan (\d{4})-(\d{2})\b/, (_, y, m) => `${y}年${Number(m)}月`],
  [/^(\d+) mesin tidak jalan di periode ini$/, (_, n) => `期間中 ${n}台 停止`],
  [/^semua mesin (.+)$/, (_, v) => `全設備 ${v}`],
  [
    /^Utilisasi = jam mesin jalan ÷ \((\d+) hari kerja x jam tersedia per hari: ([\s\S]*); ubah di Master Data > Setting\)\. OEE kira-kira = utilisasi x efisiensi x \(1 − NG rate\)\.$/,
    (_, n, h) => `稼働率 = 設備稼働時間 ÷（${n} 稼働日 × 1日の可用時間：${h.replace(/(\d+(?:[.,]\d+)?) jam/g, "$1時間")}。マスターデータ > 設定で変更）。OEE（概算）= 稼働率 × 効率 ×（1 − 不良率）。`,
  ],
  [/^(\d+(?:[.,]\d+)?)jt$/, (_, n) => `${n}百万`],
  [/\bbatas kirim 10\b/g, () => "提出期限 10日"],
];

const isLatin = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);

function frasa(s: string) {
  let out = s;
  for (const [id, ja] of PHRASES) {
    let i = out.indexOf(id);
    while (i >= 0) {
      const before = out[i - 1];
      const after = out[i + id.length];
      // Hanya kata utuh (huruf/angka di kiri-kanan tidak boleh huruf), kecuali angka langsung di depan.
      const okL = !before || !/[A-Za-z]/.test(before);
      const okR = !after || !/[A-Za-z]/.test(after);
      if (okL && okR) {
        out = out.slice(0, i) + ja + out.slice(i + id.length);
        i = out.indexOf(id, i + ja.length);
      } else i = out.indexOf(id, i + 1);
    }
  }
  return out;
}

const cache = new Map<string, string>();

/** Terjemahkan satu teks yang tampil di halaman. lang "id" = tidak berubah. */
export function tr(text: string, lang: Lang, mode: "full" | "exact" = "full"): string {
  if (lang !== "ja" || !text) return text;
  const key = `${mode}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const [, lead, core, trail] = m;
  let out = core;
  if (Object.hasOwn(JA, core)) out = JA[core];
  else if (mode === "full" && /[A-Za-z]/.test(core)) {
    let s = core;
    for (const [re, fn] of PATTERNS) s = s.replace(re, fn as (...a: string[]) => string);
    // Potongan dengan tanda baca di ujung, mis. "Status Mesin (" atau "Tren".
    const pm = /^([^A-Za-z]*)([\s\S]*?)([^A-Za-z]*)$/.exec(s);
    if (pm && pm[2] && Object.hasOwn(JA, pm[2])) s = pm[1] + JA[pm[2]] + pm[3];
    else s = frasa(s);
    out = s;
  }
  if (mode === "full") out = angka(out).replace(/(\d) (人日|人|時間|分|日間|日分|日|台|件|行|種類|pt)/g, "$1$2");
  out = lead + out + trail;
  if (cache.size > 5000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Ada di kamus persis (dipakai untuk isi tabel: nama member/part tidak ikut berubah). */
export function hasExact(text: string) {
  return Object.hasOwn(JA, text.trim());
}

export { isLatin as _isLatin, angka as angkaJa, JA as KAMUS_JA };
