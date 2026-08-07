"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ParticipantSessionRestore({ code, eventName }: { code: string; eventName: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/events/${encodeURIComponent(code)}/restore-session`, { method: "POST", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Session restore failed with ${response.status}`);
        router.refresh();
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Participant session restore failed", error);
        setFailed(true);
      });
    return () => controller.abort();
  }, [code, router]);

  return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">{eventName}</p><h1>{failed ? "恢复失败" : "正在恢复选座进度"}</h1><p>{failed ? "请刷新页面重试；如仍无法恢复，请重新扫描现场二维码。" : "已识别当前设备，请稍候。"}</p></section></main>;
}
