import type { Metadata, Viewport } from "next";
import "./globals.css";
import LangRuntime from "@/components/LangRuntime";

export const metadata: Metadata = {
  title: "QA Production",
  description: "Input laporan produksi QA oleh operator, validasi leader, dan report otomatis.",
  manifest: "/manifest-report.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9b1b1f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Menu samping dilipat/tidak dipasang sebelum halaman tampil, supaya tidak bergeser. */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.sb=localStorage.getItem("qa:sidebar")||""}catch(e){}` }} />
        {/* Bahasa report (cookie "lang"): ja = halaman disembunyikan sebentar sampai diterjemahkan (maks 1,5 detik). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=(document.cookie.match(/(?:^|; )lang=([^;]+)/)||[])[1];if(l==="ja"){var d=document.documentElement;d.dataset.lang="ja";d.lang="ja";setTimeout(function(){d.dataset.tr="1"},1500)}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <LangRuntime />
      </body>
    </html>
  );
}
