/**
 * Fitur yang sementara disembunyikan (permintaan Anton, 2 Nov 2026).
 * Kode & data tetap ada; ubah ke true untuk menampilkan lagi.
 */
export const FEATURES = {
  /** Production Report > Plan vs Actual (laporan Presdir) + input plan. */
  planActual: false,
  /** Rencana Lembur (/overtime). */
  overtime: false,
  /** Forecast vs PO customer (/forecast). */
  forecast: true,
  /** Perencanaan > Rencana Hari Ini (/perencanaan): alokasi orang & mesin pagi hari. */
  planning: true,
};

export const REPORT_HOME = FEATURES.planActual ? "/production-report" : "/production-report/rekap";
