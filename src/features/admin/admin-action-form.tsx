"use client";

import { type FormEvent, type ReactNode, useActionState, useEffect, useRef } from "react";
import { type AdminFormAction, initialAdminActionState } from "./admin-action-state";
import { useAdminActionToast } from "./admin-toast";

export function AdminActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess = false,
}: {
  action: AdminFormAction;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialAdminActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useAdminActionToast(state);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state.status, state.submission]);

  function confirmSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form ref={formRef} action={formAction} className={className} onSubmit={confirmSubmit}>
      {children}
    </form>
  );
}
