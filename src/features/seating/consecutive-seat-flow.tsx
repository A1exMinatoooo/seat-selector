"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";
import { responseErrorMessage } from "@/shared/error-message";
import { formatSeatLabel } from "@/shared/seat-label";
import {
  ParticipantSeatButton,
  ParticipantSeatLegend,
  type ParticipantSeatDto,
} from "./participant-seat-state";
import { SeatGridViewport } from "./seat-grid-viewport";
import { InlineBrandIcon, LiveServerTime, LotteryPrizeName } from "./success-view";
import { TheaterMannersDialog } from "./theater-manners-dialog";

type WorkflowView = ConsecutiveWorkflowView;
type WorkflowStep = WorkflowView["steps"][number];
type ClientStep = WorkflowStep & { lockedSeatIds: string[] };
type FlowPhase = "selecting" | "lotteryPrompt" | "drawing" | "lotteryResult";

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function lastNewStepIndex(steps: Array<Pick<WorkflowStep, "historical">>) {
  return steps.findLastIndex((step) => !step.historical);
}

function initialStepIndex(steps: ClientStep[]) {
  const firstIncomplete = steps.findIndex(
    (step) => !step.historical && step.lockedSeatIds.length !== step.ticketTotal,
  );
  return firstIncomplete >= 0 ? firstIncomplete : Math.max(0, lastNewStepIndex(steps));
}

function hasPendingLottery(steps: WorkflowStep[]) {
  return steps.some(
    (step) => !step.historical && step.lotteryEnabled && step.lotteryChances > 0,
  );
}

export function ConsecutiveResultView({ view }: { view: WorkflowView }) {
  return (
    <main className="success-page consecutive-success-page">
      <aside className="success-notice" role="note">
        <InlineBrandIcon className="success-notice-icon" />
        请截图保存本页，方便后续核对座位
      </aside>
      <header className="success-heading consecutive-success-heading">
        <p className="eyebrow">连签选座成功</p>
        <h1>选座结果</h1>
      </header>
      <LiveServerTime serverTime={view.serverTime} />
      <div className="consecutive-result-list">
        {view.steps.map((step, index) => (
          <section className="consecutive-result-card" key={step.eventId}>
            <header>
              <p className="eyebrow">
                第 {index + 1} 场{step.historical ? " · 此前已完成" : ""}
              </p>
              <h2>{step.eventName}</h2>
            </header>
            <div className="consecutive-result-seats" aria-label="你的座位">
              {step.confirmedSeats.map((seat) => <strong key={seat}>{seat}</strong>)}
            </div>
            <div className="ticket-summary">
              {step.tickets.map((ticket) => (
                <span key={ticket.name}>{ticket.name} × {ticket.quantity}</span>
              ))}
            </div>
            {step.lotteryResults.length ? (
              <section className="lottery-summary consecutive-lottery-summary">
                <h3>抽奖结果</h3>
                <ol>
                  {step.lotteryResults.map((result) => (
                    <li key={result.drawIndex}>
                      第 {result.drawIndex + 1} 次：
                      <LotteryPrizeName prizeName={result.prizeName} />
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {step.confirmedAt ? (
              <p className="consecutive-confirmed-at">
                确认时间 {new Date(step.confirmedAt).toLocaleString("zh-CN", { hour12: false })}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}

export function ConsecutiveLotteryResultDialog({
  steps,
  onClose,
}: {
  steps: WorkflowStep[];
  onClose: () => void;
}) {
  const resultSteps = steps.filter(
    (step) => !step.historical && step.lotteryResults.length > 0,
  );
  const won = resultSteps.some((step) =>
    step.lotteryResults.some((result) => result.prizeName !== null),
  );

  return (
    <div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="consecutive-lottery-result-title">
      <div className="lottery-modal consecutive-lottery-modal">
        <Image src={won ? "/assets/images/atari.png" : "/assets/images/hazure.png"} width={220} height={220} alt={won ? "中奖啦" : "未中奖"} priority />
        <h2 id="consecutive-lottery-result-title">{won ? "中奖啦！" : "本次未中奖"}</h2>
        <div className="consecutive-lottery-groups">
          {resultSteps.map((step) => (
            <section key={step.eventId}>
              <h3>{step.eventName}</h3>
              <ol className="lottery-result-list">
                {step.lotteryResults.map((result) => (
                  <li key={result.drawIndex}>
                    <span>第 {result.drawIndex + 1} 次</span>
                    <LotteryPrizeName prizeName={result.prizeName} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <button className="button primary" type="button" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

export function ConsecutiveSeatFlow({ code, initialView }: { code: string; initialView: WorkflowView }) {
  const router = useRouter();
  const initialSteps = initialView.steps.map((step) => ({ ...step, lockedSeatIds: step.selectedSeatIds }));
  const initiallyLocked = initialSteps.every(
    (step) => step.historical || step.lockedSeatIds.length === step.ticketTotal,
  );
  const lotteryPending = hasPendingLottery(initialView.steps);
  const [steps, setSteps] = useState<ClientStep[]>(initialSteps);
  const [currentIndex, setCurrentIndex] = useState(() => initialStepIndex(initialSteps));
  const [located, setLocated] = useState(!initialView.needsLocation);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<FlowPhase>(initiallyLocked && lotteryPending ? "lotteryPrompt" : "selecting");
  const [completedView, setCompletedView] = useState<WorkflowView | null>(null);
  const [finalSubmissionFailed, setFinalSubmissionFailed] = useState(false);
  const [showTheaterManners, setShowTheaterManners] = useState(false);
  const [showSelectionNotice, setShowSelectionNotice] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(initialView.hardExpiresAt).getTime() - Date.now()) / 1000)));
  const eventTitleRef = useRef<HTMLHeadingElement>(null);
  const seatViewportRef = useRef<HTMLDivElement>(null);
  const current = steps[currentIndex];
  const currentEventId = current?.eventId;
  const currentHistorical = current?.historical ?? false;
  const finalStepIndex = lastNewStepIndex(steps);
  const isFinalStep = currentIndex === finalStepIndex || finalStepIndex < 0;
  const currentSubmitted = Boolean(
    current?.historical || current?.lockedSeatIds.length === current?.ticketTotal,
  );

  const closeTheaterManners = useCallback(() => {
    setShowTheaterManners(false);
    window.sessionStorage.setItem(`consecutive-manners:${initialView.id}`, "shown");
    seatViewportRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [initialView.id]);

  useEffect(() => {
    const hasSubmittedStep = initialView.steps.some(
      (step) => !step.historical && step.selectedSeatIds.length === step.ticketTotal,
    );
    const timer =
      !hasSubmittedStep &&
      window.sessionStorage.getItem(`consecutive-manners:${initialView.id}`) !== "shown"
        ? window.setTimeout(() => setShowTheaterManners(true), 0)
        : undefined;
    return () => window.clearTimeout(timer);
  }, [initialView.id, initialView.steps]);

  useEffect(() => {
    const tick = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((new Date(initialView.hardExpiresAt).getTime() - Date.now()) / 1000))), 1_000);
    return () => window.clearInterval(tick);
  }, [initialView.hardExpiresAt]);

  useEffect(() => {
    if (phase !== "selecting") return;

    const updateSelectionNotice = () => {
      const titleBottom = eventTitleRef.current?.getBoundingClientRect().bottom;
      setShowSelectionNotice(window.scrollY > 0 && titleBottom !== undefined && titleBottom <= 0);
    };

    const initial = window.setTimeout(updateSelectionNotice, 0);
    window.addEventListener("scroll", updateSelectionNotice, { passive: true });
    window.addEventListener("resize", updateSelectionNotice);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("scroll", updateSelectionNotice);
      window.removeEventListener("resize", updateSelectionNotice);
    };
  }, [currentEventId, phase]);

  useEffect(() => {
    const heartbeat = () => void fetch(`/api/events/${code}/workflow`, { method: "POST" }).then(async (response) => {
      if (!response.ok) setError(await responseErrorMessage(response));
    });
    const initial = window.setTimeout(heartbeat, 0);
    const timer = window.setInterval(heartbeat, 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [code]);

  useEffect(() => {
    if (!currentEventId || currentHistorical || phase !== "selecting") return;
    const refresh = async () => {
      const response = await fetch(`/api/events/${code}/workflow/holds?eventId=${currentEventId}`, { cache: "no-store" });
      if (!response.ok) return;
      const state = (await response.json()) as { occupiedSeatIds: string[]; selectedSeatIds: string[] };
      setSteps((items) => items.map((item, index) => {
        if (index !== currentIndex) return item;
        const dirty = !sameIds(item.selectedSeatIds, item.lockedSeatIds);
        return { ...item, occupiedSeatIds: state.occupiedSeatIds, lockedSeatIds: state.selectedSeatIds, selectedSeatIds: dirty ? item.selectedSeatIds : state.selectedSeatIds };
      }));
    };
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [code, currentEventId, currentHistorical, currentIndex, phase]);

  function verifyLocation(): Promise<boolean> {
    if (!initialView.needsLocation) return Promise.resolve(true);
    setBusy(true);
    setError("");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const response = await fetch(`/api/events/${code}/workflow/location`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: position.timestamp }),
        });
        setBusy(false);
        if (!response.ok) { setError(await responseErrorMessage(response)); resolve(false); return; }
        setLocated(true);
        resolve(true);
      }, () => { setBusy(false); setError("无法获取定位，请开启定位权限后重试。"); resolve(false); }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
    });
  }

  function toggleSeat(seat: ParticipantSeatDto) {
    if (!current || currentSubmitted) return;
    if (current.occupiedSeatIds.includes(seat.id)) { setError("这个座位已被其他参与者选择。"); return; }
    if (seat.kind !== "seat" || !seat.selectable || !current.availableSeatIds.includes(seat.id)) return;
    setSteps((items) => items.map((item, index) => {
      if (index !== currentIndex) return item;
      const selected = item.selectedSeatIds.includes(seat.id)
        ? item.selectedSeatIds.filter((id) => id !== seat.id)
        : item.selectedSeatIds.length < item.ticketTotal ? [...item.selectedSeatIds, seat.id] : item.selectedSeatIds;
      return { ...item, selectedSeatIds: selected };
    }));
  }

  async function saveCurrentSeats(): Promise<boolean> {
    if (!current || current.historical) return true;
    if (current.selectedSeatIds.length !== current.ticketTotal) return false;
    if (sameIds(current.selectedSeatIds, current.lockedSeatIds)) return true;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/events/${code}/workflow/holds`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: current.eventId, seatIds: current.selectedSeatIds }),
    });
    setBusy(false);
    if (!response.ok) {
      if (response.status === 403) setLocated(false);
      setError(await responseErrorMessage(response));
      return false;
    }
    setSteps((items) => items.map((item, index) => index === currentIndex ? { ...item, lockedSeatIds: item.selectedSeatIds } : item));
    return true;
  }

  async function completeWorkflow(withLottery: boolean) {
    if (initialView.needsLocation && !(await verifyLocation())) return;
    setBusy(true);
    setError("");
    setFinalSubmissionFailed(false);
    if (withLottery) setPhase("drawing");
    const delay = 2_500 + Math.floor(Math.random() * 1_001);
    try {
      const [response] = await Promise.all([
        fetch(`/api/events/${code}/workflow/finalize`, { method: "POST" }),
        withLottery ? new Promise((resolve) => window.setTimeout(resolve, delay)) : Promise.resolve(),
      ]);
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const body = (await response.json()) as { view: WorkflowView };
      if (withLottery) { setCompletedView(body.view); setPhase("lotteryResult"); }
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连签提交失败，请重试。");
      setFinalSubmissionFailed(true);
      setPhase("selecting");
    } finally { setBusy(false); }
  }

  async function submitCurrentStep() {
    if (!(await saveCurrentSeats())) return;
    if (!isFinalStep) {
      const next = steps.findIndex((step, index) => index > currentIndex && !step.historical);
      if (next >= 0) setCurrentIndex(next);
      return;
    }
    if (lotteryPending) setPhase("lotteryPrompt");
    else await completeWorkflow(false);
  }

  if (remaining === 0) return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">连签已超时</p><h1>临时座位已释放</h1><p>请回到现场，让工作人员重新发行二维码。</p></section></main>;

  if (!located) return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">同日连续签到</p><h1>验证现场位置</h1><p>一次定位将校验本次实际参与的全部活动。</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button primary" disabled={busy} onClick={() => void verifyLocation()}>{busy ? "正在定位…" : "允许定位并开始选座"}</button></section></main>;

  if (phase === "lotteryPrompt") {
    const chances = steps.reduce((sum, step) => sum + (!step.historical ? step.lotteryChances : 0), 0);
    return <main className="success-page consecutive-success-page"><div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="lottery-title"><div className="lottery-modal"><p className="eyebrow">抽奖机会</p><h2 id="lottery-title">您可参与 {chances} 次抽奖</h2><p>确认后将分别从各场活动奖池中抽取。</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button primary" type="button" disabled={busy} onClick={() => void completeWorkflow(true)}>{busy ? "正在提交…" : "确定，开始抽奖"}</button></div></div></main>;
  }

  if (phase === "drawing") return <main className="success-page consecutive-success-page"><div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="lottery-title"><div className="lottery-modal"><Image src="/assets/images/loading.gif" unoptimized width={220} height={220} alt="抽奖中" priority /><h2 id="lottery-title">抽奖中…</h2><p>好运正在赶来，请稍候。</p></div></div></main>;

  if (phase === "lotteryResult" && completedView) return <ConsecutiveLotteryResultDialog steps={completedView.steps} onClose={() => router.refresh()} />;
  if (!current) return null;

  const columns = Math.max(...current.seats.map((seat) => seat.columnIndex), 0) + 1;
  const rowIndexes = [...new Set(current.seats.map((seat) => seat.rowIndex))];
  const available = new Set(current.availableSeatIds);
  const occupied = new Set(current.occupiedSeatIds);
  const selected = new Set(current.selectedSeatIds);
  const selectedLabels = current.selectedSeatIds.map((id) => {
    const seat = current.seats.find((item) => item.id === id);
    return seat ? formatSeatLabel(seat.rowLabel, seat.columnLabel) : "";
  }).filter(Boolean);
  const selectionComplete = current.historical || current.selectedSeatIds.length === current.ticketTotal;
  const buttonLabel = finalSubmissionFailed ? "重新提交" : isFinalStep ? "提交选座" : "提交并选下一场";

  return (
    <main className="seat-page consecutive-seat-page">
      <header>
        <p className="eyebrow">同日连续签到 · 剩余 {remaining} 秒</p>
        <h1 ref={eventTitleRef}>{current.eventName}</h1>
        <ol className="consecutive-step-nav" aria-label="连签活动进度">
          {steps.map((step, index) => {
            const submitted = step.historical || step.lockedSeatIds.length === step.ticketTotal;
            return <li className={index === currentIndex ? "active" : ""} key={step.eventId}><span>{index + 1}</span>{step.eventName}{step.historical ? "（此前已完成）" : submitted ? "（已提交）" : ""}</li>;
          })}
        </ol>
      </header>
      {showSelectionNotice ? (
        <aside className="consecutive-selection-notice">
          <span>正在选</span>
          <strong>{current.eventName}</strong>
          <span>，剩余 {remaining} 秒</span>
        </aside>
      ) : null}
      {current.historical ? <section className="participant-card consecutive-history-card"><p className="eyebrow">此前已完成</p><h2>{current.confirmedSeats.join("、")}</h2><p>{current.tickets.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</p></section> : (
        <section className="seat-map-wrap" ref={seatViewportRef}>
          <div className="screen">银幕方向</div>
          <SeatGridViewport ariaLabel={`${current.eventName}可选座位区域`} className="public-grid-viewport" layoutKey={`${current.eventId}:${rowIndexes.length}:${columns}`} legend={<ParticipantSeatLegend />} mobileMinimap>
            <div className={`public-seat-grid ${current.centerAfterColumn === null ? "" : "has-center-divider"}`} style={{ "--center-divider-column": (current.centerAfterColumn ?? Math.floor(columns / 2)) + 1 } as CSSProperties}>
              {rowIndexes.map((rowIndex) => {
                const rowSeats = current.seats.filter((seat) => seat.rowIndex === rowIndex);
                const rowLabel = rowSeats[0]?.rowLabel ?? String(rowIndex + 1);
                return <div className="public-seat-row" style={{ gridTemplateColumns: `32px repeat(${columns}, 42px)` }} key={rowIndex}><span className="public-seat-coordinate" data-seat-row-coordinate={rowLabel} data-seat-row-key={`consecutive:${current.eventId}:${rowIndex}`}>{rowLabel}</span>{rowSeats.map((seat) => <ParticipantSeatButton key={seat.id} seat={seat} occupied={occupied.has(seat.id)} available={available.has(seat.id)} selected={selected.has(seat.id)} interactionDisabled={currentSubmitted} onSelect={toggleSeat} />)}</div>;
              })}
            </div>
          </SeatGridViewport>
        </section>
      )}
      <footer className="selection-bar consecutive-selection-bar">
        <div><strong>{current.historical ? "本场已完成" : `已选 ${current.selectedSeatIds.length}/${current.ticketTotal}`}</strong><span>{current.historical ? current.confirmedSeats.join("、") : selectedLabels.join("、") || "请在上方点选座位"}</span></div>
        <button className="button primary" disabled={busy || !selectionComplete} onClick={() => void submitCurrentStep()}>{busy ? "正在提交…" : buttonLabel}</button>
      </footer>
      {error ? <div className="toast" role="alert">{error}</div> : null}
      {showTheaterManners ? <TheaterMannersDialog onClose={closeTheaterManners} /> : null}
    </main>
  );
}
