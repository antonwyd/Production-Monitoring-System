"use client";
import Icon from "./Icon";

export default function LogoutButton() {
  return (
    <button
      className="btn-ghost btn-sm min-h-9 px-2 text-slate-500"
      title="Keluar"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      <Icon name="logout" size={16} />
      <span className="hidden sm:inline">Keluar</span>
    </button>
  );
}
