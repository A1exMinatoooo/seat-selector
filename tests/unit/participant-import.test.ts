import { describe, expect, it } from "vitest";
import { parseParticipantCsv } from "@/features/participants/import";

const types = [{ id: "type-1", name: "普通票" }, { id: "type-2", name: "学生票" }];

describe("participant CSV", () => {
  it("maps dynamic ticket columns", () => {
    const [row] = parseParticipantCsv("姓名,手机号或尾号,普通票,学生票\n张小明,13800138000,2,1", types);
    expect(row?.ticketTotal).toBe(3);
    expect(row?.phoneLast4).toBe("8000");
  });

  it("rejects an unresolvable name-first and tail collision", () => {
    expect(() => parseParticipantCsv("姓名,手机号或尾号,普通票,学生票\n张小明,8000,1,0\n张晓,8000,1,0", types)).toThrow(/补录完整手机号|重复/);
  });
});
