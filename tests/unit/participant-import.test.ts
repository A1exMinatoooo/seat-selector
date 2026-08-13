import { describe, expect, it } from "vitest";
import { createParticipantCsvTemplate, parseParticipantCsv, parseParticipantInput } from "@/features/participants/import";

const types = [{ id: "type-1", name: "普通票" }, { id: "type-2", name: "学生票" }];

describe("participant CSV", () => {
  it("maps dynamic ticket columns", () => {
    const [row] = parseParticipantCsv("昵称,手机号或尾号,普通票,学生票\n影迷小北,13800138000,2,1", types);
    expect(row?.ticketTotal).toBe(3);
    expect(row?.phoneLast4).toBe("8000");
  });

  it("allows distinct nicknames to share a tail and first character", () => {
    expect(parseParticipantCsv("昵称,手机号或尾号,普通票,学生票\n影迷小北,8000,1,0\n影迷阿南,8000,1,0", types)).toHaveLength(2);
  });

  it("rejects the same nickname and full phone", () => {
    expect(() => parseParticipantCsv("昵称,手机号或尾号,普通票,学生票\n影迷小北,13800138000,1,0\n影迷小北,13800138000,1,0", types)).toThrow(/昵称和完整手机号重复/);
  });

  it("creates a UTF-8 template with dynamic and escaped ticket columns", () => {
    expect(createParticipantCsvTemplate([...types, { id: "type-3", name: "双人,套票" }])).toBe("\uFEFF昵称,手机号或尾号,普通票,学生票,\"双人,套票\"\r\n");
  });

  it("marks and parses lottery-eligible ticket columns", () => {
    const lotteryTypes = [{ id: "type-1", name: "普通票", lotteryEligible: true }];
    expect(createParticipantCsvTemplate(lotteryTypes)).toContain("普通票（参与抽奖）");
    expect(parseParticipantCsv("昵称,手机号或尾号,普通票（参与抽奖）\n爆米77,13800138000,2", lotteryTypes)[0]?.ticketTotal).toBe(2);
  });

  it("parses a manually entered participant with ticket allocations", () => {
    const row = parseParticipantInput({ nickname: "爆米77", phone: "5678", quantities: { "type-1": "0", "type-2": "2" } }, types);
    expect(row).toMatchObject({ nickname: "爆米77", phoneLast4: "5678", phoneIsFull: false, ticketTotal: 2 });
    expect(row.tickets).toEqual([{ ticketTypeId: "type-2", quantity: 2 }]);
  });

  it("rejects a manually entered participant without tickets", () => {
    expect(() => parseParticipantInput({ nickname: "爆米77", phone: "5678", quantities: {} }, types)).toThrow(/至少需要一张票/);
  });
});
