import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFilingFooter } from "@/features/footer/site-filing-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "银幕座席｜线下观影选座",
  description: "安全、轻量的线下观影活动选座系统",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="site-document">{children}</div>
        <SiteFilingFooter />
      </body>
    </html>
  );
}
