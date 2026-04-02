import type { BadgeCategory } from "@/components/ui/CategoryBadge";

export interface QuickAction {
  icon: string;
  text: string;
  category: BadgeCategory;
  categoryLabel: string;
  description?: string;
  span?: number;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { icon: "📊", text: "Air fryer 在 Noon 上好卖吗？", category: "market", categoryLabel: "市场洞察", description: "了解 UAE 和 KSA 的需求量、竞争格局和定价区间", span: 7 },
  { icon: "📦", text: "FBN 和 DirectShip 怎么选？", category: "logistics", categoryLabel: "物流对比", description: "费用、时效、入仓要求全对比", span: 5 },
  { icon: "📈", text: "Wireless earbuds 竞争大吗？", category: "market", categoryLabel: "竞品分析", span: 4 },
  { icon: "📋", text: "Noon 退货政策是什么？", category: "policy", categoryLabel: "退货政策", span: 4 },
  { icon: "⚠️", text: "卖家违规会有什么处罚？", category: "policy", categoryLabel: "合规提醒", span: 4 },
  { icon: "💰", text: "FBN 物流费怎么算？", category: "logistics", categoryLabel: "物流费用", description: "包含仓储费、配送费、退货处理费明细", span: 5 },
  { icon: "🌍", text: "Air fryer UAE 和 KSA 哪个更好做？", category: "market", categoryLabel: "区域对比", description: "两地消费习惯、物流成本、竞争差异全解析", span: 7 },
  { icon: "🏪", text: "如何在 Noon 开店？", category: "guide", categoryLabel: "新手入门", span: 4 },
  { icon: "🏷️", text: "Bluetooth earphones 有哪些品牌在做？", category: "market", categoryLabel: "品牌调研", span: 8 },
];

export const SUGGESTION_PILLS = [
  "FBN 佣金费率",
  "退货政策",
  "新品上架流程",
  "KSA 市场趋势",
];
