"use client";
import { Fragment, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string; error?: boolean };

const CONTOH = [
  "Berapa total produksi kemarin per proses?",
  "Siapa 5 member dengan NG rate tertinggi bulan ini?",
  "Rata-rata Bowl PF 627 J D1 per hari bulan ini?",
  "Lost time terbesar minggu ini apa saja?",
  "Achievement PO vs forecast bulan ini berapa?",
];
const KEY = "qa:ai-chat";

/** Teks tebal **x** dan `kode` dalam satu baris. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") && p.endsWith("`") ? <code key={i} className="rounded bg-slate-100 px-1">{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>,
  );
}

/** Markdown sederhana: judul, poin, nomor, tabel. Cukup untuk jawaban AI. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      out.push(
        <div key={i} className="my-1 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-slate-100 font-semibold" : "border-t border-slate-200"}>
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-2 py-1 ${ci > 0 && /^[\d.,%\s+-]+$/.test(c) ? "text-right tabular-nums" : ""}`}>
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^#{1,4}\s/.test(l)) out.push(<p key={i} className="mt-1 font-semibold">{inline(l.replace(/^#+\s/, ""))}</p>);
    else if (/^\s*[-*•]\s/.test(l)) out.push(<p key={i} className="pl-4 -indent-3">• {inline(l.replace(/^\s*[-*•]\s/, ""))}</p>);
    else if (/^\s*\d+[.)]\s/.test(l)) out.push(<p key={i} className="pl-4 -indent-4">{inline(l.trim())}</p>);
    else if (!l.trim()) out.push(<div key={i} className="h-1.5" />);
    else out.push(<p key={i}>{inline(l)}</p>);
  }
  return <div className="space-y-0.5 leading-relaxed">{out}</div>;
}

export default function AskAi() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(KEY);
      if (s) setTurns(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-20)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);
  useEffect(() => {
    if (!open || enabled !== null) return;
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, [open, enabled]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Turn[] = [...turns.filter((x) => !x.error), { role: "user", content: t }];
    setTurns(next);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const d = await r.json().catch(() => ({}));
      setTurns([...next, r.ok ? { role: "assistant", content: d.text } : { role: "assistant", content: d.error || "Gagal mendapat jawaban.", error: true }]);
    } catch {
      setTurns([...next, { role: "assistant", content: "Koneksi terputus. Coba lagi.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-[#9b1b1f] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#7f1619] lg:bottom-6 lg:right-6"
          aria-label="Tanya AI"
        >
          <span aria-hidden>✨</span> Tanya AI
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-20 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px] lg:bottom-6 lg:right-6 lg:top-auto lg:h-[620px] lg:max-h-[calc(100vh-3rem)]">
          <div className="flex items-center justify-between bg-[#9b1b1f] px-4 py-3 text-white">
            <div>
              <div className="font-semibold">✨ Tanya AI</div>
              <div className="text-xs text-white/80">Jawaban dari data laporan produksi</div>
            </div>
            <div className="flex items-center gap-1">
              {turns.length > 0 && (
                <button onClick={() => setTurns([])} className="rounded px-2 py-1 text-xs text-white/90 hover:bg-white/10">
                  Baru
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-lg leading-none hover:bg-white/10" aria-label="Tutup">
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 text-sm">
            {enabled === false && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">Fitur ini belum aktif. Admin perlu memasang API key Anthropic (ANTHROPIC_API_KEY) di Vercel.</div>
            )}
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-slate-600">Tanya apa saja seputar laporan produksi: qty, NG, achievement, lembur, lost time, mesin, member, atau forecast vs PO. Contoh:</p>
                {CONTOH.map((c) => (
                  <button key={c} onClick={() => send(c)} disabled={busy || enabled === false} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 hover:border-[#9b1b1f] disabled:opacity-50">
                    {c}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 ${
                    t.role === "user" ? "bg-[#9b1b1f] text-white" : t.error ? "border border-red-200 bg-red-50 text-red-800" : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {t.role === "user" ? <p className="whitespace-pre-wrap">{t.content}</p> : <Markdown text={t.content} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-500">
                  <span className="animate-pulse">Sedang menghitung dari data…</span>
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(q);
            }}
            className="flex items-end gap-2 border-t border-slate-200 p-2"
          >
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(q);
                }
              }}
              rows={1}
              placeholder="Tulis pertanyaan…"
              className="input max-h-28 min-h-[42px] flex-1 resize-none"
              disabled={enabled === false}
            />
            <button type="submit" disabled={busy || !q.trim() || enabled === false} className="btn-primary h-[42px] px-4 disabled:opacity-50">
              Kirim
            </button>
          </form>
        </div>
      )}
    </>
  );
}
