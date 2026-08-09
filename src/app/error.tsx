"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="participant-shell"><section className="participant-card" role="alert"><p className="eyebrow">页面暂时不可用</p><h1>出了点问题</h1><p>页面加载失败，请重试；如果问题持续存在，请联系现场工作人员。</p><button className="button primary" type="button" onClick={() => reset()}>重新加载</button></section></main>;
}
