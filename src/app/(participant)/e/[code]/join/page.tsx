import { RedeemClient } from "@/features/entry/redeem-client";
export default async function JoinPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) { const [{ code }, { t }] = await Promise.all([params, searchParams]); return <RedeemClient code={code} token={t ?? ""} />; }
