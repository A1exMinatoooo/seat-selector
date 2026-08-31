"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminToast } from "@/features/admin/admin-toast";
import { BrandedQrCode } from "@/features/entry/branded-qr-code";
import { responseErrorMessage } from "@/shared/error-message";

const qrRefreshIntervalMs = 1_000;
type TicketType = { id: string; name: string };
type IssueEvent = {
  id: string;
  name: string;
  maxTicketsPerIssue: number;
  ticketTypes: TicketType[];
};
type QrData = { image: string; expiresIn: number; serverTime: string };
type IssueStatus = "active" | "claimed" | "expired" | "cancelled";
type IssueResponse = QrData & {
  issueId: string;
  expiresAt: string;
  allocation: Array<TicketType & { quantity: number }>;
  events?: Array<{
    eventId: string;
    eventName: string;
    ticketTotal: number;
    allocation: Array<TicketType & { ticketTypeId: string; quantity: number }>;
  }>;
};
type IssueData = IssueResponse & { clientExpiresAt: number };
type IssuePhase = "active" | "confirming" | "cancelling";
type ActiveWorkflow = {
  id: string;
  claimedAt: string;
  hardExpiresAt: string;
  events: string[];
};

function isIssueStatus(value: unknown): value is IssueStatus {
  return ["active", "claimed", "expired", "cancelled"].includes(String(value));
}

export function QrBoard({
  eventId,
  eventName,
  backHref,
  participationMode = "preregistered",
  maxTicketsPerIssue = 7,
  ticketTypes = [],
  issueEvents,
}: {
  eventId: string;
  eventName: string;
  backHref: string;
  participationMode?: "onsite" | "preregistered";
  maxTicketsPerIssue?: number;
  ticketTypes?: TicketType[];
  issueEvents?: IssueEvent[];
}) {
  if (participationMode === "onsite")
    return (
      <OnsiteIssueBoard
        eventId={eventId}
        eventName={eventName}
        backHref={backHref}
        issueEvents={
          issueEvents ?? [{ id: eventId, name: eventName, maxTicketsPerIssue, ticketTypes }]
        }
      />
    );
  return <RotatingQrBoard eventId={eventId} eventName={eventName} backHref={backHref} />;
}

function RotatingQrBoard({
  eventId,
  eventName,
  backHref,
}: {
  eventId: string;
  eventName: string;
  backHref: string;
}) {
  const [data, setData] = useState<QrData>();
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/admin/events/${eventId}/qr`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const nextData = (await response.json()) as QrData;
          if (active) setData(nextData);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error("QR refresh failed", error);
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), qrRefreshIntervalMs);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [eventId]);
  return (
    <main className="qr-screen">
      <div>
        <aside className="qr-scan-notice" role="note">
          建议使用微信扫描二维码，后续可在同一微信中查看今日选座记录。
        </aside>
        <Link className="qr-back-button" href={backHref}>
          <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />
          返回活动详情
        </Link>
        <p className="eyebrow">现场扫码入场</p>
        <h1>{eventName}</h1>
        <p>二维码动态更新，请在现场完成定位与身份验证</p>
      </div>
      {data ? (
        <div className="qr-frame">
          <BrandedQrCode src={data.image} alt={`${eventName} 动态入场二维码`} />
          <strong>二维码将在 {data.expiresIn} 秒内更新</strong>
          <time>{new Date(data.serverTime).toLocaleString("zh-CN")}</time>
        </div>
      ) : (
        <div className="qr-frame loading">正在生成安全二维码…</div>
      )}
    </main>
  );
}

function OnsiteIssueBoard({
  eventId,
  eventName,
  backHref,
  issueEvents,
}: {
  eventId: string;
  eventName: string;
  backHref: string;
  issueEvents: IssueEvent[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(issueEvents.flatMap((item) => item.ticketTypes.map((type) => [type.id, 0]))),
  );
  const [issue, setIssue] = useState<IssueData>();
  const [phase, setPhase] = useState<IssuePhase>("active");
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const confirmationFailureShownRef = useRef(false);
  const mutationControllerRef = useRef<AbortController | undefined>(undefined);
  const showToast = useAdminToast();
  const total = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  );
  const eventTotals = useMemo(
    () =>
      Object.fromEntries(
        issueEvents.map((item) => [
          item.id,
          item.ticketTypes.reduce((sum, type) => sum + (quantities[type.id] ?? 0), 0),
        ]),
      ),
    [issueEvents, quantities],
  );
  const validAllocation = issueEvents.every((item, index) => {
    const eventTotal = eventTotals[item.id] ?? 0;
    return eventTotal <= item.maxTicketsPerIssue && (index > 0 || eventTotal >= 1);
  });

  const loadActiveWorkflows = useCallback(async () => {
    if (issueEvents.length <= 1) return;
    try {
      const response = await fetch(`/api/admin/events/${eventId}/qr?workflows=active`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { workflows?: ActiveWorkflow[] };
      setActiveWorkflows(data.workflows ?? []);
    } catch (error) {
      console.error("Active consecutive workflow refresh failed", error);
    }
  }, [eventId, issueEvents.length]);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadActiveWorkflows(), 0);
    const timer = window.setInterval(() => void loadActiveWorkflows(), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadActiveWorkflows]);

  const finishIssue = useCallback(
    (currentIssue: IssueData, status: Exclude<IssueStatus, "active">) => {
      setIssue(undefined);
      setPhase("active");
      const ticketTotal =
        currentIssue.events?.reduce((sum, item) => sum + item.ticketTotal, 0) ??
        currentIssue.allocation.reduce((sum, item) => sum + item.quantity, 0);
      if (status === "claimed") {
        showToast("success", `参与者已领取，共 ${ticketTotal} 张。`);
      } else if (status === "expired") {
        showToast("error", "二维码已超时，请重新发行。");
      } else {
        showToast("success", "二维码已撤销。");
      }
    },
    [showToast],
  );

  useEffect(
    () => () => {
      mutationControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!issue || phase === "cancelling") return;
    let active = true;
    let inFlight = false;
    const controller = new AbortController();

    const checkStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/admin/events/${eventId}/qr?issueId=${issue.issueId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseErrorMessage(response));
        const { status } = (await response.json()) as { status?: unknown };
        if (!isIssueStatus(status)) throw new Error("二维码状态响应无效");
        if (active && status !== "active") finishIssue(issue, status);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        console.error("Issue status refresh failed", cause);
        if (phase === "confirming" && !confirmationFailureShownRef.current) {
          confirmationFailureShownRef.current = true;
          showToast("error", "暂时无法确认领取结果，请检查网络。");
        }
      } finally {
        inFlight = false;
      }
    };

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((issue.clientExpiresAt - Date.now()) / 1000));
      setRemaining(nextRemaining);
      if (nextRemaining === 0 && phase === "active") {
        setPhase("confirming");
        return;
      }
      void checkStatus();
    };

    tick();
    const timer = window.setInterval(tick, qrRefreshIntervalMs);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [eventId, finishIssue, issue, phase, showToast]);

  async function createIssue() {
    setBusy(true);
    const allocations = issueEvents.map((item) => ({
      eventId: item.id,
      allocation: item.ticketTypes.flatMap((type) =>
        quantities[type.id] ? [{ ticketTypeId: type.id, quantity: quantities[type.id]! }] : [],
      ),
    }));
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    try {
      const response = await fetch(`/api/admin/events/${eventId}/qr`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocations }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const data = (await response.json()) as IssueResponse;
      const serverRemaining = Math.max(
        0,
        new Date(data.expiresAt).getTime() - new Date(data.serverTime).getTime(),
      );
      setIssue({ ...data, clientExpiresAt: Date.now() + serverRemaining });
      setRemaining(Math.ceil(serverRemaining / 1000));
      setPhase(serverRemaining > 0 ? "active" : "confirming");
      confirmationFailureShownRef.current = false;
      showToast(
        "success",
        `现场二维码已发行，共 ${data.events?.reduce((sum, item) => sum + item.ticketTotal, 0) ?? data.allocation.reduce((sum, item) => sum + item.quantity, 0)} 张。`,
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      showToast("error", cause instanceof Error ? cause.message : "发行失败，请稍后重试。");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (mutationControllerRef.current === controller) mutationControllerRef.current = undefined;
    }
  }

  async function cancelIssue() {
    if (!issue) return;
    const currentIssue = issue;
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setPhase("cancelling");
    try {
      const response = await fetch(
        `/api/admin/events/${eventId}/qr?issueId=${currentIssue.issueId}`,
        { method: "DELETE", signal: controller.signal },
      );
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const { status } = (await response.json()) as { status?: unknown };
      if (!isIssueStatus(status) || status === "active") throw new Error("二维码撤销状态响应无效");
      finishIssue(currentIssue, status);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPhase(Date.now() >= currentIssue.clientExpiresAt ? "confirming" : "active");
      showToast("error", "二维码撤销失败，请稍后重试。");
    } finally {
      if (mutationControllerRef.current === controller) mutationControllerRef.current = undefined;
    }
  }

  async function revokeWorkflow(workflowId: string) {
    try {
      const response = await fetch(`/api/admin/events/${eventId}/qr?workflowId=${workflowId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      showToast("success", "进行中的连签已撤销，临时座位已释放。");
      await loadActiveWorkflows();
    } catch (cause) {
      showToast("error", cause instanceof Error ? cause.message : "连签撤销失败。");
    }
  }

  return (
    <main className="issue-screen admin-shell">
      <Link className="qr-back-button" href={backHref}>
        <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />
        返回活动详情
      </Link>
      <header className="section-header">
        <div>
          <p className="eyebrow">现场发行</p>
          <h1>{eventName}</h1>
          <p className="muted">分别选择各场票种与张数；后续场可选择 0 张。</p>
        </div>
      </header>
      <section className="panel wide issue-workbench">
        {issueEvents.map((issueEvent, eventIndex) => (
          <section className="issue-event-group" key={issueEvent.id}>
            <header>
              <div>
                <p className="eyebrow">{eventIndex === 0 ? "主场" : `后续场 ${eventIndex}`}</p>
                <h2>{issueEvent.name}</h2>
              </div>
              <strong>
                {eventTotals[issueEvent.id] ?? 0}/{issueEvent.maxTicketsPerIssue} 张
              </strong>
            </header>
            {issueEvent.ticketTypes.map((type) => (
              <fieldset className="issue-ticket-type" key={type.id}>
                <legend>{type.name}</legend>
                <div
                  className="quantity-tabs"
                  role="radiogroup"
                  aria-label={`${issueEvent.name} ${type.name}张数`}
                >
                  {Array.from({ length: issueEvent.maxTicketsPerIssue + 1 }, (_, quantity) => (
                    <label key={quantity}>
                      <input
                        type="radio"
                        name={`quantity:${type.id}`}
                        value={quantity}
                        checked={quantities[type.id] === quantity}
                        onChange={() =>
                          setQuantities((current) => ({ ...current, [type.id]: quantity }))
                        }
                        disabled={
                          (eventTotals[issueEvent.id] ?? 0) -
                            (quantities[type.id] ?? 0) +
                            quantity >
                          issueEvent.maxTicketsPerIssue
                        }
                      />
                      <span>{quantity}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
        ))}
        <div className="issue-actions">
          <strong>本次跨场合计 {total} 张</strong>
          <button
            className="button primary"
            type="button"
            disabled={busy || !validAllocation}
            onClick={() => void createIssue()}
          >
            {busy ? "正在发行…" : "发行二维码"}
          </button>
        </div>
      </section>
      {activeWorkflows.length ? (
        <section className="panel wide active-workflows" aria-labelledby="active-workflows-title">
          <h2 id="active-workflows-title">进行中的连签</h2>
          <ul className="record-list actionable-record-list">
            {activeWorkflows.map((workflow) => (
              <li key={workflow.id}>
                <div>
                  <strong>{workflow.events.join(" → ")}</strong>
                  <small>
                    领取于 {new Date(workflow.claimedAt).toLocaleTimeString("zh-CN")} · 最晚{" "}
                    {new Date(workflow.hardExpiresAt).toLocaleTimeString("zh-CN")}
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => void revokeWorkflow(workflow.id)}
                  >
                    撤销连签
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {issue ? (
        <div
          className="lottery-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-dialog-title"
        >
          <div className="lottery-modal issue-modal">
            <p className="eyebrow">单次领取二维码</p>
            <h2 id="issue-dialog-title">
              {phase === "active"
                ? "等待参与者扫码"
                : phase === "confirming"
                  ? "正在确认领取结果"
                  : "正在撤销二维码"}
            </h2>
            {phase === "active" ? (
              <BrandedQrCode src={issue.image} alt={`${eventName} 单次领取二维码`} />
            ) : null}
            <div className="ticket-summary issue-event-summary">
              {(
                issue.events ?? [
                  {
                    eventId,
                    eventName,
                    ticketTotal: issue.allocation.reduce((sum, item) => sum + item.quantity, 0),
                    allocation: issue.allocation.map((item) => ({
                      ...item,
                      ticketTypeId: item.id,
                    })),
                  },
                ]
              ).map((item) => (
                <section key={item.eventId}>
                  <strong>{item.eventName}</strong>
                  {item.allocation.map((ticket) => (
                    <span key={ticket.ticketTypeId}>
                      {ticket.name} × {ticket.quantity}
                    </span>
                  ))}
                </section>
              ))}
            </div>
            <strong>
              {phase === "active"
                ? `剩余 ${remaining} 秒`
                : phase === "confirming"
                  ? "二维码已隐藏，正在向服务器确认"
                  : "请稍候"}
            </strong>
            <button
              className="button"
              type="button"
              disabled={phase !== "active"}
              onClick={() => void cancelIssue()}
            >
              {phase === "cancelling"
                ? "正在撤销…"
                : phase === "confirming"
                  ? "正在确认…"
                  : "撤销二维码"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
