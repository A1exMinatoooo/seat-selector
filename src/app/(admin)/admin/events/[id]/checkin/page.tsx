import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { QrBoard } from "@/features/entry/qr-board";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
export const dynamic = "force-dynamic";
export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(); const { id } = await params; const [event] = await getDb().select({ name: events.name }).from(events).where(eq(events.id, id)).limit(1); if (!event) notFound(); return <QrBoard eventId={id} eventName={event.name} backHref={`/admin/events/${id}`} />; }
