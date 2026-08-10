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
      <p className="eyebrow">当日选座记录</p>
      <h1>{date}</h1>
      <p>以下时间均为北京时间（Asia/Shanghai）。</p>
    </header>
    {!devicePresent ? <section className="today-records-empty" role="status"><h2>未识别到当前设备</h2><p>请使用完成选座时的同一微信扫描“今日选座记录”二维码。</p></section> : null}
    {devicePresent && records.length === 0 ? <section className="today-records-empty" role="status"><h2>今日暂无选座记录</h2><p>当前设备今天还没有完成选座。</p></section> : null}
    {records.length > 0 ? <ol className="today-records-list">{records.map((record) => <li key={record.reservationId} className="today-record-card">
      <header><p className="eyebrow">{record.cinemaName} · {record.hallName}</p><h2>{record.eventName}</h2></header>
      <dl className="today-record-details">
        <div><dt>开始时间</dt><dd>{formatDateTime(record.startsAt)}</dd></div>
        <div><dt>已选座位</dt><dd className="today-record-seats">{record.seats.join("、")}</dd></div>
        <div><dt>票种与数量</dt><dd>{record.tickets.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</dd></div>
        <div><dt>确认时间</dt><dd>{formatDateTime(record.confirmedAt)}</dd></div>
      </dl>
      {record.lotteryResults.length > 0 ? <section className="today-record-lottery"><h3>抽奖结果</h3><ol>{record.lotteryResults.map((result) => <li key={result.drawIndex}>第 {result.drawIndex + 1} 次：<strong>{result.prizeName ?? "未中奖"}</strong></li>)}</ol></section> : null}
    </li>)}</ol> : null}
  </main>;
}
