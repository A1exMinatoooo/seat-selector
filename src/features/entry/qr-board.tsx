"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const qrRefreshIntervalMs = 1_000;
type QrData = { image: string; expiresIn: number; serverTime: string };

export function QrBoard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [data, setData] = useState<QrData>();

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/admin/events/${eventId}/qr`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const nextData = await response.json() as QrData;
          if (active) setData(nextData);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("QR refresh failed", error);
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
      <div><p className="eyebrow">现场扫码入场</p><h1>{eventName}</h1><p>二维码动态更新，请在现场完成定位与身份验证</p></div>
      {data ? (
        <div className="qr-frame">
          <Image unoptimized width={720} height={720} src={data.image} alt={`${eventName} 动态入场二维码`} />
          <strong>二维码将在 {data.expiresIn} 秒内更新</strong>
          <time>{new Date(data.serverTime).toLocaleString("zh-CN")}</time>
        </div>
      ) : <div className="qr-frame loading">正在生成安全二维码…</div>}
    </main>
  );
}
