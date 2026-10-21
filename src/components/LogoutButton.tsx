"use client";

export default function LogoutButton() {
  return (
    <button
      className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Keluar
    </button>
  );
}
