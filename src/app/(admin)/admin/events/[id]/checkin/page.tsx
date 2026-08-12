import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { QrBoard } from "@/features/entry/qr-board";
import { getDb } from "@/server/db/client";
import { events, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
export const dynamic = "force-dynamic";
export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(); const { id } = await params; const [event] = await getDb().select({ name: events.name, participationMode: events.participationMode, maxTicketsPerIssue: events.maxTicketsPerIssue }).from(events).where(eq(events.id, id)).limit(1); if (!event) notFound(); const types = event.participationMode === "onsite" ? await getDb().select({ id: ticketTypes.id, name: ticketTypes.name }).from(ticketTypes).where(eq(ticketTypes.eventId, id)).orderBy(asc(ticketTypes.sortOrder)) : []; return <QrBoard eventId={id} eventName={event.name} backHref={`/admin/events/${id}`} participationMode={event.participationMode} maxTicketsPerIssue={event.maxTicketsPerIssue} ticketTypes={types} />; }
