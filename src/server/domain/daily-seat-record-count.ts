import "server-only";

import { countDailySeatRecordsByDevice } from "@/server/db/daily-seat-records";
import { shanghaiDayWindow } from "./daily-seat-records";

export async function countTodaySeatRecords(deviceHash: string, now = new Date()): Promise<number> {
  const { start, end } = shanghaiDayWindow(now);
  return countDailySeatRecordsByDevice(deviceHash, start, end);
}
