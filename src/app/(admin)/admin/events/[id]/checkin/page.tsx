import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { QrBoard } from "@/features/entry/qr-board";
import { getDb } from "@/server/db/client";
import { consecutiveCheckinLinks, events, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
export const dynamic = "force-dynamic";
export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [event] = await getDb()
    .select({
      name: events.name,
      participationMode: events.participationMode,
      maxTicketsPerIssue: events.maxTicketsPerIssue,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!event) notFound();
  const linked =
    event.participationMode === "onsite"
      ? await getDb()
          .select({
            id: events.id,
            name: events.name,
            maxTicketsPerIssue: events.maxTicketsPerIssue,
            startsAt: events.startsAt,
          })
          .from(consecutiveCheckinLinks)
          .innerJoin(events, eq(events.id, consecutiveCheckinLinks.targetEventId))
          .where(eq(consecutiveCheckinLinks.sourceEventId, id))
          .orderBy(asc(events.startsAt))
      : [];
  const issueEvents = [
    { id, name: event.name, maxTicketsPerIssue: event.maxTicketsPerIssue },
    ...linked,
  ];
  const allTypes =
    event.participationMode === "onsite"
      ? await getDb()
          .select({ id: ticketTypes.id, eventId: ticketTypes.eventId, name: ticketTypes.name })
          .from(ticketTypes)
          .where(
            inArray(
              ticketTypes.eventId,
              issueEvents.map((item) => item.id),
            ),
          )
          .orderBy(asc(ticketTypes.sortOrder))
      : [];
  return (
    <QrBoard
      eventId={id}
      eventName={event.name}
      backHref={`/admin/events/${id}`}
      participationMode={event.participationMode}
      maxTicketsPerIssue={event.maxTicketsPerIssue}
      ticketTypes={allTypes.filter((type) => type.eventId === id)}
      issueEvents={issueEvents.map((item) => ({
        id: item.id,
        name: item.name,
        maxTicketsPerIssue: item.maxTicketsPerIssue,
        ticketTypes: allTypes.filter((type) => type.eventId === item.id),
      }))}
    />
  );
}
