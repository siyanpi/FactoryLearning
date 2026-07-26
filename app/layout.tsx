import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "功能性食品工厂生产场景学习",
  description:
    "用六次十五分钟场景任务，掌握发酵、酶解、膜分离、干燥和工厂评审的基本判断方法。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
