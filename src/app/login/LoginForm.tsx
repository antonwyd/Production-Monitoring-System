"use client";
import { useEffect, useState } from "react";

const LAST_NIK = "qa:lastNik";

export default function LoginForm() {
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

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
        if (remember) localStorage.setItem(LAST_NIK, nik);
        else localStorage.removeItem(LAST_NIK);
      } catch {}
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setBusy(false);
    }
  }

  const field = "flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100";
  return (
    <form onSubmit={submit} className="space-y-4 xl:space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 xl:text-base" htmlFor="nik">
          NIK
        </label>
        <div className={field}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400 xl:h-6 xl:w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
          </svg>
          <input id="nik" className="h-12 w-full bg-transparent text-lg outline-none xl:h-14 xl:text-xl" inputMode="numeric" autoComplete="username" placeholder="Nomor induk karyawan" value={nik} onChange={(e) => setNik(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 xl:text-base" htmlFor="pin">
          PIN
        </label>
        <div className={field}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400 xl:h-6 xl:w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            id="pin"
            className="h-12 w-full bg-transparent text-lg tracking-widest outline-none xl:h-14 xl:text-xl"
            type={show ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => setShow(!show)}>
            {show ? "Sembunyikan" : "Lihat"}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 xl:text-base">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Ingat NIK saya
      </label>
      {error && <p role="alert" className="anim-in rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full py-3 text-lg xl:py-4 xl:text-xl" disabled={busy}>
        {busy && <span className="spinner" aria-hidden />}
        {busy ? "Memeriksa…" : "Masuk"}
        {!busy && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
      <p className="text-center text-xs text-slate-400 xl:text-sm">Lupa PIN? Hubungi admin produksi.</p>
    </form>
  );
}
