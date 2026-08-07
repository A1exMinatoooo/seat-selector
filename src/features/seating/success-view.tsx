"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type LotteryResult = { drawIndex: number; prizeName: string | null };
type TicketSummary = { name: string; quantity: number; lotteryEligible: boolean };

export function SuccessView({ code, eventName, phoneLast4, confirmedAt, serverTime, seats, tickets, lotteryEnabled, initialLotteryResults }: { code: string; eventName: string; phoneLast4: string; confirmedAt: string; serverTime: string; seats: string[]; tickets: TicketSummary[]; lotteryEnabled: boolean; initialLotteryResults: LotteryResult[] }) {
  const [nowIso, setNowIso] = useState(serverTime);
  const [lotteryResults, setLotteryResults] = useState(initialLotteryResults);
  const lotteryChances = lotteryEnabled ? tickets.filter((ticket) => ticket.lotteryEligible).reduce((sum, ticket) => sum + ticket.quantity, 0) : 0;
  const [lotteryPhase, setLotteryPhase] = useState<"prompt" | "drawing" | "result" | "closed">(lotteryChances > 0 && initialLotteryResults.length === 0 ? "prompt" : "closed");
  const [lotteryError, setLotteryError] = useState("");

  useEffect(() => {
    const offset = new Date(serverTime).getTime() - Date.now();
    const timer = setInterval(() => setNowIso(new Date(Date.now() + offset).toISOString()), 1000);
    return () => clearInterval(timer);
  }, [serverTime]);

  async function startLottery() {
    setLotteryError("");
    setLotteryPhase("drawing");
    const delay = 2500 + Math.floor(Math.random() * 1001);
    try {
      const [response] = await Promise.all([
        fetch(`/api/events/${code}/lottery`, { method: "POST", headers: { "content-type": "application/json" } }),
        new Promise((resolve) => setTimeout(resolve, delay)),
      ]);
      if (!response.ok) throw new Error(`Lottery failed with ${response.status}`);
      const body = await response.json() as { results: LotteryResult[] };
      setLotteryResults(body.results);
      setLotteryPhase("result");
    } catch (error) {
      console.error("Lottery failed", error);
      setLotteryError("抽奖暂时无法完成，请重试。已完成的结果不会重复抽取。");
      setLotteryPhase("prompt");
    }
  }

  const now = new Date(nowIso);
  const won = lotteryResults.some((result) => result.prizeName !== null);
  return <main className="success-page">
    <header className="success-heading"><p className="eyebrow">选座成功</p><h1>{eventName}</h1></header>
    <div className="live-time"><span>当前时间</span><strong>{now.toLocaleTimeString("zh-CN", { hour12: false })}</strong></div>
    <section><p>你的座位</p><h2 className="confirmed-seats">{seats.map((seat) => <span className="confirmed-seat" key={seat}>{seat}</span>)}</h2></section>
    <div className="ticket-summary">{tickets.map((ticket) => <span key={ticket.name}>{ticket.name} × {ticket.quantity}</span>)}</div>
    {lotteryResults.length ? <section className="lottery-summary"><h2>抽奖结果</h2><ol>{lotteryResults.map((result) => <li key={result.drawIndex}>第 {result.drawIndex + 1} 次：<strong>{result.prizeName ?? "未中奖"}</strong></li>)}</ol></section> : null}
    <p className="confirmed-at">手机尾号 {phoneLast4}<br />确认时间 {new Date(confirmedAt).toLocaleString("zh-CN", { hour12: false })}</p>

    {lotteryPhase !== "closed" ? <div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="lottery-title"><div className="lottery-modal">
      {lotteryPhase === "prompt" ? <><p className="eyebrow">抽奖机会</p><h2 id="lottery-title">您可参与 {lotteryChances} 次抽奖</h2><p>确认后将立即从本活动奖池中抽取。</p>{lotteryError ? <p className="form-error" role="alert">{lotteryError}</p> : null}<button className="button primary" type="button" onClick={() => void startLottery()}>确定，开始抽奖</button></> : null}
      {lotteryPhase === "drawing" ? <><Image src="/assets/images/loading.gif" unoptimized width={220} height={220} alt="抽奖中" priority /><h2 id="lottery-title">抽奖中…</h2><p>好运正在赶来，请稍候。</p></> : null}
      {lotteryPhase === "result" ? <><Image src={won ? "/assets/images/atari.png" : "/assets/images/hazure.png"} width={220} height={220} alt={won ? "中奖啦" : "未中奖"} priority /><h2 id="lottery-title">{won ? "中奖啦！" : "本次未中奖"}</h2><ol className="lottery-result-list">{lotteryResults.map((result) => <li key={result.drawIndex}><span>第 {result.drawIndex + 1} 次</span><strong>{result.prizeName ?? "未中奖"}</strong></li>)}</ol><button className="button primary" type="button" onClick={() => setLotteryPhase("closed")}>确认</button></> : null}
    </div></div> : null}
  </main>;
}
