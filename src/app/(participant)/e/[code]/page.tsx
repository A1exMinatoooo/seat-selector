import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ParticipantEntry } from "@/features/entry/participant-entry";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { getLocationClaim, getParticipantClaim } from "@/server/security/participant-session";
export const dynamic = "force-dynamic";
export default async function ParticipantPage({ params }: { params: Promise<{ code: string }> }) { const { code } = await params; const [event] = await getDb().select({ id: events.id, name: events.name }).from(events).where(and(eq(events.publicCode, code), eq(events.status, "open"))).limit(1); if (!event) notFound(); const [participant, location] = await Promise.all([getParticipantClaim(), getLocationClaim()]); if (participant?.eventId === event.id && location?.participantId === participant.participantId) return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">验证完成</p><h1>准备选座</h1><p>座位图即将开放。</p></section></main>; return <ParticipantEntry code={code} eventName={event.name} />; }
