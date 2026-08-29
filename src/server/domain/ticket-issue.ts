import "server-only";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, participants, participantTickets, reservations, ticketIssues, ticketTypes } from "@/server/db/schema";
import { tokenHash } from "@/server/security/crypto";
import { createTicketIssueToken, verifyTicketIssueToken } from "@/server/security/ticket-issue-token";
import { DomainError, errorCodes } from "@/shared/errors";
import { hasOnsiteLotteryCapacity, ticketIssueAllocationSchema, ticketIssueTotal } from "./ticket-issue-rules";

export type TicketIssueStatus = "active" | "claimed" | "expired" | "cancelled";

export async function createTicketIssue(eventId: string, rawAllocation: unknown, now = Date.now()) {
  const allocation = ticketIssueAllocationSchema.parse(rawAllocation);
  return getDb().transaction(async (tx) => {
    const [event] = await tx.select({ id: events.id, publicCode: events.publicCode, name: events.name, status: events.status, participationMode: events.participationMode, maxTicketsPerIssue: events.maxTicketsPerIssue }).from(events).where(eq(events.id, eventId)).limit(1).for("update");
    if (!event || event.status !== "open" || event.participationMode !== "onsite") throw new DomainError(errorCodes.eventConflict, "活动未开放现场发行", 409);
    const ticketTotal = ticketIssueTotal(allocation);
    if (ticketTotal < 1 || ticketTotal > event.maxTicketsPerIssue) throw new DomainError(errorCodes.validation, "发行张数超出活动上限", 400);
    const validTypes = await tx.select({ id: ticketTypes.id, name: ticketTypes.name }).from(ticketTypes).where(and(eq(ticketTypes.eventId, eventId), inArray(ticketTypes.id, allocation.map((item) => item.ticketTypeId))));
    if (validTypes.length !== allocation.length) throw new DomainError(errorCodes.validation, "票种不属于该活动", 400);
    const created = createTicketIssueToken(event.publicCode, now);
    await tx.insert(ticketIssues).values({ id: created.issueId, eventId, tokenNonce: created.nonce, tokenHash: created.tokenHash, allocation, issuedAt: created.issuedAt, expiresAt: created.expiresAt });
    await tx.insert(eventAuditLogs).values({ eventId, action: "ticket_issue_created", details: { issueId: created.issueId, ticketTotal, tickets: allocation.map((item) => ({ name: validTypes.find((type) => type.id === item.ticketTypeId)?.name ?? "未知票种", quantity: item.quantity })) } });
    return { ...created, publicCode: event.publicCode, eventName: event.name, allocation: allocation.map((item) => ({ ...item, name: validTypes.find((type) => type.id === item.ticketTypeId)?.name ?? "未知票种" })) };
  });
}

export async function ticketIssueStatus(eventId: string, issueId: string, now = Date.now()): Promise<TicketIssueStatus> {
  const [issue] = await getDb().select({ consumedAt: ticketIssues.consumedAt, invalidatedAt: ticketIssues.invalidatedAt, expiresAt: ticketIssues.expiresAt }).from(ticketIssues).where(and(eq(ticketIssues.id, issueId), eq(ticketIssues.eventId, eventId))).limit(1);
  if (!issue) throw new DomainError(errorCodes.notFound, "发行记录不存在", 404);
  if (issue.consumedAt) return "claimed";
  if (issue.invalidatedAt) return "cancelled";
  if (issue.expiresAt.getTime() <= now) return "expired";
  return "active";
}

export async function cancelTicketIssue(eventId: string, issueId: string, now = Date.now()): Promise<Exclude<TicketIssueStatus, "active">> {
  return getDb().transaction(async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1).for("update");
    if (!event) throw new DomainError(errorCodes.notFound, "活动不存在", 404);
    const [issue] = await tx.select({ consumedAt: ticketIssues.consumedAt, invalidatedAt: ticketIssues.invalidatedAt, expiresAt: ticketIssues.expiresAt }).from(ticketIssues).where(and(eq(ticketIssues.id, issueId), eq(ticketIssues.eventId, eventId))).limit(1).for("update");
    if (!issue) throw new DomainError(errorCodes.notFound, "发行记录不存在", 404);
    if (issue.consumedAt) return "claimed";
    if (issue.invalidatedAt) return "cancelled";
    if (issue.expiresAt.getTime() <= now) return "expired";
    const [cancelled] = await tx.update(ticketIssues).set({ invalidatedAt: new Date(now) }).where(and(eq(ticketIssues.id, issueId), eq(ticketIssues.eventId, eventId), isNull(ticketIssues.consumedAt), isNull(ticketIssues.invalidatedAt))).returning({ id: ticketIssues.id });
    if (!cancelled) throw new DomainError(errorCodes.eventConflict, "二维码状态已变化", 409);
    return "cancelled";
  });
}

export async function claimTicketIssue(publicCode: string, token: string, deviceHash: string, now = Date.now()) {
  const payload = verifyTicketIssueToken(publicCode, token, now);
  if (!payload) throw new DomainError(errorCodes.ticketIssueExpired, "二维码已过期", 403);
  return getDb().transaction(async (tx) => {
    const [issueRef] = await tx.select({ eventId: ticketIssues.eventId }).from(ticketIssues).where(eq(ticketIssues.id, payload.issueId)).limit(1);
    if (!issueRef) throw new DomainError(errorCodes.ticketIssueClaimed, "二维码已领取或失效", 409);
    const [event] = await tx.select({ id: events.id, publicCode: events.publicCode, status: events.status, participationMode: events.participationMode, lotteryEnabled: events.lotteryEnabled, expectedLotteryTickets: events.expectedLotteryTickets, nextIssueNumber: events.nextIssueNumber }).from(events).where(eq(events.id, issueRef.eventId)).limit(1).for("update");
    if (!event || event.publicCode !== publicCode || event.status !== "open" || event.participationMode !== "onsite") throw new DomainError(errorCodes.eventConflict, "活动未开放现场发行", 409);
    const [issue] = await tx.select().from(ticketIssues).where(eq(ticketIssues.id, payload.issueId)).limit(1).for("update");
    if (!issue || issue.tokenNonce !== payload.nonce || issue.tokenHash !== tokenHash(token) || issue.consumedAt || issue.invalidatedAt || issue.expiresAt.getTime() <= now) throw new DomainError(errorCodes.ticketIssueClaimed, "二维码已领取或失效", 409);
    const types = await tx.select({ id: ticketTypes.id, lotteryEligible: ticketTypes.lotteryEligible }).from(ticketTypes).where(eq(ticketTypes.eventId, event.id));
    const typeById = new Map(types.map((type) => [type.id, type]));
    if (issue.allocation.some((item) => !typeById.has(item.ticketTypeId))) throw new DomainError(errorCodes.validation, "发行票种已失效", 400);
    const newEligible = issue.allocation.reduce((sum, item) => sum + (typeById.get(item.ticketTypeId)?.lotteryEligible ? item.quantity : 0), 0);
    const [existing] = await tx.select({ id: participants.id, issueNumber: participants.issueNumber }).from(participants).where(and(eq(participants.eventId, event.id), eq(participants.deviceHash, deviceHash), eq(participants.source, "onsite"))).limit(1).for("update");
    if (existing) {
      const [reservation] = await tx.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.eventId, event.id), eq(reservations.participantId, existing.id))).limit(1);
      if (reservation) throw new DomainError(errorCodes.ticketIssueSelectionExists, "设备已完成选座", 409);
    }
    const oldEligibleRows = existing ? await tx.select({ quantity: participantTickets.quantity, lotteryEligible: ticketTypes.lotteryEligible }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(eq(participantTickets.participantId, existing.id)) : [];
    const oldEligible = oldEligibleRows.reduce((sum, row) => sum + (row.lotteryEligible ? row.quantity : 0), 0);
    if (event.lotteryEnabled) {
      const [used] = await tx.select({ total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int` }).from(participantTickets).innerJoin(participants, eq(participants.id, participantTickets.participantId)).innerJoin(ticketTypes, eq(ticketTypes.id, participantTickets.ticketTypeId)).where(and(eq(participants.eventId, event.id), eq(participants.source, "onsite"), eq(ticketTypes.lotteryEligible, true), existing ? ne(participants.id, existing.id) : sql`true`));
      if (!hasOnsiteLotteryCapacity(Number(used?.total ?? 0), newEligible, event.expectedLotteryTickets ?? 0)) throw new DomainError(errorCodes.ticketIssueCapacity, "预计可抽奖票数额度不足", 409);
    }
    const ticketTotal = ticketIssueTotal(issue.allocation);
    let participantId: string;
    let replaced = false;
    if (existing) {
      participantId = existing.id;
      replaced = true;
      await tx.delete(participantTickets).where(eq(participantTickets.participantId, participantId));
      await tx.update(participants).set({ ticketTotal, deviceBoundAt: new Date(now) }).where(eq(participants.id, participantId));
    } else {
      const issueNumber = event.nextIssueNumber;
      const [created] = await tx.insert(participants).values({ eventId: event.id, nickname: `现场领取 #${String(issueNumber).padStart(4, "0")}`, nicknameFirst: "现", phoneDigits: "", phoneLast4: "", phoneIsFull: false, ticketTotal, source: "onsite", issueNumber, deviceHash, deviceBoundAt: new Date(now) }).returning({ id: participants.id });
      if (!created) throw new Error("Onsite participant creation failed");
      participantId = created.id;
      await tx.update(events).set({ nextIssueNumber: sql`${events.nextIssueNumber} + 1` }).where(eq(events.id, event.id));
    }
    await tx.insert(participantTickets).values(issue.allocation.map((item) => ({ participantId, ticketTypeId: item.ticketTypeId, quantity: item.quantity })));
    await tx.update(ticketIssues).set({ consumedAt: new Date(now), participantId }).where(and(eq(ticketIssues.id, issue.id), isNull(ticketIssues.consumedAt)));
    await tx.insert(eventAuditLogs).values({ eventId: event.id, participantId, action: replaced ? "ticket_issue_replaced" : "ticket_issue_claimed", details: { issueId: issue.id, ticketTotal, eligibleTickets: newEligible, replacedEligibleTickets: oldEligible } });
    return { eventId: event.id, participantId, code: publicCode };
  });
}
