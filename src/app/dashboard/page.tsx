import { redirect } from "next/navigation";

// Dashboard lama diganti halaman "Hari Ini".
export default function DashboardPage() {
  redirect("/hari-ini");
}
