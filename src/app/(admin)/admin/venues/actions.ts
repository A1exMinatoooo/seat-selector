"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/features/admin/admin-action-state";
import { getDb } from "@/server/db/client";
import { cinemas, halls, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { hallLayoutSchema } from "@/features/venues/schemas";
import { importHallTemplates } from "@/server/db/hall-template-transfer";
import {
  archiveHallTemplate,
  HallTemplateInUseError,
  replaceHallTemplate,
} from "@/server/db/hall-template-edit";
import { parseHallTemplateBundle } from "@/server/domain/hall-template-transfer";
import { postgresErrorInfo } from "@/shared/postgres-error";

export type HallTemplateImportState = AdminActionState;
export type HallTemplateUpdateState = AdminActionState;
export type HallTemplateArchiveState = AdminActionState;

function hallFieldErrors(
  error: z.ZodError,
  rawLayout: FormDataEntryValue | null,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  let submittedCells: Array<{ rowIndex?: number; columnIndex?: number }> = [];
  if (typeof rawLayout === "string") {
    try {
      const parsed: unknown = JSON.parse(rawLayout);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "cells" in parsed &&
        Array.isArray(parsed.cells)
      ) {
        submittedCells = parsed.cells as Array<{ rowIndex?: number; columnIndex?: number }>;
      }
    } catch {
      // Malformed layout data is associated with the visible row-count control below.
    }
  }
  for (const issue of error.issues) {
    const [root, field, index, cellField] = issue.path;
    let key: string | undefined;
    if (root === "name" || root === "cinemaId") key = root;
    else if (root === "layout") {
      if (field === "rows" || field === "columns" || field === "centerAfterColumn") {
        key = field;
      } else if (field === "cells" && typeof index === "number") {
        const cell = submittedCells[index];
        if (cellField === "rowLabel" && typeof cell?.rowIndex === "number")
          key = `layout.rowLabel.${cell.rowIndex}`;
        else if (
          cellField === "columnLabel" &&
          typeof cell?.rowIndex === "number" &&
          typeof cell.columnIndex === "number"
        )
          key = `layout.columnLabel.${cell.rowIndex}.${cell.columnIndex}`;
        else key = cellField === "columnIndex" ? "columns" : "rows";
      } else key = "rows";
    }
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createCinemaAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsedName = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  if (!parsedName.success)
    return adminActionError(
      "影院名称无效，请检查后重试。",
      "INVALID_CINEMA",
      { name: parsedName.error.issues[0]?.message ?? "请输入有效的影院名称。" },
    );
  try {
    await getDb().insert(cinemas).values({ name: parsedName.data });
  } catch (error) {
    if (postgresErrorInfo(error).code === "23505")
      return adminActionError("影院名称已存在，请使用其他名称。", "CINEMA_NAME_CONFLICT", {
        name: "影院名称已存在，请使用其他名称。",
      });
    console.error(
      JSON.stringify({
        level: "error",
        message: "cinema_create_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("影院保存失败，请稍后重试。", "CINEMA_CREATE_FAILED");
  }
  revalidatePath("/admin/venues");
  return adminActionSuccess("影院已保存。", "CINEMA_CREATED");
}

export async function createHallAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      cinemaId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      layout: z
        .string()
        .transform((value, context) => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            context.addIssue({ code: "custom", message: "布局数据无效" });
            return z.NEVER;
          }
        })
        .pipe(hallLayoutSchema),
    })
    .safeParse({
      cinemaId: formData.get("cinemaId"),
      name: formData.get("name"),
      layout: formData.get("layout"),
    });
  if (!parsed.success)
    return adminActionError(
      "影厅模板无效，请检查后重试。",
      "INVALID_HALL_TEMPLATE",
      hallFieldErrors(parsed.error, formData.get("layout")),
    );
  const input = parsed.data;

  try {
    await getDb().transaction(async (tx) => {
      const [hall] = await tx
        .insert(halls)
        .values({
          cinemaId: input.cinemaId,
          name: input.name,
          centerAfterColumn: input.layout.centerAfterColumn,
        })
        .returning({ id: halls.id });
      if (!hall) throw new Error("Hall creation did not return an id");
      await tx
        .insert(seats)
        .values(input.layout.cells.map((cell) => ({ hallId: hall.id, ...cell })));
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "hall_template_create_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError(
      error instanceof Error && error.message.includes("Hall creation")
        ? "影厅创建失败，请检查座位模板后重试。"
        : "影厅保存失败，请稍后重试。",
      "HALL_TEMPLATE_CREATE_FAILED",
    );
  }
  revalidatePath("/admin/venues");
  return adminActionSuccess("影厅模板已保存。", "HALL_TEMPLATE_CREATED");
}

export async function updateHallAction(
  _previousState: HallTemplateUpdateState,
  formData: FormData,
): Promise<HallTemplateUpdateState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      layout: z
        .string()
        .transform((value, context) => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            context.addIssue({ code: "custom", message: "布局数据无效" });
            return z.NEVER;
          }
        })
        .pipe(hallLayoutSchema),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      layout: formData.get("layout"),
    });
  if (!parsed.success)
    return adminActionError(
      "模板内容无效，请检查后重试。",
      "INVALID_TEMPLATE",
      hallFieldErrors(parsed.error, formData.get("layout")),
    );
  try {
    await replaceHallTemplate(parsed.data);
  } catch (error) {
    if (error instanceof HallTemplateInUseError)
      return adminActionError(
        "该模板仍有关联的草稿或进行中活动，不能编辑。",
        "HALL_TEMPLATE_IN_USE",
      );
    console.error(
      JSON.stringify({
        level: "error",
        message: "hall_template_update_failed",
        hallId: parsed.data.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("模板保存失败，请稍后重试。", "HALL_TEMPLATE_UPDATE_FAILED");
  }
  revalidatePath("/admin/venues");
  redirect("/admin/venues?notice=hall-template-updated");
}

export async function archiveHallAction(
  _previousState: HallTemplateArchiveState,
  formData: FormData,
): Promise<HallTemplateArchiveState> {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success)
    return adminActionError("模板标识无效，请刷新后重试。", "INVALID_HALL_TEMPLATE");
  try {
    if (!(await archiveHallTemplate(parsed.data.id)))
      return adminActionError("模板不存在或已归档。", "HALL_TEMPLATE_NOT_FOUND");
  } catch (error) {
    if (error instanceof HallTemplateInUseError)
      return adminActionError("该模板已有活动关联，不能归档。", "HALL_TEMPLATE_IN_USE");
    console.error(
      JSON.stringify({
        level: "error",
        message: "hall_template_archive_failed",
        hallId: parsed.data.id,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("模板归档失败，请稍后重试。", "HALL_TEMPLATE_DELETE_FAILED");
  }
  revalidatePath("/admin/venues");
  redirect("/admin/venues?notice=hall-template-deleted");
}

export async function importHallTemplatesAction(
  _previousState: HallTemplateImportState,
  formData: FormData,
): Promise<HallTemplateImportState> {
  await requireAdmin();
  const parsedFile = z
    .instanceof(File)
    .refine((file) => file.size > 0 && file.size <= 10 * 1024 * 1024)
    .safeParse(formData.get("template"));
  if (!parsedFile.success)
    return adminActionError("请选择有效且不超过 10 MiB 的 JSON 模板文件。", "INVALID_TEMPLATE_FILE", {
      template: "文件不能为空，且大小不能超过 10 MiB。",
    });
  try {
    const bundle = parseHallTemplateBundle(JSON.parse(await parsedFile.data.text()) as unknown);
    const imported = await importHallTemplates(bundle);
    revalidatePath("/admin/venues");
    return adminActionSuccess(
      `导入成功：新增 ${imported.cinemas} 个影院、${imported.halls} 个影厅模板。`,
      "HALL_TEMPLATES_IMPORTED",
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "hall_template_import_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      return adminActionError(
        "模板文件格式无效，请选择由本系统导出的 JSON 文件。",
        "INVALID_TEMPLATE_FILE",
        { template: "文件内容不是有效的影厅模板 JSON。" },
      );
    return adminActionError(
      "模板文件无效或导入失败，请检查文件后重试。",
      "HALL_TEMPLATE_IMPORT_FAILED",
    );
  }
}
