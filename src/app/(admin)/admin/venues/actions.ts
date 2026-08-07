"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { cinemas, halls, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { hallLayoutSchema } from "@/features/venues/schemas";
import { importHallTemplates } from "@/server/db/hall-template-transfer";
import { HallTemplateInUseError, replaceHallTemplate } from "@/server/db/hall-template-edit";
import { parseHallTemplateBundle } from "@/server/domain/hall-template-transfer";

export type HallTemplateImportState = { status: "idle" | "success" | "error"; message: string; submission: number; code?: "INVALID_TEMPLATE_FILE" | "IMPORT_FAILED" };
export type HallTemplateUpdateState = { status: "idle" | "error"; message: string; submission: number; code?: "INVALID_TEMPLATE" | "HALL_TEMPLATE_IN_USE" | "UPDATE_FAILED" };

export async function createCinemaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  await getDb().insert(cinemas).values({ name });
  revalidatePath("/admin/venues");
}

export async function createHallAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = z.object({
    cinemaId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    layout: z.string().transform((value, context) => {
      try { return JSON.parse(value) as unknown; } catch { context.addIssue({ code: "custom", message: "布局数据无效" }); return z.NEVER; }
    }).pipe(hallLayoutSchema),
  }).parse({ cinemaId: formData.get("cinemaId"), name: formData.get("name"), layout: formData.get("layout") });

  await getDb().transaction(async (tx) => {
    const [hall] = await tx.insert(halls).values({
      cinemaId: input.cinemaId,
      name: input.name,
      centerAfterColumn: input.layout.centerAfterColumn,
    }).returning({ id: halls.id });
    if (!hall) throw new Error("Hall creation did not return an id");
    await tx.insert(seats).values(input.layout.cells.map((cell) => ({ hallId: hall.id, ...cell })));
  });
  revalidatePath("/admin/venues");
}

export async function updateHallAction(_previousState: HallTemplateUpdateState, formData: FormData): Promise<HallTemplateUpdateState> {
  await requireAdmin();
  const parsed = z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    layout: z.string().transform((value, context) => {
      try { return JSON.parse(value) as unknown; } catch { context.addIssue({ code: "custom", message: "布局数据无效" }); return z.NEVER; }
    }).pipe(hallLayoutSchema),
  }).safeParse({ id: formData.get("id"), name: formData.get("name"), layout: formData.get("layout") });
  if (!parsed.success) return { status: "error", message: "模板内容无效，请检查后重试。", submission: Date.now(), code: "INVALID_TEMPLATE" };
  try {
    await replaceHallTemplate(parsed.data);
  } catch (error) {
    if (error instanceof HallTemplateInUseError) return { status: "error", message: "该模板仍有关联的草稿或进行中活动，不能编辑。", submission: Date.now(), code: "HALL_TEMPLATE_IN_USE" };
    console.error(JSON.stringify({ level: "error", message: "hall_template_update_failed", hallId: parsed.data.id, error: error instanceof Error ? error.message : "Unknown error" }));
    return { status: "error", message: "模板保存失败，请稍后重试。", submission: Date.now(), code: "UPDATE_FAILED" };
  }
  revalidatePath("/admin/venues");
  redirect("/admin/venues");
}

export async function importHallTemplatesAction(_previousState: HallTemplateImportState, formData: FormData): Promise<HallTemplateImportState> {
  await requireAdmin();
  const parsedFile = z.instanceof(File).refine((file) => file.size > 0 && file.size <= 10 * 1024 * 1024).safeParse(formData.get("template"));
  if (!parsedFile.success) return { status: "error", message: "请选择不超过 10MB 的 JSON 模板文件。", submission: Date.now(), code: "INVALID_TEMPLATE_FILE" };
  try {
    const bundle = parseHallTemplateBundle(JSON.parse(await parsedFile.data.text()) as unknown);
    const imported = await importHallTemplates(bundle);
    revalidatePath("/admin/venues");
    return { status: "success", message: `导入成功：新增 ${imported.cinemas} 个影院、${imported.halls} 个影厅模板。`, submission: Date.now() };
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "hall_template_import_failed", error: error instanceof Error ? error.message : "Unknown error" }));
    if (error instanceof SyntaxError || error instanceof z.ZodError) return { status: "error", message: "模板文件格式无效，请选择由本系统导出的 JSON 文件。", submission: Date.now(), code: "INVALID_TEMPLATE_FILE" };
    return { status: "error", message: "模板文件无效或导入失败，请检查文件后重试。", submission: Date.now(), code: "IMPORT_FAILED" };
  }
}
