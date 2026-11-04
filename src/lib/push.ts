// Notifikasi HP (Web Push). Kunci VAPID di env Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import { createECDH, createHmac } from "node:crypto";
import webpush from "web-push";
import { bacaLangganan, hapusLangganan, nikMember } from "./sheets/qa";

export type IsiNotif = { title: string; body: string; url?: string; tag?: string };

/**
 * Kunci VAPID. Bila env VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY tidak diisi, kunci diturunkan tetap dari SESSION_SECRET
 * (HMAC), jadi tidak perlu menyimpan rahasia baru dan kunci sama di semua server/deploy.
 */
let kunci: { pub: string; priv: string } | null | undefined;
function vapid(): { pub: string; priv: string } | null {
  if (kunci !== undefined) return kunci;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) return (kunci = { pub, priv });
  const secret = process.env.SESSION_SECRET;
  if (!secret) return (kunci = null);
  const d = createHmac("sha256", secret).update("vapid-notifikasi-hp-v1").digest();
  const ec = createECDH("prime256v1");
  ec.setPrivateKey(d);
  return (kunci = { pub: ec.getPublicKey().toString("base64url"), priv: d.toString("base64url") });
}

export const vapidPublik = () => vapid()?.pub ?? "";

function siap(): boolean {
  const k = vapid();
  if (!k) return false;
  const { pub, priv } = k;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://production-monitoring-system-delta.vercel.app", pub, priv);
  return true;
}

/** Kirim ke semua HP milik member (dicocokkan lewat NIK atau nama). Gagal kirim tidak pernah melempar error. */
export async function kirimKe(nama: string[], isi: IsiNotif): Promise<number> {
  if (!nama.length) return 0;
  try {
    if (!siap()) return 0;
    const target = new Set<string>();
    for (const n of nama) {
      target.add(n.trim().toLowerCase());
      const k = await nikMember(n).catch(() => "");
      if (k) target.add(k.trim().toLowerCase());
    }
    const subs = (await bacaLangganan()).filter((x) => target.has(x.nama.toLowerCase()) || (x.nik && target.has(x.nik.toLowerCase())));
    const mati: number[] = [];
    let terkirim = 0;
    await Promise.all(
      subs.map(async (x) => {
        try {
          await webpush.sendNotification(x.sub as webpush.PushSubscription, JSON.stringify(isi), { TTL: 60 * 60 * 12 });
          terkirim++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) mati.push(x.row);
        }
      }),
    );
    if (mati.length) await hapusLangganan(mati).catch(() => {});
    return terkirim;
  } catch {
    return 0;
  }
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? "");
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]}` : d ?? "";
};
const namaDepan = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** Isi notifikasi setelah leader menyetujui / menolak laporan. */
export function isiKeputusan(leader: string, action: string, note: string, date?: string): IsiNotif {
  if (action === "ok")
    return { title: `❤️ ${namaDepan(leader)} berterima kasih untuk laporanmu`, body: `Laporan ${tgl(date)} sudah disetujui. Terima kasih sudah melapor! 🙏`, url: "/", tag: `ok-${date}` };
  return {
    title: `❌ Laporan ${tgl(date)} ditolak`,
    body: `${note.trim() ? `Alasan: ${note.trim()}. ` : ""}Buka aplikasi untuk memperbaiki dan kirim ulang.`,
    url: "/",
    tag: `no-${date}`,
  };
}

type Detail = { ok: boolean; member?: string; date?: string };

/** Kirim notifikasi ke setiap member yang laporannya baru diputuskan. */
export async function notifKeputusan(leader: string, action: string, note: string, detail: Detail[]) {
  await Promise.all(detail.filter((d) => d.ok && d.member).map((d) => kirimKe([d.member!], isiKeputusan(leader, action, note, d.date))));
}

/** Jalankan setelah respons dikirim (tidak membuat tombol leader menunggu). */
export async function nanti(job: () => Promise<unknown>) {
  try {
    const { after } = await import("next/server");
    after(() => job().catch(() => {}));
  } catch {
    void job().catch(() => {});
  }
}
