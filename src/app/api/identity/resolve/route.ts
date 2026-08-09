import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveIdentity } from "@/server/domain/identity";
import { getDb } from "@/server/db/client";
import { events, participants } from "@/server/db/schema";
import { recordEventAudit } from "@/server/domain/event-audit";
import {
  createIdentityCandidateClaim,
  createIdentityClaim,
  getEntryClaim,
  verifyIdentityCandidateClaim,
} from "@/server/security/participant-session";
import { rateLimit } from "@/server/security/rate-limit";
import { apiFailure, assertSameOrigin, clientAddress } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";
import { maskPhone } from "@/shared/phone";
const schema = z.object({
  code: z.string().min(1).max(128),
  tail: z.string().regex(/^\d{4}$/),
  fullPhone: z
    .string()
    .regex(/^\d{7,15}$/)
    .optional(),
  candidateToken: z.string().min(20).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!rateLimit(`identity:${clientAddress(request)}`, 20, 60_000))
      return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
    const input = schema.parse(await request.json());
    const entry = await getEntryClaim();
    const [event] = await getDb()
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.publicCode, input.code), eq(events.status, "open")))
      .limit(1);
    if (!entry || !event || entry.eventId !== event.id)
      throw new DomainError(errorCodes.forbidden, "Scan required", 403);

    if (input.candidateToken) {
      const candidate = verifyIdentityCandidateClaim(input.candidateToken);
      if (
        !candidate ||
        candidate.eventId !== event.id ||
        candidate.code !== input.code ||
        candidate.tail !== input.tail
      )
        throw new DomainError(
          errorCodes.identityCandidateInvalid,
          "Identity candidate is invalid",
          400,
        );
      const [selected] = await getDb()
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.id, candidate.participantId),
            eq(participants.eventId, event.id),
            eq(participants.phoneLast4, input.tail),
            eq(participants.phoneIsFull, false),
          ),
        )
        .limit(1);
      if (!selected)
        throw new DomainError(
          errorCodes.identityCandidateInvalid,
          "Identity candidate is invalid",
          400,
        );
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "identity_candidate_selected",
          eventId: event.id,
          tailLast4: input.tail,
          candidateCount: candidate.candidateCount,
          selectedParticipantId: selected.id,
        }),
      );
      return Response.json({
        status: "resolved",
        participantId: selected.id,
        claim: createIdentityClaim({
          eventId: event.id,
          participantId: selected.id,
          code: input.code,
        }),
      });
    }

    const candidates = await getDb()
      .select({
        id: participants.id,
        name: participants.name,
        nameFirst: participants.nameFirst,
        phoneDigits: participants.phoneDigits,
        phoneIsFull: participants.phoneIsFull,
      })
      .from(participants)
      .where(and(eq(participants.eventId, event.id), eq(participants.phoneLast4, input.tail)));
    if (!candidates.length)
      throw new DomainError(errorCodes.identityMismatch, "No participant", 404);
    const result = resolveIdentity(candidates, input.fullPhone);
    if (input.fullPhone && result.status === "full-phone")
      throw new DomainError(errorCodes.identityMismatch, "Full phone does not match", 404);
    if (result.status === "resolved")
      return Response.json({
        ...result,
        claim: createIdentityClaim({
          eventId: event.id,
          participantId: result.participantId,
          code: input.code,
        }),
      });

    const choiceCandidates =
      result.status === "participant-choice" ? result.candidates : result.tailOnlyCandidates;
    if (choiceCandidates.length > 0) {
      await recordEventAudit({
        eventId: event.id,
        action: "identity_tail_choice_required",
        level: "warn",
        details: { tailLast4: input.tail, candidateCount: choiceCandidates.length },
      });
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "identity_tail_choice_required",
          eventId: event.id,
          tailLast4: input.tail,
          candidateCount: choiceCandidates.length,
        }),
      );
    }
    const responseCandidates = choiceCandidates.map((candidate) => ({
      name: candidate.name,
      phone: maskPhone(candidate.phoneDigits, candidate.phoneIsFull),
      token: createIdentityCandidateClaim({
        eventId: event.id,
        participantId: candidate.id,
        code: input.code,
        tail: input.tail,
        candidateCount: choiceCandidates.length,
      }),
    }));
    return Response.json({ status: result.status, candidates: responseCandidates });
  } catch (error) {
    return apiFailure(error);
  }
}
