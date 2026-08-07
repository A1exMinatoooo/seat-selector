import "server-only";
import { cookies } from "next/headers";
import { signJson, verifyJson } from "./signed-token";

type Expiring = { exp: number };
export type EntryClaim = Expiring & { eventId: string; code: string };
export type ParticipantClaim = Expiring & { eventId: string; participantId: string; code: string };
export type IdentityClaim = Expiring & { eventId: string; participantId: string; code: string };
export type LocationClaim = Expiring & { eventId: string; participantId: string; verifiedAt: number };
async function read<T extends Expiring>(name: string, purpose: string): Promise<T | null> { const token = (await cookies()).get(name)?.value; if (!token) return null; const claim = verifyJson<T>(token, purpose); return claim && claim.exp > Date.now() ? claim : null; }
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export async function setEntryClaim(claim: Omit<EntryClaim, "exp">) { (await cookies()).set("ps_entry", signJson({ ...claim, exp: Date.now() + 300_000 }, "entry-cookie"), { ...cookieOptions, maxAge: 300 }); }
export async function getEntryClaim() { return read<EntryClaim>("ps_entry", "entry-cookie"); }
export async function setParticipantClaim(claim: Omit<ParticipantClaim, "exp">) { (await cookies()).set("ps_participant", signJson({ ...claim, exp: Date.now() + 43_200_000 }, "participant-cookie"), { ...cookieOptions, maxAge: 43_200 }); }
export async function getParticipantClaim() { return read<ParticipantClaim>("ps_participant", "participant-cookie"); }
export function createIdentityClaim(claim: Omit<IdentityClaim, "exp">) { return signJson({ ...claim, exp: Date.now() + 120_000 }, "identity-claim"); }
export function verifyIdentityClaim(token: string) { const claim = verifyJson<IdentityClaim>(token, "identity-claim"); return claim && claim.exp > Date.now() ? claim : null; }
export async function setLocationClaim(claim: Omit<LocationClaim, "exp">) { (await cookies()).set("ps_location", signJson({ ...claim, exp: Date.now() + 120_000 }, "location-cookie"), { ...cookieOptions, maxAge: 120 }); }
export async function getLocationClaim() { return read<LocationClaim>("ps_location", "location-cookie"); }
