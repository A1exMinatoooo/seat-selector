import { describe, expect, it } from "vitest";
import { resolveIdentity } from "@/server/domain/identity";

const fullCandidates = [
  { id: "a", name: "张小明", nameFirst: "张", phoneDigits: "13800008000", phoneIsFull: true },
  { id: "b", name: "张小红", nameFirst: "张", phoneDigits: "13900008000", phoneIsFull: true },
];
const tailOnlyCandidates = [
  { id: "a", name: "张小明", nameFirst: "张", phoneDigits: "8000", phoneIsFull: false },
  { id: "b", name: "张小红", nameFirst: "张", phoneDigits: "8000", phoneIsFull: false },
];

describe("identity resolution", () => {
  it("requires an exact full phone when full numbers were recorded", () => {
    expect(resolveIdentity(fullCandidates)).toEqual({
      status: "full-phone",
      tailOnlyCandidates: [],
    });
    expect(resolveIdentity(fullCandidates, "13800008000")).toEqual({
      status: "resolved",
      participantId: "a",
    });
    expect(resolveIdentity(fullCandidates, "13899998000")).toEqual({
      status: "full-phone",
      tailOnlyCandidates: [],
    });
  });

  it("requires the full phone even when its tail is unique", () => {
    expect(resolveIdentity(fullCandidates.slice(0, 1))).toEqual({
      status: "full-phone",
      tailOnlyCandidates: [],
    });
  });

  it("returns every matching participant when only tails were recorded", () => {
    expect(resolveIdentity(tailOnlyCandidates)).toEqual({
      status: "participant-choice",
      candidates: tailOnlyCandidates,
    });
  });

  it("does not require a choice for one tail-only participant", () => {
    expect(resolveIdentity(tailOnlyCandidates.slice(0, 1))).toEqual({
      status: "resolved",
      participantId: "a",
    });
  });

  it("keeps full-phone verification separate from tail-only choices", () => {
    expect(resolveIdentity([...fullCandidates, ...tailOnlyCandidates])).toEqual({
      status: "full-phone",
      tailOnlyCandidates,
    });
  });
});
