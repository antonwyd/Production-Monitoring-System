import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"],
  // Font Jepang untuk PDF (dibaca dengan fs saat file dibuat).
  outputFileTracingIncludes: { "/api/export/[file]": ["./src/assets/fonts/**"] },
};

export default nextConfig;
