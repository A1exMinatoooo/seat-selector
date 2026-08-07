import { z } from "zod";
import { exportHallTemplates, type HallTemplateExportScope } from "@/server/db/hall-template-transfer";
import { hasAdminSession } from "@/server/security/admin-session";

const querySchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("cinema"), id: z.string().uuid() }),
  z.object({ scope: z.literal("hall"), id: z.string().uuid() }),
]);

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ scope: url.searchParams.get("scope"), id: url.searchParams.get("id") ?? undefined });
  if (!parsed.success) return Response.json({ error: "INVALID_EXPORT_SCOPE" }, { status: 400 });
  const scope: HallTemplateExportScope = parsed.data.scope === "all" ? { type: "all" } : { type: parsed.data.scope, id: parsed.data.id };
  try {
    const bundle = await exportHallTemplates(scope);
    if (!bundle) return Response.json({ error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
    const filename = `座位图模板-${parsed.data.scope}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(bundle, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "hall_template_export_failed", error: error instanceof Error ? error.message : "Unknown error" }));
    return Response.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }
}
