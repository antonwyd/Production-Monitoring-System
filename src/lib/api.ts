import "server-only";
import { HttpError } from "./auth";
import { BackendError } from "./backend";
import { ValidationError } from "./service";

/** Bungkus handler API: ubah error menjadi JSON dengan status yang tepat. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof ValidationError) return Response.json({ error: e.message, errors: e.errors }, { status: 422 });
    if (e instanceof BackendError) return Response.json({ error: e.message }, { status: 502 });
    console.error(e);
    return Response.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new HttpError(400, "Body harus JSON.");
  }
}
