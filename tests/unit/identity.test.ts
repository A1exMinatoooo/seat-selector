import { describe, expect, it } from "vitest";
import { resolveIdentity } from "@/features/entry/identity";

const fullCandidates = [
  { id: "a", name: "张小明", nameFirst: "张", phoneDigits: "13800008000", phoneIsFull: true },
  { id: "b", name: "张小红", nameFirst: "张", phoneDigits: "13900008000", phoneIsFull: true },
];
const tailOnlyCandidates = [
  { id: "a", name: "张小明", nameFirst: "张", phoneDigits: "8000", phoneIsFull: false },
  { id: "b", name: "张小红", nameFirst: "张", phoneDigits: "8000", phoneIsFull: false },
];

describe("identity resolution", () => {
  it("prioritizes a full phone prefix when duplicate-tail candidates have full phones", () => {
    expect(resolveIdentity(fullCandidates).status).toBe("phone-prefix");
    expect(resolveIdentity(fullCandidates, undefined, "138")).toEqual({ status: "resolved", participantId: "a" });
  });

  it("asks for a name first when duplicate-tail candidates only have tail phones", () => {
    expect(resolveIdentity(tailOnlyCandidates).status).toBe("name-first");
  });

  it("returns candidates when the name first character is still ambiguous", () => {
    expect(resolveIdentity(tailOnlyCandidates, "张")).toEqual({ status: "participant-choice", candidates: tailOnlyCandidates });
  });

  it("resolves a unique name first character after the phone prefix narrowed the group", () => {
    expect(resolveIdentity(fullCandidates, "张", "138")).toEqual({ status: "resolved", participantId: "a" });
  });
});
