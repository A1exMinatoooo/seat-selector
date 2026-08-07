import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "not-ready" }, { status: 503 });
  }
}
