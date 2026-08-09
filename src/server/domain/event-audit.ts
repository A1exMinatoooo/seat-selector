import "server-only";

import { getDb } from "@/server/db/client";
import { auditAction, auditLevel, eventAuditLogs } from "@/server/db/schema";

export type AuditAction = (typeof auditAction.enumValues)[number];
export type AuditLevel = (typeof auditLevel.enumValues)[number];

export type EventAuditInput = {
  eventId: string;
  participantId?: string;
  action: AuditAction;
  level?: AuditLevel;
  details?: Record<string, unknown>;
};

export async function recordEventAudit(input: EventAuditInput): Promise<void> {
  await getDb()
    .insert(eventAuditLogs)
    .values({
      eventId: input.eventId,
      participantId: input.participantId,
      action: input.action,
      level: input.level,
      details: input.details ?? {},
    });
}
