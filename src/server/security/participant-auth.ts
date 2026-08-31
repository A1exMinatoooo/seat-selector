import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  findClaimedParticipant,
  findOpenParticipantsByDevice,
} from "@/server/db/participant-device";
import { uniqueDeviceParticipant } from "@/server/domain/participant-reentry";
import { findRestorableConsecutiveWorkflow } from "@/server/domain/consecutive-checkin-workflow";
import { tokenHash } from "./crypto";
import {
  getConsecutiveWorkflowClaim,
  getParticipantClaim,
  setConsecutiveWorkflowClaim,
  setParticipantClaim,
} from "./participant-session";
import { DomainError, errorCodes } from "@/shared/errors";

export const participantEventCodeSchema = z.string().min(10).max(80);
const deviceTokenSchema = z.string().min(20).max(512);

export async function getCurrentDeviceHash(): Promise<string | null> {
  const parsed = deviceTokenSchema.safeParse((await cookies()).get("ps_device")?.value);
  return parsed.success ? tokenHash(parsed.data) : null;
}

export async function requireParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const claim = await getParticipantClaim();
  const deviceHash = await getCurrentDeviceHash();
  if (!parsedCode.success || !claim || claim.code !== parsedCode.data || !deviceHash)
    throw new DomainError(errorCodes.unauthorized, "Participant session required", 401);
  const row = await findClaimedParticipant(parsedCode.data, claim.participantId, deviceHash);
  if (!row) throw new DomainError(errorCodes.unauthorized, "Device binding invalid", 401);
  return row;
}

export async function findRestorableParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const deviceHash = await getCurrentDeviceHash();
  if (!parsedCode.success || !deviceHash) return null;
  return uniqueDeviceParticipant(await findOpenParticipantsByDevice(parsedCode.data, deviceHash));
}

export async function restoreParticipantForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  if (!parsedCode.success) return null;
  const participant = await findRestorableParticipantForEvent(parsedCode.data);
  if (!participant) return null;
  await setParticipantClaim({
    eventId: participant.eventId,
    participantId: participant.participantId,
    code: parsedCode.data,
  });
  return participant;
}

export async function requireConsecutiveWorkflowForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const claim = await getConsecutiveWorkflowClaim();
  const deviceHash = await getCurrentDeviceHash();
  if (!parsedCode.success || !claim || claim.code !== parsedCode.data || !deviceHash)
    throw new DomainError(errorCodes.unauthorized, "Consecutive workflow session required", 401);
  return { workflowId: claim.workflowId, deviceHash, code: parsedCode.data };
}

export async function findRestorableConsecutiveWorkflowForEvent(code: string) {
  const parsedCode = participantEventCodeSchema.safeParse(code);
  const deviceHash = await getCurrentDeviceHash();
  if (!parsedCode.success || !deviceHash) return null;
  return findRestorableConsecutiveWorkflow(parsedCode.data, deviceHash);
}

export async function restoreConsecutiveWorkflowForEvent(code: string) {
  const workflow = await findRestorableConsecutiveWorkflowForEvent(code);
  if (!workflow) return null;
  await setConsecutiveWorkflowClaim({ workflowId: workflow.id, code });
  return workflow;
}
