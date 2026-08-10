import { TodayRecordsView } from "@/features/records/today-records-view";
import { findDailySeatRecordRows } from "@/server/db/daily-seat-records";
import { assembleDailySeatRecords, shanghaiDayWindow } from "@/server/domain/daily-seat-records";
import { getCurrentDeviceHash } from "@/server/security/participant-auth";

export const dynamic = "force-dynamic";

export default async function TodayRecordsPage() {
  const { date, start, end } = shanghaiDayWindow();
  const deviceHash = await getCurrentDeviceHash();
  if (!deviceHash) return <TodayRecordsView date={date} devicePresent={false} records={[]} />;
  const records = assembleDailySeatRecords(await findDailySeatRecordRows(deviceHash, start, end));
  return <TodayRecordsView date={date} devicePresent records={records} />;
}
