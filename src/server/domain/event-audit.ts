import "server-only";

import { getDb } from "@/server/db/client";
import { auditAction, eventAuditLogs } from "@/server/db/schema";

export type AuditAction = (typeof auditAction.enumValues)[number];

export type EventAuditInput = {
  eventId: string;
  participantId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
};

export async function recordEventAudit(input: EventAuditInput): Promise<void> {
  await getDb().insert(eventAuditLogs).values({
    eventId: input.eventId,
    participantId: input.participantId,
    action: input.action,
    details: input.details ?? {},
  });
}
