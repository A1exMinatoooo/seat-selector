import Link from "next/link";
import { BrandedQrCode } from "@/features/entry/branded-qr-code";
import { env } from "@/server/env";
import { generateQrCodeDataUrl } from "@/server/qr-code";
import { requireAdmin } from "@/server/security/admin-session";

export const dynamic = "force-dynamic";

export default async function TodayRecordsQrPage() {
  await requireAdmin();
  const url = `${env().APP_URL}/records/today`;
  const image = await generateQrCodeDataUrl(url);
  return <main className="qr-screen record-qr-screen">
    <div><Link className="qr-back-button" href="/admin">← 返回控制台</Link><p className="eyebrow">参与者自助查询</p><h1>今日选座记录</h1><p>请使用完成选座的同一微信扫描，页面仅显示该设备在北京时间当天的记录。</p></div>
    <div className="qr-frame"><BrandedQrCode src={image} alt="今日选座记录二维码" priority /><strong>二维码固定有效</strong><span>不会通过网址参数暴露活动、日期或参与者信息</span></div>
  </main>;
}
