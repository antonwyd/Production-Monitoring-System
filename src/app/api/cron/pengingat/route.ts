import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { kirimKe } from "@/lib/push";
import { buildToday } from "@/lib/views";

export const maxDuration = 60;

/**
 * GET /api/cron/pengingat — notifikasi HP "jangan lupa kirim laporan" untuk member QA yang belum kirim hari ini.
 * Dijalankan Vercel Cron Senin-Jumat sekitar 19:00 WIB (vercel.json); boleh juga dibuka admin yang login.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
    if (!isCron) await requireApiRole(["admin"]);
    const hari = todayJakarta();
    const libur = [0, 6].includes(new Date(`${hari}T00:00:00Z`).getUTCDay());
    if (libur) return Response.json({ hari, libur: true, terkirim: 0 });
    const belum = (await buildToday(hari)).missing;
    let terkirim = 0;
    for (const nama of belum) {
      terkirim += await kirimKe([nama], {
        title: "⏰ Jangan lupa kirim laporan hari ini",
        body: `Halo ${nama.split(/\s+/)[0]}, laporan produksi hari ini belum terkirim. Yuk isi sekarang biar poinnya penuh! 💪`,
        url: "/",
        tag: `ingat-${hari}`,
      });
    }
    return Response.json({ hari, belum: belum.length, terkirim });
  });
}
