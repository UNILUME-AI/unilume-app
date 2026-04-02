"use client";

import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AntdRegistry } from "@ant-design/nextjs-registry";

const FONT_FAMILY = [
  "var(--font-inter)",
  "var(--font-noto-arabic)",
  '"PingFang SC"',
  '"Microsoft YaHei"',
  '"Noto Sans SC"',
  "sans-serif",
].join(", ");

export default function AntdProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: "#e2740e", // --color-brand-500
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
            colorInfo: "#e2740e", // --color-brand-500
            borderRadius: 8,
            fontFamily: FONT_FAMILY,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
