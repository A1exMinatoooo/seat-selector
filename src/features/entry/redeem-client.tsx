"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { userFacingErrorMessage } from "@/shared/error-message";

type RedeemState =
  | { phase: "verifying" }
  | { phase: "completed" }
  | { phase: "error"; code: string; retryable: boolean };

const retryableErrorCodes = new Set(["INTERNAL_ERROR", "RATE_LIMITED", "NETWORK_ERROR"]);

function errorHeading(code: string) {
  if (code === "TICKET_ISSUE_EXPIRED") return "二维码已过期";
  if (code === "TICKET_ISSUE_CLAIMED") return "二维码已被领取";
  if (code === "FORBIDDEN" || code === "EVENT_CONFLICT") return "当前无法进入活动";
  return "验证未完成";
}

export function RedeemClient({ code, token }: { code: string; token: string }) {
  const router = useRouter();
  const [state, setState] = useState<RedeemState>({ phase: "verifying" });
  const [attempt, setAttempt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/entry/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, token }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          router.replace(`/e/${code}`);
          return;
        }
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        const errorCode = body.error ?? "INTERNAL_ERROR";
        if (errorCode === "SELECTION_ALREADY_COMPLETED") {
          setSecondsRemaining(5);
          setState({ phase: "completed" });
          return;
        }
        setState({
          phase: "error",
          code: errorCode,
          retryable: retryableErrorCodes.has(errorCode),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ phase: "error", code: "NETWORK_ERROR", retryable: true });
      });
    return () => controller.abort();
  }, [attempt, code, router, token]);

  useEffect(() => {
    if (state.phase !== "completed") return;
    const interval = window.setInterval(
      () => setSecondsRemaining((current) => Math.max(0, current - 1)),
      1_000,
    );
    const timeout = window.setTimeout(() => router.replace("/records/today"), 5_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router, state.phase]);

  if (state.phase === "completed")
    return (
      <main className="participant-shell">
        <div
          className="lottery-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selection-completed-title"
          aria-describedby="selection-completed-description"
        >
          <section className="lottery-modal">
            <p className="eyebrow">选座记录</p>
            <h2 id="selection-completed-title">您已完成本场选座</h2>
            <p id="selection-completed-description">
              {secondsRemaining} 秒后将自动跳转至选座记录。
            </p>
            <button
              autoFocus
              className="button primary"
              type="button"
              onClick={() => router.replace("/records/today")}
            >
              查看选座记录（{secondsRemaining}）
            </button>
          </section>
        </div>
      </main>
    );

  if (state.phase === "error")
    return (
      <main className="participant-shell">
        <section className="participant-card" role="alert">
          <p className="eyebrow">安全入场</p>
          <h1>{errorHeading(state.code)}</h1>
          <p>{userFacingErrorMessage(state.code)}</p>
          {state.retryable ? (
            <button className="button primary" type="button" onClick={() => { setState({ phase: "verifying" }); setAttempt((old) => old + 1); }}>
              重新验证
            </button>
          ) : null}
        </section>
      </main>
    );

  return (
    <main className="participant-shell">
      <section className="participant-card" aria-live="polite">
        <p className="eyebrow">安全入场</p>
        <h1>正在验证二维码</h1>
        <p>请稍候，不要关闭页面。</p>
      </section>
    </main>
  );
}
