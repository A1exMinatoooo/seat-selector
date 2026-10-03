"use client";

import {
  createContext,
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";
import { type AdminFormAction, initialAdminActionState } from "./admin-action-state";
import { useAdminActionToast } from "./admin-toast";

const AdminActionPendingContext = createContext(false);
function resolveActionField(form: HTMLFormElement, key: string) {
  function isVisible(element: HTMLElement) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[hidden], [inert]") &&
      !(element instanceof HTMLInputElement && element.type === "hidden")
    );
  }

  const keyedRoot = Array.from(form.querySelectorAll<HTMLElement>("[data-field-error-key]")).find(
    (element) => element.dataset.fieldErrorKey === key,
  );
  if (keyedRoot) {
    const control = [
      ...keyedRoot.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button, [role="combobox"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])',
      ),
      keyedRoot,
    ].find(
      (element) =>
        isVisible(element) &&
        !(element as HTMLInputElement).disabled &&
        (element.tabIndex >= 0 ||
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLButtonElement),
    );
    return control ? { root: keyedRoot, control } : undefined;
  }

  const control = Array.from(form.querySelectorAll<HTMLElement>("input, textarea, select")).find(
    (element) =>
      element.getAttribute("name") === key &&
      isVisible(element) &&
      !(element as HTMLInputElement).disabled,
  );
  return control ? { root: control, control } : undefined;
}

export function useAdminActionPending() {
  return useContext(AdminActionPendingContext);
}

export function AdminActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess = false,
  onSuccess,
  clearFieldsOnError = [],
}: {
  action: AdminFormAction;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (submission: number) => void;
  clearFieldsOnError?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialAdminActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const submitPendingRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  useAdminActionToast(state);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!pending) submitPendingRef.current = false;
  }, [pending]);

  useEffect(() => {
    if (state.status !== "success") return;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccessRef.current?.(state.submission);
  }, [resetOnSuccess, state.status, state.submission]);
  useEffect(() => {
    if (state.status !== "error" || !clearFieldsOnError.length) return;
    const form = formRef.current;
    if (!form) return;
    const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    );
    for (const field of fields) {
      if (!field.name || !clearFieldsOnError.includes(field.name)) continue;
      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
        field.checked = false;
      } else {
        field.value = "";
      }
    }
  }, [clearFieldsOnError, state.status, state.submission]);

  useEffect(() => {
    const form = formRef.current;
    const errors = state.status === "error" ? Object.entries(state.fieldErrors ?? {}) : [];
    if (!form || !errors.length) return;

    const controlsBefore = new Map<
      HTMLElement,
      { id: string | null; ariaInvalid: string | null; ariaDescribedBy: string | null }
    >();
    const inlineErrors = new Map<HTMLElement, HTMLSpanElement>();
    let firstControl: HTMLElement | undefined;

    const applyErrors = () => {
      firstControl = undefined;
      for (const [root, inlineError] of inlineErrors) {
        if (!root.isConnected) {
          inlineError.remove();
          inlineErrors.delete(root);
        }
      }
      for (const [index, [key, message]] of errors.entries()) {
        const resolved = resolveActionField(form, key);
        if (!resolved) continue;
        const { root, control } = resolved;
        const targetId = control.id || `admin-action-field-${formId}-${index}`;
        if (!controlsBefore.has(control)) {
          controlsBefore.set(control, {
            id: control.hasAttribute("id") ? control.id : null,
            ariaInvalid: control.getAttribute("aria-invalid"),
            ariaDescribedBy: control.getAttribute("aria-describedby"),
          });
        }
        if (!control.id) control.id = targetId;
        const messageId = `admin-action-error-${formId}-${index}`;
        const describedBy = control.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];
        if (control.getAttribute("aria-invalid") !== "true") control.setAttribute("aria-invalid", "true");
        if (!describedBy.includes(messageId)) {
          control.setAttribute("aria-describedby", [...describedBy, messageId].join(" "));
        }

        let inlineError = inlineErrors.get(root);
        if (!inlineError) {
          inlineError = document.createElement("span");
          inlineError.className = "admin-field-error";
          inlineError.id = messageId;
          inlineErrors.set(root, inlineError);
        }
        if (inlineError.textContent !== message) inlineError.textContent = message;
        if (root.nextElementSibling !== inlineError) root.insertAdjacentElement("afterend", inlineError);
        if (!firstControl) firstControl = control;
      }
    };


    applyErrors();
    firstControl?.focus();
    const observer = new MutationObserver(applyErrors);
    observer.observe(form, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-invalid", "aria-describedby"],
    });
    return () => {
      observer.disconnect();
      for (const inlineError of inlineErrors.values()) inlineError.remove();
      for (const [control, original] of controlsBefore) {
        if (original.id === null) control.removeAttribute("id");
        else control.id = original.id;
        if (original.ariaInvalid === null) control.removeAttribute("aria-invalid");
        else control.setAttribute("aria-invalid", original.ariaInvalid);
        if (original.ariaDescribedBy === null) control.removeAttribute("aria-describedby");
        else control.setAttribute("aria-describedby", original.ariaDescribedBy);
      }
    };
  }, [formId, state.fieldErrors, state.status, state.submission]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitPendingRef.current) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    submitPendingRef.current = true;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData =
      submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
        ? new FormData(form, submitter)
        : new FormData(form);
    startTransition(() => {
      formAction(formData);
    });
  }

  const fieldErrors = state.status === "error" ? Object.entries(state.fieldErrors ?? {}) : [];

  return (
    <AdminActionPendingContext.Provider value={pending}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={submit}
        aria-busy={pending}
      >
        {state.status === "error" ? (
          <div className="form-error admin-action-result" role="alert">
            <p>{state.message}</p>
            {fieldErrors.length ? (
              <ul>
                {fieldErrors.map(([key, message]) => (
                  <li key={key}>
                    <button
                      className="admin-field-error-link"
                      type="button"
                      onClick={() => {
                        const target = formRef.current
                          ? resolveActionField(formRef.current, key)?.control
                          : undefined;
                        target?.focus();
                      }}
                    >
                      {message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {children}
      </form>
    </AdminActionPendingContext.Provider>
  );
}
