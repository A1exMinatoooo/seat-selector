import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { env } from "@/server/env";
import { hasAdminSession } from "@/server/security/admin-session";
import { createQrToken } from "@/server/security/qr-token";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 }); const { id } = await params; const [event] = await getDb().select({ code: events.publicCode, status: events.status }).from(events).where(eq(events.id, id)).limit(1); if (!event || event.status !== "open") return Response.json({ error: "EVENT_NOT_OPEN" }, { status: 409 }); const qr = createQrToken(event.code); const url = `${env().APP_URL}/e/${event.code}/join?t=${encodeURIComponent(qr.token)}`; return Response.json({ image: await QRCode.toDataURL(url, { width: 720, margin: 2, color: { dark: "#15201d", light: "#fffdf7" } }), expiresIn: qr.expiresIn, serverTime: new Date().toISOString() }); }
