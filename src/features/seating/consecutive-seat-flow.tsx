"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";
import { responseErrorMessage } from "@/shared/error-message";
import { SeatGridViewport } from "./seat-grid-viewport";

type WorkflowView = ConsecutiveWorkflowView;
type WorkflowStep = WorkflowView["steps"][number];
type ClientStep = WorkflowStep & { lockedSeatIds: string[] };

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function ConsecutiveResultView({ view }: { view: WorkflowView }) {
  return (
    <main className="participant-shell consecutive-result-shell">
      <header className="success-heading">
        <p className="eyebrow">连签完成</p>
        <h1>同日活动结果</h1>
      </header>
      <div className="consecutive-result-list">
        {view.steps.map((step, index) => (
          <section className="participant-card consecutive-result-card" key={step.eventId}>
            <p className="eyebrow">
              第 {index + 1} 场{step.historical ? " · 此前已完成" : ""}
            </p>
            <h2>{step.eventName}</h2>
            <dl className="details">
              <dt>票种</dt>
              <dd>
                {step.tickets.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}
              </dd>
              <dt>座位</dt>
              <dd>{step.confirmedSeats.join("、")}</dd>
            </dl>
            {step.lotteryResults.length ? (
              <section className="lottery-summary">
                <h3>抽奖结果</h3>
                <ol>
                  {step.lotteryResults.map((result) => (
                    <li key={result.drawIndex}>
                      第 {result.drawIndex + 1} 次：<strong>{result.prizeName ?? "未中奖"}</strong>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}

export function ConsecutiveSeatFlow({
  code,
  initialView,
}: {
  code: string;
  initialView: WorkflowView;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<ClientStep[]>(() =>
    initialView.steps.map((step) => ({ ...step, lockedSeatIds: step.selectedSeatIds })),
  );
  const firstPending = Math.max(
    0,
    steps.findIndex((step) => !step.historical),
  );
  const [currentIndex, setCurrentIndex] = useState(firstPending);
  const [located, setLocated] = useState(!initialView.needsLocation);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"selecting" | "drawing">("selecting");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((new Date(initialView.hardExpiresAt).getTime() - Date.now()) / 1000)),
  );
  const current = steps[currentIndex];
  const currentEventId = current?.eventId;
  const currentHistorical = current?.historical ?? false;
  const allLocked = steps.every(
    (step) => step.historical || step.lockedSeatIds.length === step.ticketTotal,
  );
  const hasLottery = steps.some(
    (step) => !step.historical && step.lotteryEnabled && step.lotteryChances > 0,
  );

  useEffect(() => {
    const tick = window.setInterval(() => {
      setRemaining(
        Math.max(0, Math.ceil((new Date(initialView.hardExpiresAt).getTime() - Date.now()) / 1000)),
      );
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [initialView.hardExpiresAt]);

  useEffect(() => {
    const heartbeat = () =>
      void fetch(`/api/events/${code}/workflow`, { method: "POST" }).then(async (response) => {
        if (!response.ok) setError(await responseErrorMessage(response));
      });
    const initial = window.setTimeout(heartbeat, 0);
    const timer = window.setInterval(heartbeat, 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [code]);

  useEffect(() => {
    if (!currentEventId || currentHistorical || phase !== "selecting") return;
    const refresh = async () => {
      const response = await fetch(`/api/events/${code}/workflow/holds?eventId=${currentEventId}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const state = (await response.json()) as {
        occupiedSeatIds: string[];
        selectedSeatIds: string[];
      };
      setSteps((items) =>
        items.map((item, index) => {
          if (index !== currentIndex) return item;
          const dirty = !sameIds(item.selectedSeatIds, item.lockedSeatIds);
          return {
            ...item,
            occupiedSeatIds: state.occupiedSeatIds,
            lockedSeatIds: state.selectedSeatIds,
            selectedSeatIds: dirty ? item.selectedSeatIds : state.selectedSeatIds,
          };
        }),
      );
    };
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [code, currentEventId, currentHistorical, currentIndex, phase]);

  function verifyLocation(): Promise<boolean> {
    if (!initialView.needsLocation) return Promise.resolve(true);
    setBusy(true);
    setError("");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const response = await fetch(`/api/events/${code}/workflow/location`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              capturedAt: position.timestamp,
            }),
          });
          setBusy(false);
          if (!response.ok) {
            setError(await responseErrorMessage(response));
            resolve(false);
            return;
          }
          setLocated(true);
          resolve(true);
        },
        () => {
          setBusy(false);
          setError("无法获取定位，请开启定位权限后重试。");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
      );
    });
  }

  function toggleSeat(seatId: string) {
    if (!current || current.historical) return;
    setSteps((items) =>
      items.map((item, index) => {
        if (index !== currentIndex) return item;
        const selected = item.selectedSeatIds.includes(seatId)
          ? item.selectedSeatIds.filter((id) => id !== seatId)
          : item.selectedSeatIds.length < item.ticketTotal
            ? [...item.selectedSeatIds, seatId]
            : item.selectedSeatIds;
        return { ...item, selectedSeatIds: selected };
      }),
    );
  }

  async function lockCurrentSeats() {
    if (!current || current.historical || current.selectedSeatIds.length !== current.ticketTotal)
      return;
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
      return;
    }
    setSteps((items) =>
      items.map((item, index) =>
        index === currentIndex ? { ...item, lockedSeatIds: item.selectedSeatIds } : item,
      ),
    );
    const next = steps.findIndex(
      (step, index) => index > currentIndex && !step.historical && step.lockedSeatIds.length === 0,
    );
    if (next >= 0) setCurrentIndex(next);
  }

  async function finalize() {
    if (!allLocked) return;
    if (initialView.needsLocation && !(await verifyLocation())) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/events/${code}/workflow/finalize`, { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      setError(await responseErrorMessage(response));
      return;
    }
    if (hasLottery) {
      setPhase("drawing");
      window.setTimeout(() => router.refresh(), 1_500);
    } else router.refresh();
  }

  if (remaining === 0)
    return (
      <main className="participant-shell">
        <section className="participant-card">
          <p className="eyebrow">连签已超时</p>
          <h1>临时座位已释放</h1>
          <p>请回到现场，让工作人员重新发行二维码。</p>
        </section>
      </main>
    );
  if (!located)
    return (
      <main className="participant-shell">
        <section className="participant-card">
          <p className="eyebrow">同日连续签到</p>
          <h1>验证现场位置</h1>
          <p>一次定位将校验本次实际参与的全部活动。</p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button primary" disabled={busy} onClick={() => void verifyLocation()}>
            {busy ? "正在定位…" : "允许定位并开始选座"}
          </button>
        </section>
      </main>
    );
  if (phase === "drawing")
    return (
      <main className="participant-shell">
        <section className="participant-card lottery-drawing">
          <p className="eyebrow">多场统一开奖</p>
          <h1>抽奖中…</h1>
          <p>正在分别从各场奖池抽取，请稍候。</p>
        </section>
      </main>
    );
  if (!current) return null;

  const columns = Math.max(...current.seats.map((seat) => seat.columnIndex), 0) + 1;
  const rowIndexes = [...new Set(current.seats.map((seat) => seat.rowIndex))];
  const available = new Set(current.availableSeatIds);
  const occupied = new Set(current.occupiedSeatIds);
  const selected = new Set(current.selectedSeatIds);
  const selectedLabels = current.selectedSeatIds
    .map((id) => {
      const seat = current.seats.find((item) => item.id === id);
      return seat ? formatSeatLabel(seat.rowLabel, seat.columnLabel) : "";
    })
    .filter(Boolean);

  return (
    <main className="seat-page consecutive-seat-page">
      <header>
        <p className="eyebrow">同日连续签到 · 剩余 {remaining} 秒</p>
        <h1>{current.eventName}</h1>
        <nav className="consecutive-step-nav" aria-label="连签活动步骤">
          {steps.map((step, index) => (
            <button
              type="button"
              className={index === currentIndex ? "active" : ""}
              onClick={() => setCurrentIndex(index)}
              key={step.eventId}
            >
              <span>{index + 1}</span>
              {step.eventName}
              {step.historical
                ? "（已完成）"
                : step.lockedSeatIds.length === step.ticketTotal
                  ? "（已锁定）"
                  : ""}
            </button>
          ))}
        </nav>
      </header>
      {current.historical ? (
        <section className="participant-card consecutive-history-card">
          <p className="eyebrow">此前已完成</p>
          <h2>{current.confirmedSeats.join("、")}</h2>
          <p>{current.tickets.map((ticket) => `${ticket.name} × ${ticket.quantity}`).join("、")}</p>
        </section>
      ) : (
        <section className="seat-map-wrap">
          <div className="screen">银幕方向</div>
          <SeatGridViewport
            ariaLabel={`${current.eventName}可选座位区域`}
            className="public-grid-viewport"
            layoutKey={`${current.eventId}:${rowIndexes.length}:${columns}`}
          >
            <div
              className={`public-seat-grid ${current.centerAfterColumn === null ? "" : "has-center-divider"}`}
              style={
                {
                  "--center-divider-column":
                    (current.centerAfterColumn ?? Math.floor(columns / 2)) + 1,
                } as CSSProperties
              }
            >
              {rowIndexes.map((rowIndex) => (
                <div
                  className="public-seat-row"
                  style={{ gridTemplateColumns: `32px repeat(${columns}, 42px)` }}
                  key={rowIndex}
                >
                  <span className="public-seat-coordinate">
                    {current.seats.find((seat) => seat.rowIndex === rowIndex)?.rowLabel}
                  </span>
                  {current.seats
                    .filter((seat) => seat.rowIndex === rowIndex)
                    .map((seat) => {
                      const mine = selected.has(seat.id);
                      const unavailable =
                        occupied.has(seat.id) ||
                        !available.has(seat.id) ||
                        !seat.selectable ||
                        seat.kind !== "seat";
                      const label = formatSeatLabel(seat.rowLabel, seat.columnLabel);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          aria-label={`${label}：${mine ? "我的选择" : unavailable ? "不可选" : "可选"}`}
                          disabled={unavailable && !mine}
                          className={`public-seat ${seat.kind} ${seat.golden && !unavailable ? "golden" : ""} ${unavailable && !mine ? "occupied" : ""} ${mine ? "mine" : ""}`}
                          onClick={() => toggleSeat(seat.id)}
                        >
                          {seat.kind === "seat" ? displaySeatNumber(seat.columnLabel) : ""}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </SeatGridViewport>
        </section>
      )}
      <footer className="selection-bar consecutive-selection-bar">
        <div>
          <strong>
            {current.historical
              ? "本场已完成"
              : `已选 ${current.selectedSeatIds.length}/${current.ticketTotal}`}
          </strong>
          <span>
            {current.historical
              ? current.confirmedSeats.join("、")
              : selectedLabels.join("、") || "请在上方点选座位"}
          </span>
        </div>
        {!current.historical ? (
          <button
            className="button"
            disabled={
              busy ||
              current.selectedSeatIds.length !== current.ticketTotal ||
              sameIds(current.selectedSeatIds, current.lockedSeatIds)
            }
            onClick={() => void lockCurrentSeats()}
          >
            {busy ? "正在锁定…" : current.lockedSeatIds.length ? "更新临时座位" : "锁定并继续"}
          </button>
        ) : null}
        <button
          className="button primary"
          disabled={busy || !allLocked}
          onClick={() => void finalize()}
        >
          {busy ? "正在完成…" : hasLottery ? "完成选座并统一抽奖" : "完成全部选座"}
        </button>
      </footer>
      {error ? (
        <div className="toast" role="alert">
          {error}
        </div>
      ) : null}
    </main>
  );
}
