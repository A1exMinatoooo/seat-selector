import { parse } from "csv-parse/sync";
import { z } from "zod";

export type TicketColumn = { id: string; name: string };
export type ParticipantImportRow = { name: string; nameFirst: string; phoneDigits: string; phoneLast4: string; phoneIsFull: boolean; tickets: Array<{ ticketTypeId: string; quantity: number }>; ticketTotal: number };

const baseRowSchema = z.object({ 姓名: z.string().trim().min(1).max(80), 手机号或尾号: z.string().trim().regex(/^\+?\d[\d\s-]{2,19}$/) }).passthrough();
const participantInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?\d[\d\s-]{2,19}$/),
  quantities: z.record(z.string(), z.unknown()),
});

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function participantRow(name: string, phone: string, ticketTypes: TicketColumn[], quantities: (ticket: TicketColumn) => unknown): ParticipantImportRow {
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length !== 4 && (phoneDigits.length < 7 || phoneDigits.length > 15)) throw new Error("手机号或尾号格式无效");
  const tickets = ticketTypes.map((ticket) => {
    const value = quantities(ticket);
    const quantity = z.coerce.number().int().min(0).max(20).parse(value === "" || value === undefined ? 0 : value);
    return { ticketTypeId: ticket.id, quantity };
  }).filter((ticket) => ticket.quantity > 0);
  const ticketTotal = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  if (ticketTotal < 1) throw new Error("至少需要一张票");
  return { name, nameFirst: Array.from(name)[0] ?? "", phoneDigits, phoneLast4: phoneDigits.slice(-4), phoneIsFull: phoneDigits.length > 4, tickets, ticketTotal };
}

export function createParticipantCsvTemplate(ticketTypes: TicketColumn[]): string {
  return `\uFEFF${["姓名", "手机号或尾号", ...ticketTypes.map((ticket) => ticket.name)].map(csvCell).join(",")}\r\n`;
}

export function parseParticipantInput(input: unknown, ticketTypes: TicketColumn[]): ParticipantImportRow {
  const parsed = participantInputSchema.parse(input);
  const row = participantRow(parsed.name, parsed.phone, ticketTypes, (ticket) => parsed.quantities[ticket.id]);
  validateResolvable([row]);
  return row;
}

export function parseParticipantCsv(source: string, ticketTypes: TicketColumn[]): ParticipantImportRow[] {
  const records = parse(source.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  if (records.length > 2000) throw new Error("一次最多导入 2000 名参与者");
  const rows = records.map((raw, index) => {
    const base = baseRowSchema.parse(raw);
    try {
      return participantRow(base.姓名, base.手机号或尾号, ticketTypes, (ticket) => raw[ticket.name] ?? "0");
    } catch (error) {
      throw new Error(`第 ${index + 2} 行${error instanceof Error ? error.message : "格式无效"}`, { cause: error });
    }
  });
  validateResolvable(rows);
  return rows;
}

export function validateResolvable(rows: ParticipantImportRow[]): void {
  const phones = new Set<string>();
  const groups = new Map<string, ParticipantImportRow[]>();
  for (const row of rows) {
    if (phones.has(row.phoneDigits)) throw new Error(`手机号或尾号重复：${row.phoneLast4}`);
    phones.add(row.phoneDigits);
    const key = `${row.phoneLast4}:${row.nameFirst}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length > 1 && group.some((row) => !row.phoneIsFull)) throw new Error(`尾号 ${group[0]?.phoneLast4 ?? ""} 与姓名首字仍冲突，请补录完整手机号`);
  }
}
