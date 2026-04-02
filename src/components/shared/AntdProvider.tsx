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
            colorPrimary: "#2563eb",
            borderRadius: 8,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
