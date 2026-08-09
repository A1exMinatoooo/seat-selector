"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;
const VIEWPORT_PADDING = 24;

export function clampSeatGridScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function pinchSeatGridScale(startScale: number, startDistance: number, currentDistance: number): number {
  if (startDistance <= 0 || currentDistance <= 0) return clampSeatGridScale(startScale);
  return Math.round(clampSeatGridScale(startScale * currentDistance / startDistance) * 100) / 100;
}

export function fitSeatGridScale(viewportWidth: number, viewportHeight: number, gridWidth: number, gridHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || gridWidth <= 0 || gridHeight <= 0) return 1;
  const fittedScale = clampSeatGridScale(Math.min(1, (viewportWidth - VIEWPORT_PADDING) / gridWidth, (viewportHeight - VIEWPORT_PADDING) / gridHeight));
  return Math.floor(fittedScale * 100) / 100;
}

export function SeatGridViewport({ children, ariaLabel, className = "" }: { children: ReactNode; ariaLabel: string; className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const pinchRef = useRef<{ distance: number; scale: number; contentX: number; contentY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });

  const measureGrid = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    setGridSize({ width: content.offsetWidth, height: content.offsetHeight });
  }, []);

  useLayoutEffect(() => {
    measureGrid();
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(measureGrid);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measureGrid]);

  useLayoutEffect(() => {
    const currentViewport = viewportRef.current;
    if (!currentViewport) return;
    const viewport: HTMLDivElement = currentViewport;

    function touchGeometry(event: TouchEvent) {
      const first = event.touches.item(0);
      const second = event.touches.item(1);
      if (!first || !second) return null;
      return {
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        centerX: (first.clientX + second.clientX) / 2,
        centerY: (first.clientY + second.clientY) / 2,
      };
    }

    function beginPinch(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      const geometry = touchGeometry(event);
      if (!geometry || geometry.distance <= 0) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const localX = geometry.centerX - rect.left;
      const localY = geometry.centerY - rect.top;
      pinchRef.current = {
        distance: geometry.distance,
        scale: scaleRef.current,
        contentX: (viewport.scrollLeft + localX) / scaleRef.current,
        contentY: (viewport.scrollTop + localY) / scaleRef.current,
      };
    }

    function movePinch(event: TouchEvent) {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      const geometry = touchGeometry(event);
      if (!geometry) return;
      event.preventDefault();
      const nextScale = pinchSeatGridScale(pinch.scale, pinch.distance, geometry.distance);
      const rect = viewport.getBoundingClientRect();
      const localX = geometry.centerX - rect.left;
      const localY = geometry.centerY - rect.top;
      scaleRef.current = nextScale;
      setScale(nextScale);
      requestAnimationFrame(() => {
        viewport.scrollLeft = pinch.contentX * nextScale - localX;
        viewport.scrollTop = pinch.contentY * nextScale - localY;
      });
    }

    function endPinch(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null;
    }

    viewport.addEventListener("touchstart", beginPinch, { passive: false });
    viewport.addEventListener("touchmove", movePinch, { passive: false });
    viewport.addEventListener("touchend", endPinch);
    viewport.addEventListener("touchcancel", endPinch);
    return () => {
      viewport.removeEventListener("touchstart", beginPinch);
      viewport.removeEventListener("touchmove", movePinch);
      viewport.removeEventListener("touchend", endPinch);
      viewport.removeEventListener("touchcancel", endPinch);
    };
  }, []);

  function updateScale(nextScale: number) {
    const normalizedScale = Math.round(clampSeatGridScale(nextScale) * 100) / 100;
    scaleRef.current = normalizedScale;
    setScale(normalizedScale);
  }

  function fitGrid() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateScale(fitSeatGridScale(viewport.clientWidth, viewport.clientHeight, gridSize.width, gridSize.height));
    viewport.scrollTo({ top: 0, left: 0 });
  }

  const canvasStyle = {
    width: `${gridSize.width * scale}px`,
    height: `${gridSize.height * scale}px`,
  } satisfies CSSProperties;
  const contentStyle = { transform: `scale(${scale})` } satisfies CSSProperties;

  return (
    <section className={`seat-grid-viewport ${className}`.trim()} aria-label={ariaLabel}>
      <div className="seat-grid-viewport-toolbar" role="toolbar" aria-label="座位网格缩放">
        <button type="button" aria-label="缩小座位网格" disabled={scale <= MIN_SCALE} onClick={() => updateScale(scale - SCALE_STEP)}>−</button>
        <button type="button" aria-label="恢复座位网格为百分之百" onClick={() => updateScale(1)}>{Math.round(scale * 100)}%</button>
        <button type="button" aria-label="放大座位网格" disabled={scale >= MAX_SCALE} onClick={() => updateScale(scale + SCALE_STEP)}>＋</button>
        <button type="button" aria-label="缩放以显示完整座位网格" onClick={fitGrid}>显示完整</button>
      </div>
      <div ref={viewportRef} className="seat-grid-viewport-body" tabIndex={0} aria-label={`${ariaLabel}，可横向和纵向滚动`}>
        <div className="seat-grid-viewport-canvas" style={canvasStyle}>
          <div ref={contentRef} className="seat-grid-scaled-content" style={contentStyle}>{children}</div>
        </div>
      </div>
    </section>
  );
}
