"use client";

import { Layout, Menu, Drawer, Button } from "antd";
import {
  DashboardOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  InboxOutlined,
  SettingOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

const { Sider, Content } = Layout;

const menuItems = [
  { key: "/erp/dashboard", icon: <DashboardOutlined />, label: "数据看板" },
  { key: "/erp/orders", icon: <ShoppingOutlined />, label: "订单管理" },
  { key: "/erp/products", icon: <AppstoreOutlined />, label: "商品管理" },
  { key: "/erp/inventory", icon: <InboxOutlined />, label: "库存管理" },
  { key: "/erp/settings", icon: <SettingOutlined />, label: "系统设置" },
];

function SiderContent({
  collapsed,
  onMenuClick,
  pathname,
}: {
  collapsed: boolean;
  onMenuClick: (key: string) => void;
  pathname: string;
}) {
  return (
    <>
      {/* Logo area */}
      <div
        className="flex items-center px-4 border-b border-gray-200"
        style={{ height: 56, flexShrink: 0 }}
      >
        <Link
          href="/"
          className="font-semibold text-gray-900 hover:text-gray-700 transition-colors truncate"
          style={{ fontSize: collapsed ? 12 : 16 }}
        >
          {collapsed ? "UL" : "UNILUME"}
        </Link>
      </div>

      {/* Menu */}
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        inlineCollapsed={collapsed}
        onClick={({ key }) => onMenuClick(key)}
        items={menuItems}
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          marginTop: 8,
        }}
      />
    </>
  );
}

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMenuClick = (key: string) => {
    router.push(key);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={220}
          collapsedWidth={80}
          style={{
            background: "#ffffff",
            borderRight: "1px solid #e5e7eb",
            position: "sticky",
            top: 0,
            height: "100dvh",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <SiderContent
              collapsed={collapsed}
              onMenuClick={handleMenuClick}
              pathname={pathname}
            />
          </div>
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={220}
          styles={{
            body: { padding: 0, display: "flex", flexDirection: "column" },
            header: { display: "none" },
          }}
        >
          <SiderContent
            collapsed={false}
            onMenuClick={handleMenuClick}
            pathname={pathname}
          />
        </Drawer>
      )}

      <Layout>
        {/* Mobile top bar with hamburger */}
        {isMobile && (
          <div
            className="flex items-center px-4 bg-white border-b border-gray-200"
            style={{ height: 56, flexShrink: 0 }}
          >
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ marginRight: 12 }}
            />
            <span className="font-semibold text-gray-900">UNILUME</span>
          </div>
        )}

        <Content
          className="bg-gray-50 p-6"
          style={{ minHeight: isMobile ? "calc(100dvh - 56px)" : "100dvh" }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
