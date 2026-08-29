export type PrizeInventoryItem = {
  id: string;
  name: string;
  total: number;
  remaining: number;
};

export function EventPrizeInventory({ prizes }: { prizes: PrizeInventoryItem[] }) {
  return (
    <section className="panel wide" aria-labelledby="event-prize-inventory-title">
      <h2 id="event-prize-inventory-title">奖品库存</h2>
      <ul className="record-list">
        {prizes.map((prize) => (
          <li key={prize.id}>
            <strong>{prize.name}</strong>
            <span>总数 {prize.total} · 剩余 {prize.remaining}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
