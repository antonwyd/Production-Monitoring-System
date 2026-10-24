"use client";
import { useState } from "react";

/** Tombol "Tampilkan semua" untuk tabel rincian yang dilipat (baris ke-11 dst. disembunyikan lewat CSS). */
export default function ShowAll({ total, shown }: { total: number; shown: number }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="w-full border-t border-slate-100 py-3 text-sm font-semibold text-brand-600 hover:bg-slate-50"
      onClick={(e) => {
        const sec = e.currentTarget.closest("section");
        sec?.setAttribute("data-open", String(!open));
        setOpen(!open);
      }}
    >
      {open ? "Lipat lagi" : `Tampilkan semua (${total} baris, ${total - shown} lagi)`}
    </button>
  );
}
