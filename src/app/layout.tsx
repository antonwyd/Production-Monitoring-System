import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laporan Produksi QA",
  description: "Input laporan produksi QA oleh operator, validasi leader, dan report otomatis.",
  manifest: "/manifest.webmanifest",
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
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
