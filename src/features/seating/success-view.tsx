"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { responseErrorMessage } from "@/shared/error-message";
import { ReservationTicket } from "./reservation-ticket";

type LotteryResult = { drawIndex: number; prizeName: string | null };
type TicketSummary = { name: string; quantity: number; lotteryEligible: boolean };

export function InlineBrandIcon({ className = "" }: { className?: string }) {
  return <span className={`inline-brand-icon ${className}`.trim()} aria-hidden="true"><Image unoptimized width={512} height={512} src="/icon.svg" alt="" /></span>;
}

export function useResultMotionVisibility() {
  const [motionPaused, setMotionPaused] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setMotionPaused(document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return motionPaused;
}

export function CompletionCheckline() {
  return (
    <svg className="completion-checkline" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4 12.5 5 5L20 6" pathLength="1" />
    </svg>
  );
}

export function ScreenshotNotice() {
  return (
    <aside className="success-notice" role="note">
      <InlineBrandIcon className="success-notice-icon" />
      <span className="success-notice-text">请截图保存本页，方便后续核对座位</span>
    </aside>
  );
}

export function LotteryPrizeName({ prizeName }: { prizeName: string | null }) {
  return <strong className="lottery-prize-name">{prizeName ?? "未中奖"}{prizeName ? <InlineBrandIcon className="lottery-prize-icon" /> : null}</strong>;
}

export function LiveServerTime({ serverTime }: { serverTime: string }) {
  const [nowIso, setNowIso] = useState(serverTime);

  useEffect(() => {
    const offset = new Date(serverTime).getTime() - Date.now();
    const timer = setInterval(() => setNowIso(new Date(Date.now() + offset).toISOString()), 1000);
    return () => clearInterval(timer);
  }, [serverTime]);

  return <div className="live-time"><span>当前时间</span><strong>{new Date(nowIso).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</strong></div>;
}

export function LotteryResultDialog({
  results,
  onClose,
}: {
  results: LotteryResult[];
  onClose: () => void;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(3);
  const won = results.some((result) => result.prizeName !== null);

  useEffect(() => {
    const interval = window.setInterval(
      () => setSecondsRemaining((current) => Math.max(0, current - 1)),
      1_000,
    );
    const timeout = window.setTimeout(onClose, 3_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onClose]);

  return (
    <>
      <Image
        src={won ? "/assets/images/atari.png" : "/assets/images/hazure.png"}
        width={220}
        height={220}
        alt={won ? "中奖啦" : "未中奖"}
        priority
      />
      <h2 id="lottery-title">{won ? "中奖啦！" : "本次未中奖"}</h2>
      <ol className="lottery-result-list">
        {results.map((result) => (
          <li key={result.drawIndex}>
            <span>第 {result.drawIndex + 1} 次</span>
            <LotteryPrizeName prizeName={result.prizeName} />
          </li>
        ))}
      </ol>
      <button className="button primary" type="button" onClick={onClose}>
        关闭（{secondsRemaining}）
      </button>
    </>
  );
}

export function SuccessView({ code, eventName, phoneLast4, showPhoneLast4 = true, confirmedAt, serverTime, seats, tickets, lotteryEnabled, initialLotteryResults, showTodayRecordsLink }: { code: string; eventName: string; phoneLast4: string; showPhoneLast4?: boolean; confirmedAt: string; serverTime: string; seats: string[]; tickets: TicketSummary[]; lotteryEnabled: boolean; initialLotteryResults: LotteryResult[]; showTodayRecordsLink: boolean }) {
  const motionPaused = useResultMotionVisibility();
  const [lotteryResults, setLotteryResults] = useState(initialLotteryResults);
  const lotteryChances = lotteryEnabled ? tickets.filter((ticket) => ticket.lotteryEligible).reduce((sum, ticket) => sum + ticket.quantity, 0) : 0;
  const hasPendingLottery = lotteryChances > 0 && initialLotteryResults.length === 0;
  const [lotteryPhase, setLotteryPhase] = useState<"prompt" | "drawing" | "result" | "closed">(hasPendingLottery ? "prompt" : "closed");
  const [lotteryError, setLotteryError] = useState("");
  const closeLotteryResult = useCallback(() => setLotteryPhase("closed"), []);

  async function startLottery() {
    setLotteryError("");
    setLotteryPhase("drawing");
    const delay = 2500 + Math.floor(Math.random() * 1001);
    try {
      const [response] = await Promise.all([
        fetch(`/api/events/${code}/lottery`, { method: "POST", headers: { "content-type": "application/json" } }),
        new Promise((resolve) => setTimeout(resolve, delay)),
      ]);
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const body = await response.json() as { results: LotteryResult[] };
      setLotteryResults(body.results);
      setLotteryPhase("result");
    } catch (error) {
      console.error("Lottery failed", error);
      setLotteryError(
        error instanceof TypeError
          ? "网络连接失败，请检查网络后重试。已完成的结果不会重复抽取。"
          : error instanceof Error
            ? error.message
            : "抽奖暂时无法完成，请重试。已完成的结果不会重复抽取。",
      );
      setLotteryPhase("prompt");
    }
  }

  return <main className="success-page" data-motion-paused={motionPaused ? "true" : undefined}>
    <ScreenshotNotice />
    <header className="success-heading"><CompletionCheckline /><h1>选座成功</h1></header>
    <LiveServerTime serverTime={serverTime} />
    <ReservationTicket
      completionMotion
      eventName={eventName}
      seats={seats}
      tickets={tickets}
      lotteryResults={lotteryResults}
      phoneLast4={showPhoneLast4 ? phoneLast4 : undefined}
      confirmedAt={confirmedAt}
    />
    {showTodayRecordsLink ? <Link className="button success-records-link" href="/records/today">查看今日选座记录</Link> : null}

    {lotteryPhase !== "closed" ? <div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="lottery-title"><div className="lottery-modal">
      {lotteryPhase === "prompt" ? <><p className="eyebrow">抽奖机会</p><h2 id="lottery-title">您可参与 {lotteryChances} 次抽奖</h2><p>确认后将立即从本活动奖池中抽取。</p>{lotteryError ? <p className="form-error" role="alert">{lotteryError}</p> : null}<button className="button primary" type="button" onClick={() => void startLottery()}>确定，开始抽奖</button></> : null}
      {lotteryPhase === "drawing" ? <><Image src="/assets/images/loading.gif" unoptimized width={220} height={220} alt="抽奖中" priority /><h2 id="lottery-title">抽奖中…</h2><p>好运正在赶来，请稍候。</p></> : null}
      {lotteryPhase === "result" ? <LotteryResultDialog results={lotteryResults} onClose={closeLotteryResult} /> : null}
    </div></div> : null}
  </main>;
}
