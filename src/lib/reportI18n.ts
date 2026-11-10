import { tr, type Lang } from "./i18n";
import type { Report, Row } from "./reports";

/** Isi tabel: hanya kata yang ada persis di kamus (status, nama hari/bulan). Nama member/part tetap. Tanggal ikut pola. */
function cell(v: Row[string], lang: Lang): Row[string] {
  if (typeof v !== "string") return v;
  const exact = tr(v, lang, "exact");
  if (exact !== v) return exact;
  // Tanggal "10 Nov 2026" / "Tidak masuk (Sakit)".
  if (/^\d{1,2} \w{3,9}( \d{4})?$/.test(v) || /^Tidak masuk \(/.test(v)) return tr(v, lang);
  return v;
}
const rows = (rs: Row[], lang: Lang) => rs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v, lang)])) as Row);

/** Salinan report dengan judul, label, catatan, dan status diterjemahkan (untuk Excel/PDF). */
export function translateReport(r: Report, lang: Lang): Report {
  if (lang === "id") return r;
  const t = (s: string) => tr(s, lang);
  return {
    ...r,
    title: t(r.title),
    subtitle: t(r.subtitle),
    kpis: r.kpis.map((k) => ({ ...k, label: t(k.label), hint: k.hint && t(k.hint), target: k.target && t(k.target), value: typeof k.value === "string" ? t(k.value) : k.value })),
    charts: r.charts.map((c) => ({ ...c, title: t(c.title), series: c.series.map((s) => ({ ...s, label: t(s.label) })), data: rows(c.data, lang) })),
    tables: r.tables.map((tb) => ({ ...tb, title: t(tb.title), note: tb.note && t(tb.note), columns: tb.columns.map((c) => ({ ...c, label: t(c.label) })), rows: rows(tb.rows, lang), total: tb.total && rows([tb.total], lang)[0] })),
  };
}
