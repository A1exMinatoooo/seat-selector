"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { cinemas, halls, seats } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { hallLayoutSchema } from "@/features/venues/schemas";

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
