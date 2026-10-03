"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useAdminActionPending } from "./admin-action-form";

export function AdminSubmitButton({
  children,
  pendingLabel,
  className = "button primary",
}: {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = useAdminActionPending() || formPending;
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
