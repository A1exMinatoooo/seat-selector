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
  initialLotteryPoolBonus = 0,
  initialParticipationMode = "onsite",
  initialMaxTicketsPerIssue = 3,
  initialExpectedLotteryTickets,
}: {
  initialTypes?: Array<{ id?: string; name: string; lotteryEligible: boolean }>;
  initialLotteryEnabled?: boolean;
  initialPrizes?: Array<{ name: string; quantity: number }>;
  initialLotteryPoolBonus?: number;
  initialParticipationMode?: "onsite" | "preregistered";
  initialMaxTicketsPerIssue?: number;
  initialExpectedLotteryTickets?: number | null;
}) {
  const nextKey = useRef(1);
  const createKey = (prefix: string) => `${prefix}-${nextKey.current++}`;
  const [types, setTypes] = useState<TicketTypeValue[]>(() => initialTypes.map((type, index) => ({ ...type, key: type.id ?? `ticket-initial-${index}` })));
  const [lotteryEnabled, setLotteryEnabled] = useState(initialLotteryEnabled);
  const [participationMode, setParticipationMode] = useState(initialParticipationMode);
  const [prizes, setPrizes] = useState<PrizeValue[]>(() => (initialPrizes.length ? initialPrizes : [{ name: "", quantity: 1 }]).map((prize, index) => ({ ...prize, key: `prize-initial-${index}` })));

  return <>
    <fieldset className="participation-mode-fields">
      <legend>参与方式</legend>
      <div className="segmented-control" role="radiogroup" aria-label="活动参与方式">
        <label><input type="radio" name="participationMode" value="onsite" checked={participationMode === "onsite"} onChange={() => setParticipationMode("onsite")} /><span>现场发行</span></label>
        <label><input type="radio" name="participationMode" value="preregistered" checked={participationMode === "preregistered"} onChange={() => setParticipationMode("preregistered")} /><span>预录参与者</span></label>
      </div>
      <p className="muted">{participationMode === "onsite" ? "现场选择票种和张数后发行单次二维码，无需预录昵称和手机号。" : "提前录入参与者的社交平台昵称、手机号及其购买票数，扫码后验证身份。请勿录入真实姓名。"}</p>
      {participationMode === "onsite" ? <label>单次最多发行张数<NumericInput name="maxTicketsPerIssue" min={1} max={20} defaultValue={initialMaxTicketsPerIssue} /></label> : <input type="hidden" name="maxTicketsPerIssue" value={initialMaxTicketsPerIssue} />}
    </fieldset>
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
        <p className="muted">{participationMode === "onsite" ? "总奖池人数 = 预计可抽奖票数 + 额外奖池人数 X；预计额度在扫码领取时占用。" : "开放选座前，请先在“参与者清单”录入参与者及其票数。总奖池人数 = “参与抽奖”的票数 + 额外奖池人数 X。"} 奖品总数必须小于等于总奖池人数，其余为“未中奖”。</p>
        {participationMode === "onsite" ? <label>预计可抽奖票数<NumericInput name="expectedLotteryTickets" min={1} max={100000} defaultValue={initialExpectedLotteryTickets ?? undefined} /><span className="muted">所有已领取的参与抽奖票累计不得超过此数量。</span></label> : <input type="hidden" name="expectedLotteryTickets" value="" />}
        <label>额外奖池人数 X<NumericInput name="lotteryPoolBonus" min={0} max={100000} defaultValue={initialLotteryPoolBonus} /><span className="muted">总奖池人数 = 参与抽奖票数 + 额外奖池人数 X</span></label>
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
      {!lotteryEnabled ? <input type="hidden" name="lotteryPoolBonus" value="0" /> : null}
      {!lotteryEnabled ? <input type="hidden" name="expectedLotteryTickets" value="" /> : null}
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
