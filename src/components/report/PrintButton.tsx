"use client";
import Icon from "@/components/Icon";

export default function PrintButton() {
  return (
    <button type="button" className="btn-secondary btn-sm min-h-10 flex-1 sm:flex-none" onClick={() => window.print()}>
      <Icon name="printer" size={16} />
      Cetak / PDF
    </button>
  );
}
