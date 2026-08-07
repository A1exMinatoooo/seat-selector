"use client";

import { useRef, useState } from "react";
import { NumericInput } from "@/features/forms/numeric-input";

type TicketTypeValue = {
  id?: string;
  key: string;
  name: string;
  lotteryEligible: boolean;
};

type PrizeValue = {
  key: string;
  name: string;
  quantity: number;
};

export function TicketTypeFields({
  initialTypes = [{ name: "普通票", lotteryEligible: false }],
  initialLotteryEnabled = false,
  initialPrizes = [],
}: {
  initialTypes?: Array<{ id?: string; name: string; lotteryEligible: boolean }>;
  initialLotteryEnabled?: boolean;
  initialPrizes?: Array<{ name: string; quantity: number }>;
}) {
  const nextKey = useRef(1);
  const createKey = (prefix: string) => `${prefix}-${nextKey.current++}`;
  const [types, setTypes] = useState<TicketTypeValue[]>(() => initialTypes.map((type, index) => ({ ...type, key: type.id ?? `ticket-initial-${index}` })));
  const [lotteryEnabled, setLotteryEnabled] = useState(initialLotteryEnabled);
  const [prizes, setPrizes] = useState<PrizeValue[]>(() => (initialPrizes.length ? initialPrizes : [{ name: "", quantity: 1 }]).map((prize, index) => ({ ...prize, key: `prize-initial-${index}` })));

  return <>
    <fieldset className="lottery-fields">
      <legend>抽奖设置</legend>
      <label className="switch-label">
        <input
          name="lotteryEnabled"
          type="checkbox"
          checked={lotteryEnabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            setLotteryEnabled(enabled);
            if (!enabled) setTypes((current) => current.map((type) => ({ ...type, lotteryEligible: false })));
          }}
        />
        <span className="switch-control" aria-hidden="true" />
        <span>开启活动抽奖</span>
      </label>
      {lotteryEnabled ? <>
        <p className="muted">只需录入实际奖品，系统会按参与抽奖的票数自动补足“未中奖”。</p>
        <div className="prize-list">
          {prizes.map((prize, index) => <div key={prize.key}>
            <input aria-label={`奖品名 ${index + 1}`} placeholder="奖品名" required value={prize.name} onChange={(event) => setPrizes((current) => current.map((item) => item.key === prize.key ? { ...item, name: event.target.value } : item))} />
            <NumericInput aria-label={`奖品数量 ${index + 1}`} min={1} max={100000} value={prize.quantity} onValueChange={(quantity) => setPrizes((current) => current.map((item) => item.key === prize.key ? { ...item, quantity } : item))} />
            <button type="button" disabled={prizes.length === 1} onClick={() => setPrizes((current) => current.filter((item) => item.key !== prize.key))}>移除</button>
          </div>)}
        </div>
        <button className="button" type="button" onClick={() => setPrizes((current) => [...current, { key: createKey("prize"), name: "", quantity: 1 }])}>添加奖品</button>
      </> : null}
      <input type="hidden" name="prizes" value={JSON.stringify(lotteryEnabled ? prizes.map(({ name, quantity }) => ({ name, quantity })) : [])} />
    </fieldset>
    <fieldset className="ticket-types">
      <legend>票种</legend>
      {types.map((type, index) => <div className="ticket-type-row" key={type.key}>
        <input aria-label={`票种 ${index + 1}`} required value={type.name} onChange={(event) => setTypes((current) => current.map((item) => item.key === type.key ? { ...item, name: event.target.value } : item))} />
        {lotteryEnabled ? <label className="switch-label compact">
          <input type="checkbox" checked={type.lotteryEligible} onChange={(event) => setTypes((current) => current.map((item) => item.key === type.key ? { ...item, lotteryEligible: event.target.checked } : item))} />
          <span className="switch-control" aria-hidden="true" />
          <span>参与抽奖</span>
        </label> : null}
        <button type="button" disabled={types.length === 1} onClick={() => setTypes((current) => current.filter((item) => item.key !== type.key))}>移除</button>
      </div>)}
      <button className="button" type="button" onClick={() => setTypes((current) => [...current, { key: createKey("ticket"), name: "", lotteryEligible: false }])}>添加票种</button>
      <input type="hidden" name="ticketTypes" value={JSON.stringify(types.map(({ id, name, lotteryEligible }) => ({ id, name, lotteryEligible })))} />
    </fieldset>
  </>;
}
