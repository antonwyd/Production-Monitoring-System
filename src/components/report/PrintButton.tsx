"use client";

export default function PrintButton({ label = "Cetak / PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-secondary h-11" onClick={() => window.print()}>
      {label}
    </button>
  );
}
