"use client";

import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AntdRegistry } from "@ant-design/nextjs-registry";

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
            colorPrimary: "#533afd",
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
            colorInfo: "#533afd",
            borderRadius: 8,
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
