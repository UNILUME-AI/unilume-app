/**
 * Selection Agent demo scenes — the 6 canonical flows we want the UI
 * to handle on `/mock/selection?scene=<id>`.
 *
 *   happy       Full-info query → completeness flow → positive verdict
 *   ask_market  Missing market → MarketPicker → InfoGather → analysis
 *   gather      Missing market + cost → InfoGather → analysis
 *   ksa         Like happy but in the KSA market (VAT 15%, SAR)
 *   degraded    Crawl failed → partial data → risky verdict + FallbackCard
 *   negative    Very competitive category → negative verdict + "观望"
 */

import type { Market } from "./types";

export const SCENES = [
  "happy",
  "ask_market",
  "gather",
  "ksa",
  "degraded",
  "negative",
] as const;

export type SceneId = (typeof SCENES)[number];

/** Verdict "tone" used to color the VerdictHeader band. */
export type VerdictTone = "positive" | "risky" | "negative";

export interface SceneMeta {
  id: SceneId;
  title: string;           // short label for the SceneSwitcher chip
  userQuery: string;       // the initial message typed by the user
  market?: Market;         // null if the scene *starts* without a market
  description: string;     // one-sentence description of what this scene demos
}

export const SCENE_META: Record<SceneId, SceneMeta> = {
  happy: {
    id: "happy",
    title: "完整选品",
    userQuery: "我想在 Noon UAE 卖便携风扇，从 1688 拿货大概 35 块，用 FBN 发货",
    market: "UAE",
    description: "最常见路径 — 信息完整直接分析，选子类后给正向判断",
  },
  ask_market: {
    id: "ask_market",
    title: "问市场",
    userQuery: "便携风扇能做吗？从 1688 拿货 35 块，FBN 发",
    description: "缺市场信息 — Agent 先让你选 UAE / KSA，再走完整分析",
  },
  gather: {
    id: "gather",
    title: "收信息",
    userQuery: "便携风扇在 Noon 上好不好卖？",
    description: "缺所有信息 — 一次性收集市场、成本、发货方式再分析",
  },
  ksa: {
    id: "ksa",
    title: "KSA 市场",
    userQuery: "便携榨汁杯能做吗？KSA 市场，采购 48 块，FBN",
    market: "KSA",
    description: "与 happy 同但用 KSA — VAT 15%、SAR 货币、人口更大",
  },
  degraded: {
    id: "degraded",
    title: "数据降级",
    userQuery: "宠物自动喂食器能做吗？UAE 市场，采购 85 块，FBN",
    market: "UAE",
    description: "实时数据获取超时 — 降级到利润 + 时机分析，建议谨慎",
  },
  negative: {
    id: "negative",
    title: "不建议",
    userQuery: "iPhone 17 数据线能做吗？UAE 市场，采购 6 块",
    market: "UAE",
    description: "超高竞争 — HHI 集中、利润薄，建议观望或换品类",
  },
};

/** True if `value` is a valid scene id. Safe to call on untrusted input. */
export function isSceneId(value: unknown): value is SceneId {
  return typeof value === "string" && (SCENES as readonly string[]).includes(value);
}
