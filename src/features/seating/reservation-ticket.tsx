import type { ReactNode } from "react";

type LotteryResult = { drawIndex: number; prizeName: string | null };

type ReservationTicketProps = {
  eventName: string;
  seats: readonly string[];
  tickets: readonly { name: string; quantity: number }[];
  lotteryResults: readonly LotteryResult[];
  confirmedAt?: string | null;
  phoneLast4?: string;
  compact?: boolean;
  completionMotion?: boolean;
  header?: ReactNode;
  details?: ReactNode;
};

function DrawResults({ results }: { results: readonly LotteryResult[] }) {
  return (
    <ol>
      {results.map((result) => (
        <li key={result.drawIndex}>
          <span>第 {result.drawIndex + 1} 次：</span>
          <strong>{result.prizeName ?? "未中奖"}</strong>
        </li>
      ))}
    </ol>
  );
}

export function ReservationTicket({
  eventName,
  seats,
  tickets,
  lotteryResults,
  confirmedAt,
  phoneLast4,
  compact = false,
  header,
  details,
  completionMotion = false,
}: ReservationTicketProps) {
  const winning = lotteryResults.filter((result) => result.prizeName !== null);
  const losing = lotteryResults.filter((result) => result.prizeName === null);

  return (
    <article className={`reservation-ticket${compact ? " reservation-ticket-compact" : ""}${completionMotion ? " reservation-ticket--settle" : ""}`}>
      <div className="ticket-body">
        <header className="ticket-heading">
          {header}
          <h2>{eventName}</h2>
          {details}
        </header>
        <div className="ticket-seat-group">
          <p className="ticket-label">你的座位</p>
          <ul className="ticket-seats" aria-label="你的座位">
            {seats.map((seat) => <li key={seat}>{seat}</li>)}
          </ul>
        </div>
        {lotteryResults.length > 0 ? (
          <section className="ticket-lottery" aria-label="抽奖结果">
            {winning.length > 0 ? (
              <div className="ticket-prizes-winning">
                <h3>中奖奖品</h3>
                <DrawResults results={winning} />
              </div>
            ) : null}
            {losing.length > 0 ? (
              <div className="ticket-prizes-losing">
                {winning.length === 0 ? <h3>抽奖结果</h3> : null}
                <DrawResults results={losing} />
              </div>
            ) : null}
          </section>
        ) : null}
        <ul className="ticket-types-summary" aria-label="票种与数量">
          {tickets.map((ticket) => <li key={ticket.name}>{ticket.name} × {ticket.quantity}</li>)}
        </ul>
      </div>
      {phoneLast4 !== undefined || confirmedAt ? (
        <footer className="ticket-stub">
          <dl>
            {phoneLast4 !== undefined ? <div><dt>手机尾号</dt><dd>{phoneLast4}</dd></div> : null}
            {confirmedAt ? (
              <div>
                <dt>确认时间</dt>
                <dd><time dateTime={confirmedAt}>{new Date(confirmedAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                })}</time></dd>
              </div>
            ) : null}
          </dl>
        </footer>
      ) : null}
    </article>
  );
}
