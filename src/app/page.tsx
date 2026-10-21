import { redirect } from "next/navigation";
import { getSession, HOME_BY_ROLE } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  redirect(s ? HOME_BY_ROLE[s.role] : "/login");
}
