"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="zh-CN"><body><main className="participant-shell"><section className="participant-card" role="alert"><p className="eyebrow">系统暂时不可用</p><h1>请稍后重试</h1><p>系统遇到暂时性问题，请刷新页面或联系工作人员。</p><button className="button primary" type="button" onClick={() => reset()}>重新加载</button></section></main></body></html>;
}
