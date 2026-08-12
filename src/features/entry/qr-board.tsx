"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { responseErrorMessage } from "@/shared/error-message";

const qrRefreshIntervalMs = 1_000;
type TicketType = { id: string; name: string };
type QrData = { image: string; expiresIn: number; serverTime: string };
type IssueData = QrData & { issueId: string; allocation: Array<TicketType & { quantity: number }> };

export function QrBoard({ eventId, eventName, backHref, participationMode = "preregistered", maxTicketsPerIssue = 3, ticketTypes = [] }: { eventId: string; eventName: string; backHref: string; participationMode?: "onsite" | "preregistered"; maxTicketsPerIssue?: number; ticketTypes?: TicketType[] }) {
  if (participationMode === "onsite") return <OnsiteIssueBoard eventId={eventId} eventName={eventName} backHref={backHref} maxTicketsPerIssue={maxTicketsPerIssue} ticketTypes={ticketTypes} />;
  return <RotatingQrBoard eventId={eventId} eventName={eventName} backHref={backHref} />;
}

function RotatingQrBoard({ eventId, eventName, backHref }: { eventId: string; eventName: string; backHref: string }) {
  const [data, setData] = useState<QrData>();
  useEffect(() => {
    let active = true; let inFlight = false; const controller = new AbortController();
    const load = async () => { if (inFlight) return; inFlight = true; try { const response = await fetch(`/api/admin/events/${eventId}/qr`, { cache: "no-store", signal: controller.signal }); if (response.ok) { const nextData = await response.json() as QrData; if (active) setData(nextData); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) console.error("QR refresh failed", error); } finally { inFlight = false; } };
    void load(); const timer = window.setInterval(() => void load(), qrRefreshIntervalMs);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [eventId]);
  return <main className="qr-screen"><div><aside className="qr-scan-notice" role="note">建议使用微信扫描二维码，后续可在同一微信中查看今日选座记录。</aside><Link className="qr-back-button" href={backHref}>← 返回活动详情</Link><p className="eyebrow">现场扫码入场</p><h1>{eventName}</h1><p>二维码动态更新，请在现场完成定位与身份验证</p></div>{data ? <div className="qr-frame"><Image unoptimized width={720} height={720} src={data.image} alt={`${eventName} 动态入场二维码`} /><strong>二维码将在 {data.expiresIn} 秒内更新</strong><time>{new Date(data.serverTime).toLocaleString("zh-CN")}</time></div> : <div className="qr-frame loading">正在生成安全二维码…</div>}</main>;
}

function OnsiteIssueBoard({ eventId, eventName, backHref, maxTicketsPerIssue, ticketTypes }: { eventId: string; eventName: string; backHref: string; maxTicketsPerIssue: number; ticketTypes: TicketType[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(ticketTypes.map((type) => [type.id, 0])));
  const [issue, setIssue] = useState<IssueData>();
  const [status, setStatus] = useState<"active" | "claimed" | "expired" | "replaced">("active");
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = useMemo(() => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0), [quantities]);

  useEffect(() => {
    if (!issue || status !== "active") return;
    const serverOffset = new Date(issue.serverTime).getTime() - Date.now();
    const expiresAt = new Date(issue.serverTime).getTime() + issue.expiresIn * 1000;
    const update = () => setRemaining(Math.max(0, Math.ceil((expiresAt - (Date.now() + serverOffset)) / 1000)));
    update();
    const timer = window.setInterval(async () => {
      update();
      try { const response = await fetch(`/api/admin/events/${eventId}/qr?issueId=${issue.issueId}`, { cache: "no-store" }); if (response.ok) setStatus(((await response.json()) as { status: typeof status }).status); } catch (cause) { console.error("Issue status refresh failed", cause); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [eventId, issue, status]);

  async function createIssue() {
    setBusy(true); setError("");
    const allocation = ticketTypes.flatMap((type) => quantities[type.id] ? [{ ticketTypeId: type.id, quantity: quantities[type.id]! }] : []);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/qr`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ allocation }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const data = await response.json() as IssueData;
      setIssue(data); setRemaining(data.expiresIn); setStatus("active");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "发行失败，请稍后重试。"); }
    finally { setBusy(false); }
  }

  return <main className="issue-screen admin-shell">
    <Link className="qr-back-button" href={backHref}>← 返回活动详情</Link>
    <header className="section-header"><div><p className="eyebrow">现场发行</p><h1>{eventName}</h1><p className="muted">选择本次票种与张数，合计最多 {maxTicketsPerIssue} 张。</p></div></header>
    <section className="panel wide issue-workbench">
      {ticketTypes.map((type) => <fieldset className="issue-ticket-type" key={type.id}><legend>{type.name}</legend><div className="quantity-tabs" role="radiogroup" aria-label={`${type.name}张数`}>{Array.from({ length: maxTicketsPerIssue + 1 }, (_, quantity) => <label key={quantity}><input type="radio" name={`quantity:${type.id}`} value={quantity} checked={quantities[type.id] === quantity} onChange={() => setQuantities((current) => ({ ...current, [type.id]: quantity }))} disabled={total - (quantities[type.id] ?? 0) + quantity > maxTicketsPerIssue} /><span>{quantity}</span></label>)}</div></fieldset>)}
      <div className="issue-actions"><strong>本次合计 {total}/{maxTicketsPerIssue} 张</strong><button className="button primary" type="button" disabled={busy || total < 1 || total > maxTicketsPerIssue} onClick={() => void createIssue()}>{busy ? "正在发行…" : "发行二维码"}</button></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
    {issue ? <div className="lottery-backdrop" role="dialog" aria-modal="true" aria-labelledby="issue-dialog-title"><div className="lottery-modal issue-modal"><p className="eyebrow">单次领取二维码</p><h2 id="issue-dialog-title">{status === "active" ? "等待参与者扫码" : status === "claimed" ? "领取成功" : status === "expired" ? "二维码已过期" : "二维码已被新发行替换"}</h2>{status === "active" ? <Image unoptimized width={720} height={720} src={issue.image} alt={`${eventName} 单次领取二维码`} /> : null}<div className="ticket-summary">{issue.allocation.map((item) => <span key={item.id}>{item.name} × {item.quantity}</span>)}</div><strong>{status === "active" ? `剩余 ${remaining} 秒` : "本二维码已失效"}</strong>{status !== "active" ? <button className="button primary" type="button" onClick={() => setIssue(undefined)}>关闭</button> : <button className="button" type="button" onClick={() => setIssue(undefined)}>取消显示</button>}</div></div> : null}
  </main>;
}
