"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ConsecutiveSessionRestore({
  code,
  eventName,
}: {
  code: string;
  eventName: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/events/${code}/workflow/restore`, {
      method: "POST",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        router.refresh();
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [code, router]);
  return (
    <main className="participant-shell">
      <section className="participant-card">
        <p className="eyebrow">{eventName}</p>
        <h1>{failed ? "恢复失败" : "正在恢复连签进度"}</h1>
        <p>
          {failed
            ? "请刷新页面重试；如仍无法恢复，请联系现场工作人员。"
            : "已识别当前设备，请稍候。"}
        </p>
      </section>
    </main>
  );
}
