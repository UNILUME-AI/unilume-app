"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/new", label: "AI 助手" },
  { href: "/market", label: "市场数据" },
  { href: "/policy-updates", label: "变更日报" },
  { href: "/erp", label: "ERP" },
];

interface AppHeaderProps {
  maxWidth?: string;
  actions?: React.ReactNode;
}

export default function AppHeader({
  maxWidth = "max-w-5xl",
  actions,
}: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="flex-none border-b border-[var(--border)] bg-white px-4 py-3">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between`}>
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[var(--ink)] hover:text-[var(--ink2)] transition-colors"
        >
          UNILUME
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm transition-colors ${
                    item.label === "ERP" ? "hidden sm:inline" : ""
                  } ${
                    isActive
                      ? "text-[var(--ink)] font-medium"
                      : "text-[var(--ink3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {actions && (
            <div className="flex items-center gap-3">{actions}</div>
          )}
        </div>
      </div>
    </header>
  );
}
