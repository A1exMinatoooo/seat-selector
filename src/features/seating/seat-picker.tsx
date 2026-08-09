"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { reportBrowserLocationFailure } from "./location-audit";
import { displaySeatNumber, formatSeatLabel } from "@/shared/seat-label";
import { centerDividerOffset } from "./public-seat-layout";
import { responseErrorMessage } from "@/shared/error-message";

export type SeatDto = { id: string; rowIndex: number; columnIndex: number; rowLabel: string; columnLabel: string; kind: "seat" | "aisle" | "empty"; selectable: boolean; golden: boolean };

export function SeatPicker({ code, eventName, seats, initialAvailable, initialOccupied, initialVersion, ticketTotal, centerAfterColumn, skipLocationCheck }: { code: string; eventName: string; seats: SeatDto[]; initialAvailable: string[]; initialOccupied: string[]; initialVersion: number; ticketTotal: number; centerAfterColumn: number | null; skipLocationCheck: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [occupied, setOccupied] = useState(() => new Set(initialOccupied));
  const [available, setAvailable] = useState(() => new Set(initialAvailable));
  const [version, setVersion] = useState(initialVersion);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef(selected);
  const pendingDisplacedRef = useRef(new Set<string>());
  const reportingDisplacedRef = useRef(false);
  const columns = Math.max(...seats.map((seat) => seat.columnIndex), 0) + 1;

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/events/${code}/seating-entered`, { method: "POST", signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Seating entry audit failed with ${response.status}`);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Seating entry audit failed", error);
    });
    return () => controller.abort();
  }, [code]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  }, []);

  const reportDisplaced = useCallback(async () => {
    if (reportingDisplacedRef.current || pendingDisplacedRef.current.size === 0) return;
    reportingDisplacedRef.current = true;
    const seatIds = [...pendingDisplacedRef.current];
    try {
      const response = await fetch(`/api/events/${code}/selection-displaced`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seatIds }),
      });
      if (!response.ok) throw new Error(`Selection displacement audit failed with ${response.status}`);
      seatIds.forEach((seatId) => pendingDisplacedRef.current.delete(seatId));
    } catch (error) {
      console.error("Selection displacement audit failed", error);
    } finally {
      reportingDisplacedRef.current = false;
    }
  }, [code]);

  const refresh = useCallback(async () => {
    void reportDisplaced();
    const response = await fetch(`/api/events/${code}/seat-state?version=${version}`, { cache: "no-store" });
    if (response.status === 204 || !response.ok) return;
    const data = await response.json() as { version: number; occupiedSeatIds: string[]; availableSeatIds: string[] };
    const next = new Set(data.occupiedSeatIds);
    const displaced = selectedRef.current.filter((seatId) => next.has(seatId));
    setVersion(data.version);
    setOccupied(next);
    setAvailable(new Set(data.availableSeatIds));
    const noLongerAvailable = selectedRef.current.filter((seatId) => !data.availableSeatIds.includes(seatId));
    if (displaced.length || noLongerAvailable.length) {
      displaced.forEach((seatId) => pendingDisplacedRef.current.add(seatId));
      setSelected((old) => old.filter((seatId) => !next.has(seatId) && data.availableSeatIds.includes(seatId)));
      showToast(displaced.length ? "你选中的座位刚刚被他人确认，请重新选择。" : "活动开放范围已更新，请重新选择。");
      void reportDisplaced();
    }
  }, [code, reportDisplaced, showToast, version]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    const schedule = () => {
      timer = setTimeout(async () => {
        try {
          await refresh();
        } finally {
          if (active) schedule();
        }
      }, document.hidden ? 15_000 : 3_000);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void refresh();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [refresh]);

  function toggle(seat: SeatDto) {
    if (occupied.has(seat.id)) {
      showToast("这个座位已被其他参与者选择。");
      return;
    }
    if (!seat.selectable || seat.kind !== "seat" || !available.has(seat.id)) return;
    setSelected((old) => old.includes(seat.id) ? old.filter((id) => id !== seat.id) : old.length >= ticketTotal ? (showToast(`最多选择 ${ticketTotal} 个座位`), old) : [...old, seat.id]);
  }

  async function submitSelection() {
    const response = await fetch(`/api/events/${code}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatIds: selected }) });
    setBusy(false);
    if (response.ok) router.refresh();
    else {
      showToast(await responseErrorMessage(response));
      await refresh();
    }
  }

  function confirm() {
    if (selected.length !== ticketTotal) return;
    setBusy(true);
    if (skipLocationCheck) {
      void submitSelection();
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = await fetch("/api/location/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: position.timestamp }) });
      if (!location.ok) {
        setBusy(false);
        showToast("确认前的定位验证未通过。");
        return;
      }
      await submitSelection();
    }, (locationError) => {
      setBusy(false);
      showToast("无法获取定位，暂时不能确认选座。");
      void reportBrowserLocationFailure(code, locationError.code);
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  }

  const selectedLabels = useMemo(() => selected.map((id) => {
    const seat = seats.find((item) => item.id === id);
    return seat ? formatSeatLabel(seat.rowLabel, seat.columnLabel) : "";
  }).filter(Boolean), [seats, selected]);

  return <main className="seat-page"><header><p className="eyebrow">{eventName}</p><h1>挑选你的座位</h1><div className="legend"><span className="available">可选</span><span className="golden">黄金区</span><span className="occupied">已选</span><span className="blocked">不可选</span></div></header><section className="seat-map-wrap"><div className="screen">银幕方向</div><div className={`public-seat-grid ${centerAfterColumn === null ? "" : "has-center-divider"}`} style={{ gridTemplateColumns: `repeat(${columns}, 42px)`, "--center-divider-column": (centerAfterColumn ?? Math.floor(columns / 2)) + 1, "--center-offset": `${centerDividerOffset(columns, centerAfterColumn)}px` } as CSSProperties}>{seats.map((seat) => <button key={seat.id} type="button" aria-label={formatSeatLabel(seat.rowLabel, seat.columnLabel)} disabled={seat.kind !== "seat" || !seat.selectable || !available.has(seat.id)} className={`public-seat ${seat.kind} ${seat.golden ? "golden" : ""} ${occupied.has(seat.id) ? "occupied" : ""} ${selected.includes(seat.id) ? "mine" : ""}`} onClick={() => toggle(seat)}>{seat.kind === "seat" ? displaySeatNumber(seat.columnLabel) : ""}</button>)}</div></section><footer className="selection-bar"><div><strong>已选 {selected.length}/{ticketTotal}</strong><span>{selectedLabels.length ? selectedLabels.join("、") : "请在上方点选座位"}</span></div><button className="button primary" disabled={selected.length !== ticketTotal || busy} onClick={confirm}>{busy ? "正在确认…" : "确认选座"}</button></footer>{toast ? <div className="toast" role="status">{toast}</div> : null}</main>;
}
