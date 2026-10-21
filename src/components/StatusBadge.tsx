import type { SubmissionStatus } from "@/lib/types";

const STYLE: Record<SubmissionStatus, [string, string, string]> = {
  pending: ["Menunggu", "badge-warning", "bg-amber-500"],
  approved: ["Disetujui", "badge-success", "bg-emerald-500"],
  rejected: ["Ditolak", "badge-danger", "bg-red-500"],
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  const [label, cls, dot] = STYLE[status];
  return (
    <span className={cls}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
