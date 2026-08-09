export type IdentityCandidate = {
  id: string;
  name: string;
  nameFirst: string;
  phoneDigits: string;
  phoneIsFull: boolean;
};

export type IdentityStep =
  | { status: "full-phone"; tailOnlyCandidates: IdentityCandidate[] }
  | { status: "participant-choice"; candidates: IdentityCandidate[] }
  | { status: "resolved"; participantId: string };

export function resolveIdentity(
  candidates: IdentityCandidate[],
  phoneRemainder?: { digits: string; tail: string },
): IdentityStep {
  if (candidates.length === 1) return { status: "resolved", participantId: candidates[0]!.id };

  const fullPhoneCandidates = candidates.filter((candidate) => candidate.phoneIsFull);
  const tailOnlyCandidates = candidates.filter((candidate) => !candidate.phoneIsFull);

  if (phoneRemainder) {
    const fullPhone = `${phoneRemainder.digits}${phoneRemainder.tail}`;
    const matched = fullPhoneCandidates.find((candidate) => candidate.phoneDigits === fullPhone);
    if (matched) return { status: "resolved", participantId: matched.id };
  }

  if (fullPhoneCandidates.length > 0) return { status: "full-phone", tailOnlyCandidates };
  if (tailOnlyCandidates.length === 1)
    return { status: "resolved", participantId: tailOnlyCandidates[0]!.id };
  return { status: "participant-choice", candidates: tailOnlyCandidates };
}
