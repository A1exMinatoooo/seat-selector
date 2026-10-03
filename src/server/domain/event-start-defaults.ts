import { formatLocalDateTime } from "@/shared/date-time";

export function eventStartDefaults(now: Date, timeZone: string) {
  const current = formatLocalDateTime(now, timeZone);
  const hour = Number(current.time.slice(0, 2));
  const minute = Number(current.time.slice(3, 5));
  const nextMinutes = hour * 60 + (Math.floor(minute / 5) + 1) * 5;

  // The requested date remains today, including when the time wraps to midnight.
  return {
    date: current.date,
    time: `${String(Math.floor(nextMinutes / 60) % 24).padStart(2, "0")}:${String(nextMinutes % 60).padStart(2, "0")}`,
  };
}
