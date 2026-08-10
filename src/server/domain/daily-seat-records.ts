import { formatSeatLabel } from "@/shared/seat-label";
import { formatLocalDateTime, localDateTimeToDate } from "@/shared/date-time";

export const dailyRecordsTimeZone = "Asia/Shanghai";

export type DailyRecordBaseRow = {
  reservationId: string;
  participantId: string;
  eventName: string;
  cinemaName: string;
  hallName: string;
  startsAt: Date;
  confirmedAt: Date;
};

export type DailyRecordSeatRow = {
  reservationId: string;
  rowLabel: string;
  columnLabel: string;
};

export type DailyRecordTicketRow = {
  participantId: string;
  name: string;
  quantity: number;
};

export type DailyRecordLotteryRow = {
  participantId: string;
  drawIndex: number;
  prizeName: string | null;
};

export type DailySeatRecordSource = {
  reservations: DailyRecordBaseRow[];
  seats: DailyRecordSeatRow[];
  tickets: DailyRecordTicketRow[];
  lotteryResults: DailyRecordLotteryRow[];
};

export type DailySeatRecord = {
  reservationId: string;
  eventName: string;
  cinemaName: string;
  hallName: string;
  startsAt: string;
  confirmedAt: string;
  seats: string[];
  tickets: Array<{ name: string; quantity: number }>;
  lotteryResults: Array<{ drawIndex: number; prizeName: string | null }>;
};

function nextIsoDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid ISO date");
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function shanghaiDayWindow(now = new Date()): { date: string; start: Date; end: Date } {
  const date = formatLocalDateTime(now, dailyRecordsTimeZone).date;
  const start = localDateTimeToDate(date, "00:00", dailyRecordsTimeZone);
  const end = localDateTimeToDate(nextIsoDate(date), "00:00", dailyRecordsTimeZone);
  if (!start || !end) throw new Error("Could not calculate the Shanghai day window");
  return { date, start, end };
}

function grouped<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const row of rows) {
    const value = key(row);
    result.set(value, [...(result.get(value) ?? []), row]);
  }
  return result;
}

export function assembleDailySeatRecords(source: DailySeatRecordSource): DailySeatRecord[] {
  const seatsByReservation = grouped(source.seats, (row) => row.reservationId);
  const ticketsByParticipant = grouped(source.tickets, (row) => row.participantId);
  const lotteryByParticipant = grouped(source.lotteryResults, (row) => row.participantId);

  return [...source.reservations]
    .sort((left, right) => right.confirmedAt.getTime() - left.confirmedAt.getTime())
    .map((reservation) => ({
      reservationId: reservation.reservationId,
      eventName: reservation.eventName,
      cinemaName: reservation.cinemaName,
      hallName: reservation.hallName,
      startsAt: reservation.startsAt.toISOString(),
      confirmedAt: reservation.confirmedAt.toISOString(),
      seats: (seatsByReservation.get(reservation.reservationId) ?? []).map((seat) => formatSeatLabel(seat.rowLabel, seat.columnLabel)),
      tickets: (ticketsByParticipant.get(reservation.participantId) ?? []).map((ticket) => ({ name: ticket.name, quantity: ticket.quantity })),
      lotteryResults: (lotteryByParticipant.get(reservation.participantId) ?? []).map((result) => ({ drawIndex: result.drawIndex, prizeName: result.prizeName })),
    }));
}
