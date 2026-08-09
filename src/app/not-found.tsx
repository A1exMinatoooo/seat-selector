import Link from "next/link";

export default function NotFound() {
  return <main className="participant-shell"><section className="participant-card" role="alert"><p className="eyebrow">页面不存在</p><h1>找不到这个页面</h1><p>链接可能已经失效，或活动已结束。请返回活动入口重新进入。</p><Link className="button primary" href="/">返回首页</Link></section></main>;
}
