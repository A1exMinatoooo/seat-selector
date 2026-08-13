import { parse } from "csv-parse/sync";
import { z } from "zod";

export type TicketColumn = { id: string; name: string; lotteryEligible?: boolean };
export type ParticipantImportRow = { nickname: string; nicknameFirst: string; phoneDigits: string; phoneLast4: string; phoneIsFull: boolean; tickets: Array<{ ticketTypeId: string; quantity: number }>; ticketTotal: number };

const baseRowSchema = z.object({ 昵称: z.string().trim().min(1).max(80), 手机号或尾号: z.string().trim().regex(/^\+?\d[\d\s-]{2,19}$/) }).passthrough();
const participantInputSchema = z.object({
  nickname: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?\d[\d\s-]{2,19}$/),
  quantities: z.record(z.string(), z.unknown()),
});

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function participantRow(nickname: string, phone: string, ticketTypes: TicketColumn[], quantities: (ticket: TicketColumn) => unknown): ParticipantImportRow {
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length !== 4 && (phoneDigits.length < 7 || phoneDigits.length > 15)) throw new Error("手机号或尾号格式无效");
  const tickets = ticketTypes.map((ticket) => {
    const value = quantities(ticket);
    const quantity = z.coerce.number().int().min(0).max(20).parse(value === "" || value === undefined ? 0 : value);
    return { ticketTypeId: ticket.id, quantity };
  }).filter((ticket) => ticket.quantity > 0);
  const ticketTotal = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  if (ticketTotal < 1) throw new Error("至少需要一张票");
  return { nickname, nicknameFirst: Array.from(nickname)[0] ?? "", phoneDigits, phoneLast4: phoneDigits.slice(-4), phoneIsFull: phoneDigits.length > 4, tickets, ticketTotal };
}

export function createParticipantCsvTemplate(ticketTypes: TicketColumn[]): string {
  return `\uFEFF${["昵称", "手机号或尾号", ...ticketTypes.map(ticketColumnName)].map(csvCell).join(",")}\r\n`;
}

export function ticketColumnName(ticket: TicketColumn): string {
  return ticket.lotteryEligible ? `${ticket.name}（参与抽奖）` : ticket.name;
}

export function parseParticipantInput(input: unknown, ticketTypes: TicketColumn[]): ParticipantImportRow {
  const parsed = participantInputSchema.parse(input);
  const row = participantRow(parsed.nickname, parsed.phone, ticketTypes, (ticket) => parsed.quantities[ticket.id]);
  validateResolvable([row]);
  return row;
}

export function parseParticipantCsv(source: string, ticketTypes: TicketColumn[]): ParticipantImportRow[] {
  const records = parse(source.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  if (records.length > 2000) throw new Error("一次最多导入 2000 名参与者");
  const rows = records.map((raw, index) => {
    const base = baseRowSchema.parse(raw);
    try {
      return participantRow(base.昵称, base.手机号或尾号, ticketTypes, (ticket) => raw[ticketColumnName(ticket)] ?? raw[ticket.name] ?? "0");
    } catch (error) {
      throw new Error(`第 ${index + 2} 行${error instanceof Error ? error.message : "格式无效"}`, { cause: error });
    }
  });
  validateResolvable(rows);
  return rows;
}

export function validateResolvable(rows: ParticipantImportRow[]): void {
  const fullPhoneNicknames = new Set<string>();
  const groups = new Map<string, ParticipantImportRow[]>();
  for (const row of rows) {
    const fullPhoneNickname = row.phoneIsFull ? `${row.phoneDigits}:${row.nickname}` : null;
    if (fullPhoneNickname && fullPhoneNicknames.has(fullPhoneNickname)) throw new Error(`昵称和完整手机号重复：${row.nickname}`);
    if (fullPhoneNickname) fullPhoneNicknames.add(fullPhoneNickname);
    const key = `${row.phoneLast4}:${row.nicknameFirst}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
}
