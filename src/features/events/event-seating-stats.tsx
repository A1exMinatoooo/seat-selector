export function EventSeatingStats({
  seatedParticipantCount,
  occupiedSeatCount,
}: {
  seatedParticipantCount: number;
  occupiedSeatCount: number;
}) {
  return (
    <section className="panel wide" aria-labelledby="event-seating-stats-title">
      <h2 id="event-seating-stats-title">选座统计</h2>
      <dl className="details">
        <dt>已选座人数</dt>
        <dd>{seatedParticipantCount} 人</dd>
        <dt>已占用座位</dt>
        <dd>{occupiedSeatCount} 个</dd>
      </dl>
    </section>
  );
}
