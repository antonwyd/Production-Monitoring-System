"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

const LAST_NIK = "qa:lastNik";

export default function LoginForm() {
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setNik(localStorage.getItem(LAST_NIK) ?? "");
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login gagal.");
      try {
        localStorage.setItem(LAST_NIK, nik);
      } catch {}
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="nik">NIK</label>
        <input id="nik" className="input h-12 text-base" inputMode="text" placeholder="Nomor induk karyawan" autoComplete="username" value={nik} onChange={(e) => setNik(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pin">PIN</label>
        <input
          id="pin"
          className="input h-12 text-base tracking-[0.3em]"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="alertCircle" size={16} className="mt-0.5" />
          {error}
        </p>
      )}
      <button className="btn-primary h-12 w-full text-base" disabled={busy}>
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
        {busy ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
