"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reportBrowserLocationFailure } from "./location-audit";
import { responseErrorMessage } from "@/shared/error-message";

export function LocationGate({ code, eventName }: { code: string; eventName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function locate() {
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const response = await fetch("/api/location/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: position.timestamp }) });
      setBusy(false);
      if (response.ok) router.refresh();
      else setError(await responseErrorMessage(response));
    }, (locationError) => {
      setBusy(false);
      setError("无法获取定位，请开启权限后重试。");
      void reportBrowserLocationFailure(code, locationError.code);
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  }

  return <main className="participant-shell"><section className="participant-card"><p className="eyebrow">{eventName}</p><h1>验证现场位置</h1><p>需要确认你已到达活动现场，才可以进入座位图。</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button primary" disabled={busy} onClick={locate}>{busy ? "正在定位…" : "允许定位并进入"}</button></section></main>;
}
