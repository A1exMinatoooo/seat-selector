import { ReservationTicket } from "@/features/seating/reservation-ticket";
import type { DailySeatRecord } from "@/server/domain/daily-seat-records";

const timeZone = "Asia/Shanghai";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function TodayRecordsView({ date, devicePresent, records }: { date: string; devicePresent: boolean; records: DailySeatRecord[] }) {
  return <main className="today-records-page">
    <header className="today-records-heading">
      <h1>当日选座记录</h1>
      <p className="today-records-date">{date}</p>
      <p>以下时间均为北京时间（Asia/Shanghai）。</p>
    </header>
    {!devicePresent ? <section className="today-records-empty" role="status"><h2>未识别到当前设备</h2><p>请使用完成选座时的同一微信扫描“今日选座记录”二维码。</p></section> : null}
    {devicePresent && records.length === 0 ? <section className="today-records-empty" role="status"><h2>今日暂无选座记录</h2><p>当前设备今天还没有完成选座。</p></section> : null}
    {records.length > 0 ? <ol className="today-records-list">{records.map((record) => <li key={record.reservationId}>
      <ReservationTicket
        eventName={record.eventName}
        seats={record.seats}
        tickets={record.tickets}
        lotteryResults={record.lotteryResults}
        confirmedAt={record.confirmedAt}
        compact
        details={<>
          <p className="ticket-venue">{record.cinemaName} · {record.hallName}</p>
          <dl className="ticket-start">
            <div><dt>开始时间</dt><dd><time dateTime={record.startsAt}>{formatDateTime(record.startsAt)}</time></dd></div>
          </dl>
        </>}
      />
    </li>)}</ol> : null}
  </main>;
}
