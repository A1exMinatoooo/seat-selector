"use client";

import { useActionState } from "react";
import {
  importHallTemplatesAction,
  type HallTemplateImportState,
} from "@/app/(admin)/admin/venues/actions";
import { useAdminActionToast } from "@/features/admin/admin-toast";

const initialState: HallTemplateImportState = {
  status: "idle",
  message: "",
  submission: 0,
  code: null,
};

export function HallTemplateImportForm() {
  const [state, action, pending] = useActionState(importHallTemplatesAction, initialState);
  useAdminActionToast(state);
  return (
    <form action={action} className="stack-form template-import-form">
      <label>
        模板文件
        <input name="template" type="file" accept="application/json,.json" required />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "正在导入…" : "导入模板"}
      </button>
    </form>
  );
}
