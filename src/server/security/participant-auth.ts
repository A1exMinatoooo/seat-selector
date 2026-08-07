import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { findClaimedParticipant, findOpenParticipantsByDevice } from "@/server/db/participant-device";
import { uniqueDeviceParticipant } from "@/server/domain/participant-reentry";
import { tokenHash } from "./crypto";
import { getParticipantClaim, setParticipantClaim } from "./participant-session";
import { DomainError, errorCodes } from "@/shared/errors";

export const participantEventCodeSchema = z.string().min(10).max(80);

export async function requireParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const claim = await getParticipantClaim();
  const device = (await cookies()).get("ps_device")?.value;
  if (!parsedCode.success || !claim || claim.code !== parsedCode.data || !device) throw new DomainError(errorCodes.unauthorized, "Participant session required", 401);
  const row = await findClaimedParticipant(parsedCode.data, claim.participantId, tokenHash(device));
  if (!row) throw new DomainError(errorCodes.unauthorized, "Device binding invalid", 401);
  return row;
}

export async function findRestorableParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const device = (await cookies()).get("ps_device")?.value;
  if (!parsedCode.success || !device) return null;
  return uniqueDeviceParticipant(await findOpenParticipantsByDevice(parsedCode.data, tokenHash(device)));
}

export async function restoreParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  if (!parsedCode.success) return null;
  const participant = await findRestorableParticipantForEvent(parsedCode.data);
  if (!participant) return null;
  await setParticipantClaim({ eventId: participant.eventId, participantId: participant.participantId, code: parsedCode.data });
  return participant;
}
