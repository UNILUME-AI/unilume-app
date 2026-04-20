"use client";

import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { SceneId } from "@/lib/selection/mock/scenes";
import { getMockTimingResponse } from "@/lib/selection/mock/timing-data";
import type { TimingEvent, Relevance } from "@/lib/selection/mock/types";

import { DPKV, DPSection } from "./_internals";

export interface TimingDetailProps {
  scene: SceneId;
}

/**
 * Detail view for `timing_intelligence` — current phase + full-year
 * event calendar + forward-looking demand outlook.
 */
export default function TimingDetail({ scene }: TimingDetailProps) {
  const response = getMockTimingResponse(scene);
  const data = response.data;

  if (!data) {
    return (
      <p className="text-[13px] text-[var(--ink3)]">
        此场景没有时机数据。
      </p>
    );
  }

  const columns: ColumnsType<TimingEvent> = [
    {
      title: "事件",
      dataIndex: "name",
      render: (v) => <span className="font-medium text-[var(--ink)]">{v}</span>,
    },
    { title: "时间", dataIndex: "date", width: 100 },
    { title: "热门品类", dataIndex: "categories", ellipsis: true },
    {
      title: "相关度",
      dataIndex: "relevance",
      width: 90,
      render: (v: Relevance) => {
        const { label, color } = RELEVANCE_TOKENS[v];
        return (
          <Tag color={color} className="!mr-0 !text-[10px]">
            {label}
          </Tag>
        );
      },
    },
  ];

  return (
    <>
      <DPSection title="当前时段">
        <DPKV label="时段名称" value={data.currentPhase.name} tone="strong" />
        <DPKV label="需求水平" value={data.currentPhase.demandLevel} />
        <DPKV label="建议行动" value={data.currentPhase.recommendedAction} />
        {data.peakWindow && (
          <DPKV
            label="核心销售期"
            value={data.peakWindow.label}
            note={data.peakWindow.date}
          />
        )}
        {data.stockCutoff && (
          <DPKV
            label="备货截止建议"
            value={data.stockCutoff.label}
            note={data.stockCutoff.date}
          />
        )}
      </DPSection>

      <DPSection title="全年事件日历">
        <Table<TimingEvent>
          rowKey="name"
          dataSource={data.events}
          columns={columns}
          pagination={false}
          size="small"
        />
      </DPSection>

      <DPSection title="需求展望">
        <DPKV
          label="未来 30 天"
          value={data.outlook.days30.label}
          note={data.outlook.days30.detail}
        />
        <DPKV
          label="未来 90 天"
          value={data.outlook.days90.label}
          note={data.outlook.days90.detail}
        />
        <DPKV
          label="未来 180 天"
          value={data.outlook.days180.label}
          note={data.outlook.days180.detail}
        />
        <DPKV
          label={<span className="text-amber-700">风险窗口</span>}
          value={data.outlook.riskWindow.label}
          note={data.outlook.riskWindow.detail}
        />
      </DPSection>
    </>
  );
}

const RELEVANCE_TOKENS: Record<Relevance, { label: string; color: string }> = {
  high: { label: "高度相关", color: "red" },
  mid: { label: "中度相关", color: "orange" },
  low: { label: "低相关", color: "blue" },
  none: { label: "季节错配", color: "default" },
};
