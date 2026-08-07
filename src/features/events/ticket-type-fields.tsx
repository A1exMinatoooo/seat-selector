"use client";

import { useState } from "react";

export function TicketTypeFields() {
  const [types, setTypes] = useState([{ name: "普通票", lotteryEligible: false }]);
  const [lotteryEnabled, setLotteryEnabled] = useState(false);
  const [prizes, setPrizes] = useState([{ name: "", quantity: 1 }]);
  return <>
    <fieldset className="ticket-types"><legend>票种</legend>{types.map((type, index) => <div className="ticket-type-row" key={index}><input aria-label={`票种 ${index + 1}`} value={type.name} onChange={(event) => setTypes((old) => old.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><label className="check-label"><input type="checkbox" checked={type.lotteryEligible} disabled={!lotteryEnabled} onChange={(event) => setTypes((old) => old.map((item, itemIndex) => itemIndex === index ? { ...item, lotteryEligible: event.target.checked } : item))} />参与抽奖</label><button type="button" disabled={types.length === 1} onClick={() => setTypes((old) => old.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>)}<button className="button" type="button" onClick={() => setTypes((old) => [...old, { name: "", lotteryEligible: false }])}>添加票种</button><input type="hidden" name="ticketTypes" value={JSON.stringify(types)} /></fieldset>
    <fieldset className="lottery-fields"><legend>抽奖设置</legend><label className="check-label lottery-toggle"><input name="lotteryEnabled" type="checkbox" checked={lotteryEnabled} onChange={(event) => setLotteryEnabled(event.target.checked)} />此活动有抽奖</label>{lotteryEnabled ? <><p className="muted">只需录入实际奖品，系统会按参与抽奖的票数自动补足“未中奖”。</p><div className="prize-list">{prizes.map((prize, index) => <div key={index}><input aria-label={`奖品名 ${index + 1}`} placeholder="奖品名" required value={prize.name} onChange={(event) => setPrizes((old) => old.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input aria-label={`奖品数量 ${index + 1}`} type="number" min={1} max={100000} required value={prize.quantity} onChange={(event) => setPrizes((old) => old.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} /><button type="button" disabled={prizes.length === 1} onClick={() => setPrizes((old) => old.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>)}</div><button className="button" type="button" onClick={() => setPrizes((old) => [...old, { name: "", quantity: 1 }])}>添加奖品</button></> : null}<input type="hidden" name="prizes" value={JSON.stringify(lotteryEnabled ? prizes : [])} /></fieldset>
  </>;
}
