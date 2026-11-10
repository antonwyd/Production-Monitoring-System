"use client";
import { useEffect } from "react";
import { tr } from "@/lib/i18n";

// Bahasa Jepang: semua teks di halaman diterjemahkan di browser setelah halaman tampil (kamus src/lib/i18n.ts),
// termasuk grafik dan tooltip yang muncul belakangan (MutationObserver). Bahasa Indonesia: tidak melakukan apa-apa.
// Bagian yang tidak boleh diterjemahkan diberi atribut data-notr.

const ATTRS = ["title", "placeholder", "aria-label"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);

export default function LangRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.lang !== "ja") return;
    const done = new WeakMap<Node, string>();
    const skip = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) if (SKIP.has(e.tagName) || e.hasAttribute("data-notr")) return true;
      return false;
    };
    const text = (n: Text) => {
      const v = n.nodeValue ?? "";
      if (!v.trim() || done.get(n) === v || skip(n.parentElement)) return;
      const t = tr(v, "ja");
      done.set(n, t);
      if (t !== v) n.nodeValue = t;
    };
    const attrs = (el: Element) => {
      if (el.closest("[data-notr]")) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v || v === (el as unknown as Record<string, string>)[`_tr_${a}`]) continue;
        const t = tr(v, "ja");
        (el as unknown as Record<string, string>)[`_tr_${a}`] = t;
        if (t !== v) el.setAttribute(a, t);
      }
    };
    // Elemen yang isinya hanya teks (mis. "1–" "10" " " "Nov"): digabung dulu supaya pola tanggal/angka kena.
    const gabung = (el: Element) => {
      const kids = el.childNodes;
      if (kids.length < 2 || skip(el)) return false;
      for (const k of kids) if (k.nodeType !== 3) return false;
      const v = el.textContent ?? "";
      // Sudah diterjemahkan (perubahan ini berasal dari kita sendiri): jangan diterjemahkan dua kali.
      if (done.get(el) === v) return true;
      const t = tr(v, "ja");
      done.set(el, t);
      if (t === v) {
        kids.forEach((k) => done.set(k, k.nodeValue ?? ""));
        return true;
      }
      (kids[0] as Text).nodeValue = t;
      done.set(kids[0], t);
      for (let i = 1; i < kids.length; i++) {
        (kids[i] as Text).nodeValue = "";
        done.set(kids[i], "");
      }
      return true;
    };
    const walk = (node: Node) => {
      if (node.nodeType === 3) return text(node as Text);
      if (node.nodeType !== 1) return;
      const el = node as Element;
      if (el.hasAttribute("data-notr")) return;
      if (SKIP.has(el.tagName)) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") attrs(el);
        return;
      }
      attrs(el);
      if (gabung(el)) return;
      el.childNodes.forEach(walk);
    };
    walk(document.body);
    document.title = tr(document.title, "ja");
    root.dataset.tr = "1";
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") {
          const p = m.target.parentElement;
          if (p && !gabung(p)) text(m.target as Text);
        } else if (m.type === "attributes") attrs(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, []);
  return null;
}

/** Tombol pilihan bahasa. Disimpan di cookie (dipakai juga oleh file Excel/PDF) lalu halaman dimuat ulang. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const set = (l: "id" | "ja") => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  };
  return (
    <div data-notr className={`inline-flex overflow-hidden rounded-lg border border-white/15 text-xs font-semibold ${className}`} role="group" aria-label="Bahasa / 言語">
      <button type="button" onClick={() => set("id")} className="lang-id px-2.5 py-1.5">
        ID
      </button>
      <button type="button" onClick={() => set("ja")} className="lang-ja px-2.5 py-1.5">
        日本語
      </button>
    </div>
  );
}
