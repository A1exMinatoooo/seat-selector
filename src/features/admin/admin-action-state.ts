export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  submission: number;
  code: string | null;
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

export function adminActionError(message: string, code: string): AdminActionState {
  return { status: "error", message, submission: Date.now(), code };
}
