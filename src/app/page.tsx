import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <p className="eyebrow">PICK YOUR SEAT</p>
        <h1>让每一次集体观影，<br />从容入座。</h1>
        <p className="lede">影厅布局、现场定位、动态二维码与并发选座，都在一个轻量系统里。</p>
        <div className="hero-actions">
          <Link className="button primary" href="/admin">进入活动管理</Link>
          <span className="fine-print">参与者请扫描活动现场二维码</span>
        </div>
        <div className="feature-grid" aria-label="产品能力">
          <article><strong>30 秒</strong><span>动态二维码轮换</span></article>
          <article><strong>100 人</strong><span>峰值并发支持</span></article>
          <article><strong>实时</strong><span>座位状态同步</span></article>
        </div>
      </section>
    </main>
  );
}
