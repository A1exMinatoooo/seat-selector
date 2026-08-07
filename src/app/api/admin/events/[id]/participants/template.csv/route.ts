import { asc, eq } from "drizzle-orm";
import { createParticipantCsvTemplate } from "@/features/participants/import";
import { getDb } from "@/server/db/client";
import { events, ticketTypes } from "@/server/db/schema";
import { hasAdminSession } from "@/server/security/admin-session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const [event] = await getDb().select({ name: events.name }).from(events).where(eq(events.id, id)).limit(1);
  if (!event) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const types = await getDb().select({ id: ticketTypes.id, name: ticketTypes.name }).from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder));
  const filename = `${event.name}-参与者导入模板.csv`;
  return new Response(createParticipantCsvTemplate(types), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
