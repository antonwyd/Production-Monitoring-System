"use client";
import { useEffect, useState } from "react";

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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="nik">NIK</label>
        <input id="nik" className="input text-lg" autoComplete="username" value={nik} onChange={(e) => setNik(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="pin">PIN</label>
        <input
          id="pin"
          className="input text-lg tracking-widest"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full py-3 text-lg" disabled={busy}>
        {busy ? "Masuk…" : "Masuk"}
      </button>
    </form>
  );
}
