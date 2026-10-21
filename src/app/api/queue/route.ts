import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import { queueOverview } from "@/lib/service";
import type { SubmissionStatus } from "@/lib/types";

export async function GET(req: Request) {
  return handle(async () => {
    await requireApiRole(["leader", "admin"]);
    const url = new URL(req.url);
    const st = url.searchParams.get("status");
    const status: SubmissionStatus = st === "approved" || st === "rejected" ? st : "pending";
    const date = url.searchParams.get("date");
    return Response.json(await queueOverview(status, isValidDate(date) ? date : undefined));
  });
}
