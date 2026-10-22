import { redirect } from "next/navigation";

// Halaman admin lama diganti Master Data yang bisa diedit langsung.
export default function AdminPage() {
  redirect("/master");
}
