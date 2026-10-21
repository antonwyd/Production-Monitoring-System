import type { SubmissionStatus } from "@/lib/types";

const STYLE: Record<SubmissionStatus, [string, string]> = {
  pending: ["Menunggu", "bg-amber-100 text-amber-800"],
  approved: ["Disetujui", "bg-emerald-100 text-emerald-800"],
  rejected: ["Ditolak", "bg-red-100 text-red-800"],
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  const [label, cls] = STYLE[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
