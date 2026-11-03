/**
 * Fitur yang sementara disembunyikan (permintaan Anton, 2 Nov 2026).
 * Kode & data tetap ada; ubah ke true untuk menampilkan lagi.
 */
export const FEATURES = {
  /** Production Report > Plan vs Actual (laporan Presdir) + input plan. */
  planActual: false,
  /** Rencana Lembur (/overtime). */
  overtime: false,
  /** Monitoring PO Customer (/po): kekurangan PO per customer dari input box Seiretsu/Senbetsu/Washing. */
  po: true,
};

export const REPORT_HOME = FEATURES.planActual ? "/production-report" : "/production-report/rekap";
