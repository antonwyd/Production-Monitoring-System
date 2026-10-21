// Semua tanggal kerja disimpan sebagai "YYYY-MM-DD" di zona Asia/Jakarta (UTC+7, tanpa DST).
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaParts(d: Date) {
  const j = new Date(d.getTime() + JAKARTA_OFFSET_MS);
  return {
    y: j.getUTCFullYear(),
    m: j.getUTCMonth() + 1,
    d: j.getUTCDate(),
    hh: j.getUTCHours(),
    mm: j.getUTCMinutes(),
    ss: j.getUTCSeconds(),
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function todayJakarta(now = new Date()): string {
  const { y, m, d } = jakartaParts(now);
  return `${y}-${p2(m)}-${p2(d)}`;
}

export function addDays(date: string, days: number): string {
  const t = new Date(date + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function monthStart(date: string): string {
  return date.slice(0, 8) + "01";
}

export function monthEnd(date: string): string {
  const t = new Date(date.slice(0, 8) + "01T00:00:00Z");
  t.setUTCMonth(t.getUTCMonth() + 1);
  t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

/** ID kiriman: QA + yyMMddHHmmss (Asia/Jakarta) + 2 digit acak, sama seperti v1. */
export function newSubmissionId(now = new Date()): string {
  const { y, m, d, hh, mm, ss } = jakartaParts(now);
  const rnd = p2(Math.floor(Math.random() * 100));
  return `QA${String(y).slice(2)}${p2(m)}${p2(d)}${p2(hh)}${p2(mm)}${p2(ss)}${rnd}`;
}

export function formatDateId(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${bulan[m - 1]} ${y}`;
}

export function formatDateTimeId(t: Date | string | null | undefined): string {
  if (!t) return "";
  const { y, m, d, hh, mm } = jakartaParts(new Date(t));
  return `${formatDateId(`${y}-${p2(m)}-${p2(d)}`)} ${p2(hh)}:${p2(mm)}`;
}
