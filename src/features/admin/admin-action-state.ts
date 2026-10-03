export type AdminFieldErrors = Record<string, string>;

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  submission: number;
  code: string | null;
  fieldErrors?: AdminFieldErrors;
};

export type AdminFormAction = (
  previousState: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

export function adminActionSuccess(message: string, code: string): AdminActionState {
  return { status: "success", message, submission: Date.now(), code };
}

export function adminActionError(
  message: string,
  code: string,
  fieldErrors?: AdminFieldErrors,
): AdminActionState {
  return { status: "error", message, submission: Date.now(), code, ...(fieldErrors ? { fieldErrors } : {}) };
}
