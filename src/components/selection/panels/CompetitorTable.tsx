"use client";

import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CompetitorProduct, Currency } from "@/lib/selection/mock/types";

export interface CompetitorTableProps {
  products: CompetitorProduct[];
  currency: Currency;
  /** Base URL for product links. Defaults to Noon UAE. */
  linkBase?: string;
}

/**
 * Top-10 competitor table with sortable columns + row-click to open the
 * product page on Noon. Uses antd Table for sort/pagination for free.
 */
export default function CompetitorTable({
  products,
  currency,
  linkBase = "https://www.noon.com/uae-en",
}: CompetitorTableProps) {
  const columns: ColumnsType<CompetitorProduct> = [
    {
      title: "#",
      dataIndex: "position",
      width: 40,
      sorter: (a, b) => a.position - b.position,
      defaultSortOrder: "ascend",
      render: (v) => <span className="text-[var(--ink4)]">{v}</span>,
    },
    {
      title: "产品",
      dataIndex: "title",
      ellipsis: true,
      render: (v, row) => (
        <div className="flex items-center gap-1">
          <span className="truncate text-[var(--ink)]">{v}</span>
          {row.tags.map((t) => (
            <Tag key={t} color={t === "fbn" ? "blue" : "orange"} className="!mr-0 !text-[10px]">
              {t === "fbn" ? "FBN" : "Ad"}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: `价格`,
      dataIndex: "price",
      width: 80,
      align: "right",
      sorter: (a, b) => a.price - b.price,
      render: (v) => <span className="tabular-nums">{v}</span>,
    },
    {
      title: "评分",
      dataIndex: "rating",
      width: 60,
      align: "right",
      sorter: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
      render: (v) => (v === null ? "—" : <span className="tabular-nums">{v}</span>),
    },
    {
      title: "评论",
      dataIndex: "reviews",
      width: 70,
      align: "right",
      sorter: (a, b) => a.reviews - b.reviews,
      render: (v) => <span className="tabular-nums">{v}</span>,
    },
  ];

  return (
    <>
      <p className="mb-2 text-[11px] text-[var(--ink4)]">
        货币：{currency} · 点击表头排序 · 点击行跳转 Noon 商品页
      </p>
      <Table<CompetitorProduct>
        rowKey="sku"
        dataSource={products}
        columns={columns}
        pagination={false}
        size="small"
        onRow={(row) => ({
          onClick: () =>
            window.open(`${linkBase}/${row.sku}/p/`, "_blank", "noopener"),
          style: { cursor: "pointer" },
        })}
      />
    </>
  );
}
