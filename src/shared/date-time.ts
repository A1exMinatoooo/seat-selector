export function formatDateTimeMilliseconds(value: Date, timeZone = "Asia/Shanghai"): string {
  return value.toLocaleString("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
}

type LocalDateTimeParts = {
  date: string;
  time: string;
};

function localParts(value: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value).map((part) => [part.type, part.value]));
}

export function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function supportedTimeZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("Asia/Shanghai") ? zones : ["Asia/Shanghai", ...zones];
}

export function formatLocalDateTime(value: Date, timeZone: string): LocalDateTimeParts {
  const parts = localParts(value, timeZone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function localDateTimeToDate(date: string, time: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !isSupportedTimeZone(timeZone)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day || hour === undefined || minute === undefined) return null;

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(wallClockAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localParts(candidate, timeZone);
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const difference = representedAsUtc - wallClockAsUtc;
    if (difference === 0) break;
    candidate = new Date(candidate.getTime() - difference);
  }
  const result = formatLocalDateTime(candidate, timeZone);
  return result.date === date && result.time === time ? candidate : null;
}
