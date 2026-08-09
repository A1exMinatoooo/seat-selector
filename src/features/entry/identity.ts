export type IdentityCandidate = { id: string; name: string; nameFirst: string; phoneDigits: string; phoneIsFull: boolean };
export type IdentityStep =
  | { status: "name-first" }
  | { status: "phone-prefix"; prefixLength: number; options: string[] }
  | { status: "participant-choice"; candidates: IdentityCandidate[] }
  | { status: "resolved"; participantId: string };

function prefixPrompt(candidates: IdentityCandidate[]): IdentityStep {
  const fullPhones = candidates.filter((candidate) => candidate.phoneIsFull);
  for (let length = 3; length <= 11; length += 1) {
    const options = [...new Set(fullPhones.map((candidate) => candidate.phoneDigits.slice(0, length)))];
    if (options.length > 1 || length === 11) return { status: "phone-prefix", prefixLength: length, options };
  }
  return { status: "phone-prefix", prefixLength: 3, options: [] };
}

export function resolveIdentity(candidates: IdentityCandidate[], nameFirst?: string, phonePrefix?: string): IdentityStep {
  if (candidates.length === 1) return { status: "resolved", participantId: candidates[0]!.id };

  const fullPhoneCandidates = candidates.filter((candidate) => candidate.phoneIsFull);
  if (fullPhoneCandidates.length && !phonePrefix) return prefixPrompt(candidates);

  let narrowed = candidates;
  if (phonePrefix) {
    const matchingFull = fullPhoneCandidates.filter((candidate) => candidate.phoneDigits.startsWith(phonePrefix));
    if (matchingFull.length === 1) return { status: "resolved", participantId: matchingFull[0]!.id };
    narrowed = candidates.filter((candidate) => !candidate.phoneIsFull || matchingFull.some((match) => match.id === candidate.id));
    if (matchingFull.length === 0) return prefixPrompt(candidates);
  }

  if (!nameFirst) return { status: "name-first" };
  const named = narrowed.filter((candidate) => candidate.nameFirst === Array.from(nameFirst)[0]);
  if (named.length === 1) return { status: "resolved", participantId: named[0]!.id };
  if (named.length > 1) return { status: "participant-choice", candidates: named };
  return { status: "name-first" };
}
