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
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
