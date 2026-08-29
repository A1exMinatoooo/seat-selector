"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AdminActionState } from "./admin-action-state";

type ToastKind = "success" | "error";
type ToastValue = { id: number; kind: ToastKind; message: string };

const noticeMessages = {
  "event-draft-saved": "活动草稿已保存。",
  "event-opened": "活动已开放。",
  "event-reopened": "活动已重新开放。",
  "event-ended": "活动已结束。",
  "location-updated": "地点变更已保存。",
  "location-deleted": "地点已删除。",
  "hall-template-updated": "影厅模板已保存。",
  "hall-template-deleted": "影厅模板已删除。",
  "participant-device-reset": "设备已解绑。",
  "location-exemption-enabled": "已开启定位豁免。",
  "location-exemption-disabled": "已取消定位豁免。",
  "selection-reset": "选座已清除。",
} as const;

const AdminToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastValue>();
  const timerRef = useRef<number>(undefined);
  const nextIdRef = useRef(1);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    window.clearTimeout(timerRef.current);
    setToast({ id: nextIdRef.current++, kind, message });
    timerRef.current = window.setTimeout(() => setToast(undefined), 4_000);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const contextValue = useMemo(() => showToast, [showToast]);
  return (
    <AdminToastContext.Provider value={contextValue}>
      {children}
      <Suspense fallback={null}>
        <AdminNoticeConsumer showToast={showToast} />
      </Suspense>
      {toast ? (
        <div
          className={`toast admin-save-toast ${toast.kind}`}
          key={toast.id}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      ) : null}
    </AdminToastContext.Provider>
  );
}

function AdminNoticeConsumer({
  showToast,
}: {
  showToast: (kind: ToastKind, message: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const notice = searchParams.get("notice");
    if (!notice || !(notice in noticeMessages)) return;
    showToast("success", noticeMessages[notice as keyof typeof noticeMessages]);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("notice");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, showToast]);
  return null;
}

export function useAdminToast() {
  const showToast = useContext(AdminToastContext);
  if (!showToast) throw new Error("useAdminToast must be used within AdminToastProvider");
  return showToast;
}

export function useAdminActionToast(state: AdminActionState) {
  const showToast = useAdminToast();
  useEffect(() => {
    if (state.status !== "idle") showToast(state.status, state.message);
  }, [showToast, state.message, state.status, state.submission]);
}
