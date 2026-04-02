import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import AntdProvider from "@/components/shared/AntdProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "UNILUME — Noon 卖家运营助手",
  description:
    "Noon 卖家运营助手：政策查询、费用计算、物流选择、listing 优化。基于 223+ 篇官方帮助文档。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="zh-CN" className={`h-full antialiased ${inter.variable} ${notoSansArabic.variable}`}>
        <body className="min-h-full flex flex-col">
          <AntdProvider>{children}</AntdProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
