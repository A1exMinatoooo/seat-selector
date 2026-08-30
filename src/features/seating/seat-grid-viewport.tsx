"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const MIN_SCALE = 0.05;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;
const VIEWPORT_PADDING = 24;
const MINIMAP_MAX_WIDTH = 136;
const MINIMAP_MAX_HEIGHT = 96;
const MINIMAP_HIDE_DELAY = 800;

type MinimapViewport = { left: number; top: number; width: number; height: number };

export function seatGridMinimapSize(
  gridWidth: number,
  gridHeight: number,
): { width: number; height: number; scale: number } {
  if (gridWidth <= 0 || gridHeight <= 0) return { width: 0, height: 0, scale: 0 };
  const scale = Math.min(MINIMAP_MAX_WIDTH / gridWidth, MINIMAP_MAX_HEIGHT / gridHeight);
  return {
    width: Math.round(gridWidth * scale * 100) / 100,
    height: Math.round(gridHeight * scale * 100) / 100,
    scale,
  };
}

export function seatGridMinimapViewport(
  viewportWidth: number,
  viewportHeight: number,
  scrollLeft: number,
  scrollTop: number,
  canvasLeft: number,
  canvasTop: number,
  canvasWidth: number,
  canvasHeight: number,
): MinimapViewport {
  if (canvasWidth <= 0 || canvasHeight <= 0) return { left: 0, top: 0, width: 100, height: 100 };
  const visibleLeft = Math.min(canvasWidth, Math.max(0, scrollLeft - canvasLeft));
  const visibleTop = Math.min(canvasHeight, Math.max(0, scrollTop - canvasTop));
  const visibleRight = Math.max(
    visibleLeft,
    Math.min(canvasWidth, scrollLeft + viewportWidth - canvasLeft),
  );
  const visibleBottom = Math.max(
    visibleTop,
    Math.min(canvasHeight, scrollTop + viewportHeight - canvasTop),
  );
  return {
    left: (visibleLeft / canvasWidth) * 100,
    top: (visibleTop / canvasHeight) * 100,
    width: ((visibleRight - visibleLeft) / canvasWidth) * 100,
    height: ((visibleBottom - visibleTop) / canvasHeight) * 100,
  };
}

export function clampSeatGridScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function pinchSeatGridScale(
  startScale: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (startDistance <= 0 || currentDistance <= 0) return clampSeatGridScale(startScale);
  return Math.round(clampSeatGridScale((startScale * currentDistance) / startDistance) * 100) / 100;
}

export function fitSeatGridScale(
  viewportWidth: number,
  viewportHeight: number,
  gridWidth: number,
  gridHeight: number,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || gridWidth <= 0 || gridHeight <= 0) return 1;
  const fittedScale = clampSeatGridScale(
    Math.min(
      1,
      (viewportWidth - VIEWPORT_PADDING) / gridWidth,
      (viewportHeight - VIEWPORT_PADDING) / gridHeight,
    ),
  );
  return Math.floor(fittedScale * 100) / 100;
}

export function fitSeatGridHeightScale(viewportHeight: number, gridHeight: number): number {
  if (viewportHeight <= 0 || gridHeight <= 0) return 1;
  const fittedScale = clampSeatGridScale(
    Math.min(1, (viewportHeight - VIEWPORT_PADDING) / gridHeight),
  );
  return Math.floor(fittedScale * 100) / 100;
}

export function centeredSeatGridScrollLeft(
  viewportWidth: number,
  scrollWidth: number,
  focusOffsetX: number,
): number {
  const maximumScroll = Math.max(0, scrollWidth - viewportWidth);
  return Math.min(maximumScroll, Math.max(0, focusOffsetX - viewportWidth / 2));
}

export function frozenSeatCoordinateTop(elementTop: number, viewportTop: number): number {
  return Math.round((elementTop - viewportTop) * 100) / 100;
}

type SeatGridViewportProps = {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  gesturesEnabled?: boolean;
  interactionHint?: ReactNode;
  legend?: ReactNode;
  layoutKey?: string;
  mobileMinimap?: boolean;
};

type FrozenCoordinate = { key: string; label: string; top: number; height: number };

function sameCoordinates(left: FrozenCoordinate[], right: FrozenCoordinate[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        item.key === other.key &&
        item.label === other.label &&
        item.top === other.top &&
        item.height === other.height
      );
    })
  );
}

export function SeatGridViewport({
  children,
  ariaLabel,
  className = "",
  gesturesEnabled = true,
  interactionHint,
  legend,
  layoutKey = "default",
  mobileMinimap = false,
}: SeatGridViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const minimapContentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const minimapHideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const minimapVisibleRef = useRef(false);
  const initialViewAppliedRef = useRef(false);
  const activeLayoutKeyRef = useRef(layoutKey);
  const userAdjustedViewRef = useRef(false);
  const applyingFitRef = useRef(false);
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [frozenCoordinates, setFrozenCoordinates] = useState<FrozenCoordinate[]>([]);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [minimapViewport, setMinimapViewport] = useState<MinimapViewport>({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });

  const fitGrid = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || gridSize.width <= 0 || gridSize.height <= 0) return;
    const nextScale = fitSeatGridScale(
      viewport.clientWidth,
      viewport.clientHeight,
      gridSize.width,
      gridSize.height,
    );
    applyingFitRef.current = true;
    scaleRef.current = nextScale;
    setScale(nextScale);
    viewport.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(() => {
      applyingFitRef.current = false;
    });
  }, [gridSize.height, gridSize.width]);

  const measureMinimapViewport = useCallback(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    setMinimapViewport(
      seatGridMinimapViewport(
        viewport.clientWidth,
        viewport.clientHeight,
        viewport.scrollLeft,
        viewport.scrollTop,
        canvas.offsetLeft,
        canvas.offsetTop,
        canvas.offsetWidth,
        canvas.offsetHeight,
      ),
    );
  }, []);

  const showMinimapDuringNavigation = useCallback(() => {
    if (!mobileMinimap) return;
    minimapVisibleRef.current = true;
    setMinimapVisible(true);
    clearTimeout(minimapHideTimerRef.current);
    minimapHideTimerRef.current = setTimeout(() => {
      minimapVisibleRef.current = false;
      setMinimapVisible(false);
    }, MINIMAP_HIDE_DELAY);
  }, [mobileMinimap]);

  const measureCoordinates = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const viewportRect = viewport.getBoundingClientRect();
    const next = [...content.querySelectorAll<HTMLElement>("[data-seat-row-coordinate]")].map(
      (element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          key: element.dataset.seatRowKey ?? String(index),
          label: element.dataset.seatRowCoordinate ?? "",
          top: frozenSeatCoordinateTop(rect.top, viewportRect.top),
          height: Math.round(rect.height * 100) / 100,
        };
      },
    );
    setFrozenCoordinates((current) => (sameCoordinates(current, next) ? current : next));
  }, []);

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
    if (!mobileMinimap) return;
    const content = contentRef.current;
    const minimapContent = minimapContentRef.current;
    if (!content || !minimapContent) return;
    const copyContent = () => {
      minimapContent.replaceChildren(
        ...[...content.childNodes].map((node) => node.cloneNode(true)),
      );
    };
    copyContent();
    const observer = new MutationObserver(copyContent);
    observer.observe(content, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [mobileMinimap]);

  useLayoutEffect(
    () => () => {
      clearTimeout(minimapHideTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measureCoordinates();
        measureMinimapViewport();
      });
    };
    const noteTouchNavigation = () => showMinimapDuringNavigation();
    const noteScrollNavigation = () => {
      if (!applyingFitRef.current) userAdjustedViewRef.current = true;
      if (minimapVisibleRef.current) showMinimapDuringNavigation();
      schedule();
    };
    schedule();
    viewport.addEventListener("touchmove", noteTouchNavigation, { passive: true });
    viewport.addEventListener("scroll", noteScrollNavigation, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("touchmove", noteTouchNavigation);
      viewport.removeEventListener("scroll", noteScrollNavigation);
      observer.disconnect();
    };
  }, [measureCoordinates, measureMinimapViewport, scale, showMinimapDuringNavigation]);

  useLayoutEffect(() => {
    if (activeLayoutKeyRef.current !== layoutKey) {
      activeLayoutKeyRef.current = layoutKey;
      initialViewAppliedRef.current = false;
      userAdjustedViewRef.current = false;
    }
    if (!initialViewAppliedRef.current || !userAdjustedViewRef.current) {
      initialViewAppliedRef.current = true;
      fitGrid();
    }
  }, [fitGrid, layoutKey]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!userAdjustedViewRef.current) fitGrid();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitGrid]);

  useLayoutEffect(() => {
    const currentViewport = viewportRef.current;
    if (!currentViewport) return;
    const viewport: HTMLDivElement = currentViewport;
    if (!gesturesEnabled) pinchRef.current = null;

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
      if (!gesturesEnabled) return;
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
      userAdjustedViewRef.current = true;
    }

    function movePinch(event: TouchEvent) {
      if (!gesturesEnabled) return;
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
  }, [gesturesEnabled]);

  function updateScale(nextScale: number) {
    userAdjustedViewRef.current = true;
    const normalizedScale = Math.round(clampSeatGridScale(nextScale) * 100) / 100;
    scaleRef.current = normalizedScale;
    setScale(normalizedScale);
  }

  const canvasStyle = {
    width: `${gridSize.width * scale}px`,
    height: `${gridSize.height * scale}px`,
  } satisfies CSSProperties;
  const contentStyle = { transform: `scale(${scale})` } satisfies CSSProperties;
  const minimapSize = seatGridMinimapSize(gridSize.width, gridSize.height);
  const minimapStyle = {
    width: `${minimapSize.width}px`,
    height: `${minimapSize.height}px`,
  } satisfies CSSProperties;
  const minimapContentStyle = {
    transform: `scale(${minimapSize.scale})`,
  } satisfies CSSProperties;
  const minimapViewportStyle = {
    left: `${minimapViewport.left}%`,
    top: `${minimapViewport.top}%`,
    width: `${minimapViewport.width}%`,
    height: `${minimapViewport.height}%`,
  } satisfies CSSProperties;

  return (
    <section
      className={`seat-grid-viewport ${gesturesEnabled ? "gestures-enabled" : "gestures-disabled"} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {legend ? <div className="seat-grid-legend">{legend}</div> : null}
      <div className="seat-grid-viewport-toolbar" role="toolbar" aria-label="座位网格缩放">
        <button
          type="button"
          aria-label="缩小座位网格"
          disabled={scale <= MIN_SCALE}
          onClick={() => updateScale(scale - SCALE_STEP)}
        >
          <ZoomOut aria-hidden="true" size={20} strokeWidth={2} />
        </button>
        <button type="button" aria-label="恢复座位网格为百分之百" onClick={() => updateScale(1)}>
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          aria-label="放大座位网格"
          disabled={scale >= MAX_SCALE}
          onClick={() => updateScale(scale + SCALE_STEP)}
        >
          <ZoomIn aria-hidden="true" size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="缩放以显示完整座位网格"
          onClick={() => {
            userAdjustedViewRef.current = false;
            fitGrid();
          }}
        >
          显示完整
        </button>
      </div>
      {interactionHint}
      <div className="seat-grid-viewport-stage">
        {mobileMinimap ? (
          <div
            className={`seat-grid-minimap ${minimapVisible ? "visible" : ""}`}
            style={minimapStyle}
            aria-hidden="true"
            inert
          >
            <div
              ref={minimapContentRef}
              className="seat-grid-minimap-content"
              style={minimapContentStyle}
            />
            <span className="seat-grid-minimap-window" style={minimapViewportStyle} />
          </div>
        ) : null}
        <div className="seat-grid-fixed-y-axis" aria-hidden="true">
          {frozenCoordinates.map((coordinate) => (
            <span key={coordinate.key} style={{ top: coordinate.top, height: coordinate.height }}>
              {coordinate.label}
            </span>
          ))}
        </div>
        <div
          ref={viewportRef}
          className="seat-grid-viewport-body"
          tabIndex={0}
          aria-label={`${ariaLabel}，可横向和纵向滚动`}
        >
          <div ref={canvasRef} className="seat-grid-viewport-canvas" style={canvasStyle}>
            <div ref={contentRef} className="seat-grid-scaled-content" style={contentStyle}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
