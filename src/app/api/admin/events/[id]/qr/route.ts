import QRCode from "qrcode";
import { getOrCreateQrToken } from "@/server/domain/qr-entry";
import { env } from "@/server/env";
import { hasAdminSession } from "@/server/security/admin-session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { id } = await params;
    const qr = await getOrCreateQrToken(id);
    const url = `${env().APP_URL}/e/${qr.publicCode}/join?t=${encodeURIComponent(qr.token)}`;
    return Response.json({ image: await QRCode.toDataURL(url, { width: 720, margin: 2, color: { dark: "#15201d", light: "#fffdf7" } }), expiresIn: qr.expiresIn, serverTime: qr.serverTime });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "二维码生成失败" }, { status: 409 });
  }
}
