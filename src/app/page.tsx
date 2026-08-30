import { ArrowRight, CloudSync, ScanLine, UsersRound } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

const features = [
  { value: "30 秒", label: "动态二维码轮换", icon: ScanLine },
  { value: "100 人", label: "峰值并发支持", icon: UsersRound },
  { value: "实时", label: "座位状态同步", icon: CloudSync },
];

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.introduction} data-testid="home-introduction">
          <p className={styles.eyebrow}>Pick your seat · 银幕座席</p>
          <h1 className={styles.heading}>
            让每一次集体观影，
            <br />
            从容入座。
          </h1>
          <p className={styles.lede}>
            影厅布局、现场定位、动态二维码与并发选座，都在一个轻量系统里。
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/admin">
              进入活动管理
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
            <span className={styles.finePrint}>参与者请扫描活动现场二维码</span>
          </div>
        </div>

        <div className={styles.showcase} data-testid="home-showcase">
          <div className={styles.showcaseHeading}>
            <p className={styles.nowShowing}>NOW SHOWING</p>
            <h2>一张票，一次可靠的现场体验</h2>
          </div>
          <div className={styles.features} aria-label="产品能力">
            {features.map(({ value, label, icon: Icon }) => (
              <article className={styles.feature} key={label}>
                <span className={styles.featureIcon}>
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </span>
              </article>
            ))}
          </div>
          <Link className={styles.secondaryAction} href="/admin">
            为下一场放映做好准备
          </Link>
        </div>
      </section>
    </main>
  );
}
