"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { responseErrorMessage } from "@/shared/error-message";

export function ConsecutiveSessionRestore({
  code,
  eventName,
}: {
  code: string;
  eventName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/events/${code}/workflow/restore`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseErrorMessage(response));
        router.refresh();
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(
          error instanceof TypeError
            ? "网络连接失败，请检查网络后重试。"
            : error instanceof Error
              ? error.message
              : "恢复连签进度失败，请重试。",
        );
      });
    return () => controller.abort();
  }, [attempt, code, router]);
  return (
    <main className="participant-shell">
      <section className="participant-card">
        <p className="eyebrow">{eventName}</p>
        <h1>{error ? "恢复失败" : "正在恢复连签进度"}</h1>
        <p>{error || "已识别当前设备，请稍候。"}</p>
        {error ? <button className="button primary" type="button" onClick={() => { setError(""); setAttempt((old) => old + 1); }}>重新恢复</button> : null}
      </section>
    </main>
  );
}
