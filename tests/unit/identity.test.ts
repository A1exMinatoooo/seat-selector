import { describe, expect, it } from "vitest";
import { resolveIdentity } from "@/features/entry/identity";
const candidates = [{ id: "a", nameFirst: "张", phoneDigits: "13800008000", phoneIsFull: true }, { id: "b", nameFirst: "李", phoneDigits: "13900008000", phoneIsFull: true }];
describe("identity resolution", () => { it("asks only for a name first character on a tail collision", () => expect(resolveIdentity(candidates).status).toBe("name-first")); it("resolves a unique name first character", () => expect(resolveIdentity(candidates, "张")).toEqual({ status: "resolved", participantId: "a" })); });
