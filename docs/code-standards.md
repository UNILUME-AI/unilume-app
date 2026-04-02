# UNILUME App 代码规范 & UI 设计规范

> 适用范围：`unilume-app` 前端项目（Next.js 16 + React 19 + Tailwind v4 + antd 6）
> 版本：v1.0 — 2026-04-02

---

## 一、代码规范

### 1. 文件命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件文件 | **kebab-case** | `price-trend-chart.tsx`, `search-bar.tsx` |
| 工具/库文件 | **kebab-case** | `market-data.ts`, `knowledge-base.ts` |
| 测试文件 | 与源文件同名 + `.test` | `route.test.ts`, `market-data.test.ts` |
| 目录名 | **kebab-case** | `policy-updates/`, `market/` |
| Next.js 约定文件 | 按框架规定 | `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx` |

### 2. 组件规范

#### Server Component（默认）
不加 `"use client"`，可使用 async/await 直接获取数据：

```tsx
// app/market/page.tsx
export default async function MarketPage() {
  const data = await getMarketOverview("keyword", "UAE");
  return <div>{/* 渲染 */}</div>;
}
```

#### Client Component
仅当需要交互（hooks、事件处理、浏览器 API）时使用，文件首行加 `"use client"`：

```tsx
// app/market/search-bar.tsx
"use client";

import { useState } from "react";

export default function SearchBar() {
  const [value, setValue] = useState("");
  // ...
}
```

#### Props 类型定义

```tsx
// 在组件文件内定义 interface，命名为 ComponentNameProps
interface ProductTableProps {
  keyword: string;
  market: string;
  initialProducts: ProductListItem[];
}

export default function ProductTable({
  keyword,
  market,
  initialProducts,
}: ProductTableProps) {
  // ...
}
```

#### 导出规则
- **组件**：统一 `export default function`
- **工具函数/类型**：用 named export（`export function`, `export interface`）
- 一个文件只有一个 default export

### 3. 目录结构职责

```
src/
├── app/          # 路由页面、布局、API Routes（Next.js App Router）
│   ├── api/      #   API Routes（route.ts）
│   └── market/   #   页面级组件（page.tsx + 该页面专属的子组件）
├── components/   # 跨页面复用的 UI 组件
│   ├── charts/   #   图表组件
│   └── shared/   #   通用组件（AntdProvider 等）
├── lib/          # 业务逻辑、数据库查询、工具函数
├── config/       # 常量、配置
└── data/         # 静态数据文件
```

**放置原则：**
- 只在一个页面用的子组件 → 放在该页面目录下（如 `market/search-bar.tsx`）
- 跨页面复用的组件 → 放在 `components/` 下
- 数据查询、业务逻辑 → 放在 `lib/` 下
- 测试文件 → 与源文件同目录的 `__tests__/` 下

### 4. TypeScript 规范

| 场景 | 用 `interface` 还是 `type` |
|------|---------------------------|
| 对象/Props 形状 | `interface` |
| 联合类型、别名 | `type` |
| API 响应结构 | `interface`，在 `lib/` 中定义并 export |
| 组件 Props | `interface`，在组件文件内定义 |

```ts
// interface 用于对象
export interface MarketOverview {
  keyword: string;
  market: string;
  total_results: number;
}

// type 用于联合/别名
type SortColumn = "position" | "price_current" | "rating";
type Direction = "rising" | "falling" | "stable";
```

### 5. Import 顺序

```tsx
// 1. React / Next.js
import { useState, useMemo } from "react";
import Link from "next/link";

// 2. 第三方库
import { Table, Tag, Button } from "antd";
import { Bubble, Sender } from "@ant-design/x";
import { useChat } from "@ai-sdk/react";

// 3. 内部模块（@/ 开头）
import { getMarketOverview } from "@/lib/market-data";
import AntdProvider from "@/components/shared/AntdProvider";

// 4. 同目录相对引用
import SearchBar from "./search-bar";
```

组与组之间空一行。

### 6. API Route 规范

```ts
// app/api/market/overview/route.ts
import { auth } from "@clerk/nextjs/server";
import { getMarketOverview } from "@/lib/market-data";

export async function GET(req: Request) {
  // 1. 鉴权
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 参数校验（early return）
  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword");
  if (!keyword) {
    return Response.json(
      { error: "Missing required parameter: keyword" },
      { status: 400 }
    );
  }

  // 3. 参数安全化（clamp / allowlist）
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "20")), 100);

  // 4. 业务逻辑 + 错误处理
  try {
    const data = await getMarketOverview(keyword);
    return Response.json(data);
  } catch (error) {
    console.error("Overview API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**要点：**
- 所有受保护接口用 Clerk `auth()` 鉴权
- 参数校验用 early return，不要嵌套 if
- 数值参数做 clamp，字符串参数做 allowlist
- 用 `Response.json()` 返回，错误带 status code
- SQL 必须用模板字符串参数化，禁止拼接

### 7. 数据查询规范

```ts
// lib/market-data.ts
// 查询函数返回 T | null，不抛异常
export async function getMarketOverview(
  keyword: string,
  market: string = "UAE"
): Promise<MarketOverview | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM market_snapshots
    WHERE keyword = ${keyword} AND market = ${market}
    ORDER BY timestamp DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  // ...
}
```

- 查询函数定义在 `lib/` 中，页面/API Route 调用
- 返回类型为 `T | null`，调用方处理 null
- SQL 用 Neon 的 tagged template（自动参数化）

### 8. 错误处理

| 场景 | 策略 |
|------|------|
| API Route | try-catch → `console.error` → `Response.json({ error }, { status })` |
| 数据查询函数 | 返回 `null`，不抛异常 |
| Server Component | 查询返回 null 时渲染空状态 UI |
| Client Component | fetch 失败时 catch 静默处理或显示友好提示 |

### 9. 测试规范

- 框架：Vitest
- mock 在 import 之前注册（`vi.mock` 先于 `import`）
- 测试文件放在 `__tests__/` 目录下
- 测试名描述行为，不描述实现

```ts
describe("POST /api/feedback", () => {
  it("returns 400 for invalid rating", async () => { ... });
  it("accepts valid 'up' feedback", async () => { ... });
});
```

### 10. 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ProductTable`, `SearchBar` |
| 函数 | camelCase | `getMarketOverview`, `loadReportFromDb` |
| 常量 | SCREAMING_SNAKE_CASE | `VALID_SORT_COLUMNS`, `QUICK_ACTIONS` |
| 接口 | PascalCase | `MarketOverview`, `ProductListItem` |
| CSS 类映射 | camelCase 对象 | `const statusMap = { pending: { ... } }` |

---

## 二、UI 设计规范

### 1. 双系统共存策略

项目同时使用 **Tailwind v4** 和 **antd 6**，各有明确分工：

| 场景 | 使用 | 原因 |
|------|------|------|
| 数据表格 | antd `Table` | 内置排序/筛选/分页 |
| 表单 | antd `Form` + `Input` / `Select` | 校验、布局 |
| 标签/徽章 | antd `Tag` | 语义化状态展示 |
| 按钮 | antd `Button` | 统一交互风格 |
| AI 对话 | `@ant-design/x` Bubble/Sender | 流式渲染 |
| 页面布局 | Tailwind（`flex`, `grid`, `gap`, `p-*`） | 灵活，轻量 |
| 卡片容器 | Tailwind（`rounded-lg border bg-white p-4`） | 与现有风格一致 |
| 响应式 | Tailwind（`sm:`, `lg:`） | 断点控制 |
| 间距微调 | Tailwind（`mt-2`, `gap-3`） | 精细控制 |
| 图表 | @ant-design/charts + Tailwind 容器 | 主题自动对齐 antd token |

**原则：antd 管组件交互，Tailwind 管布局和细节样式。不要在 antd 组件上堆叠过多 Tailwind 类覆盖其默认样式。**

### 2. 色彩系统

#### 设计原则

- **4 个 seed color** 定义在 antd ConfigProvider 中，antd 自动派生 10 级色阶 + 交互态
- Tailwind 用 CSS Variables 引用同一组语义色，两套系统自动对齐
- 参考体系：antd 6 色彩规范 + Stripe Dashboard 的克制用色

#### 品牌色 `#533afd`

antd 自动生成的 10 级色阶：

| 级别 | 色值 | 用途 |
|------|------|------|
| 1 | `#f4f0ff` | 浅底色（选中行、hover 背景） |
| 2 | `#e7deff` | 次浅底色（标签底色） |
| 3 | `#c6b5ff` | 禁用态 |
| 4 | `#a38cff` | 边框 hover |
| 5 | `#7d63ff` | 次强调（链接 hover） |
| **6** | **`#533afd`** | **品牌主色（按钮、链接、活跃态）** |
| 7 | `#3827d6` | 按钮 hover |
| 8 | `#2117b0` | 按钮 active |
| 9 | `#0f0b8a` | 深色文字（极少用） |
| 10 | `#070763` | 最深色（极少用） |

#### 4 个 Seed Token

| 角色 | antd Token | 色值 | Tailwind 对应 | 用途 |
|------|-----------|------|---------------|------|
| 品牌 | `colorPrimary` | `#533afd` | `--color-brand` | 按钮、链接、选中态、进度条 |
| 成功 | `colorSuccess` | `#10b981` | `emerald-500` | 低门槛、正向指标、完成状态 |
| 警告 | `colorWarning` | `#f59e0b` | `amber-500` | 中等门槛、注意事项、偏低库存 |
| 错误 | `colorError` | `#ef4444` | `red-500` | 高门槛、失败、告急、负向变化 |

#### 语义色用法

| 场景 | 底色 | 文字 | 边框 | 示例 |
|------|------|------|------|------|
| 品牌/信息 | `#f4f0ff` | `#533afd` | `#c6b5ff` | 活跃标签、选中态 |
| 成功/正向 | `#e1faed` | `#069469` | `#80e0b7` | 低门槛、价格下降、完成 |
| 警告/中性 | `#fffae6` | `#cf7c00` | `#ffde85` | 中等门槛、注意事项 |
| 错误/负向 | `#fff2f0` | `#c92e34` | `#ffc8c2` | 高门槛、价格上涨、失败 |

规则：底色用 level-1，文字用 level-7，边框用 level-3。保持三层级一致。

#### 中性色（灰阶）

| 用途 | Tailwind | 示例 |
|------|---------|------|
| 页面背景 | `gray-50` (`#f9fafb`) | body 底色 |
| 卡片背景 | `white` (`#ffffff`) | 内容容器 |
| 边框 | `gray-200` (`#e5e7eb`) | 卡片、表格分割线 |
| 弱分割线 | `gray-100` (`#f3f4f6`) | 表格行分割 |
| 页面标题 | `gray-900` (`#111827`) | h1、重要数字 |
| 正文 | `gray-700` (`#374151`) | 表格内容、描述文字 |
| 辅助文字 | `gray-500` (`#6b7280`) | 标签名、时间戳 |
| 最弱提示 | `gray-400` (`#9ca3af`) | 占位符、脚注 |

#### 图表配色

图表 8 色 palette，按辨识度排序：

```ts
// config/colors.ts
export const CHART_COLORS = [
  "#533afd", // 品牌紫
  "#10b981", // 绿
  "#f59e0b", // 琥珀
  "#ef4444", // 红
  "#06b6d4", // 青
  "#8b5cf6", // 浅紫
  "#ec4899", // 粉
  "#6b7280", // 灰（兜底/其他）
] as const;
```

用法：
- 饼图/柱状图按顺序取色
- 双线图：品牌紫 + 绿（对比色）
- 趋势面积图：品牌紫填充（opacity 0.1）+ 品牌紫线

#### 市场标识

市场用国旗 emoji 区分，不用颜色编码。统一使用中性灰底标签：

```tsx
// 用法示例
<Tag>🇦🇪 UAE</Tag>
<Tag>🇸🇦 KSA</Tag>
<Tag>🇪🇬 Egypt</Tag>
```

常量定义在 `config/colors.ts` 的 `MARKETS` 中，包含 flag、label、currency。

#### 不要做的事

- 不要在 antd 组件上用 Tailwind 颜色类覆盖品牌色（如 `className="bg-blue-600"`），用 antd token
- 不要在语义场景（成功/错误）中用品牌紫
- 不要自创新的语义色，只用这 4 个 seed 派生
- 不要在图表中用超过 8 种颜色，超出的合并为"其他"

### 3. 字体

#### 字体族

```
Inter, "Noto Sans Arabic", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif
```

| 文字 | 字体 | 加载方式 | 说明 |
|------|------|---------|------|
| 拉丁/英文 | **Inter** | `next/font/google` | 数据友好，tabular numbers |
| 阿拉伯语 | **Noto Sans Arabic** | `next/font/google` | RTL 产品标题/品类 |
| 中文 | 系统字体 | 不加载 | PingFang SC (macOS) / Microsoft YaHei (Win) |
| 等宽 (SKU) | `ui-monospace, SFMono-Regular, monospace` | 系统 | SKU、ASIN 等标识符 |

#### 字号体系

直接使用 antd 6 默认 font token，不自定义覆盖：

| antd Token | 字号 | 行高 | Tailwind 近似 | 用途 |
|-----------|------|------|---------------|------|
| `fontSizeHeading1` | 38px | 1.21 | `text-4xl` | 页面大标题（极少用） |
| `fontSizeHeading2` | 30px | 1.27 | `text-3xl` | 页面标题 |
| `fontSizeHeading3` | 24px | 1.33 | `text-2xl` | 区域标题 |
| `fontSizeHeading4` | 20px | 1.40 | `text-xl` | 卡片标题 |
| `fontSizeHeading5` | 16px | 1.50 | `text-base` | 小标题 |
| `fontSizeLG` | 16px | 1.50 | `text-base` | 大号正文 |
| **`fontSize`** | **14px** | **1.57** | **`text-sm`** | **基准正文** |
| `fontSizeSM` | 12px | 1.67 | `text-xs` | 辅助文字、标签 |

**强调权重**：`fontWeightStrong` = 600（semi-bold）

#### 使用规则

- antd 组件自动遵循上述 token，不需要额外处理
- Tailwind 部分使用对应的近似类（`text-sm` = 14px、`text-xs` = 12px 等）
- 数字使用 `font-variant-numeric: tabular-nums`（Inter 支持），确保表格中数字列对齐
- SKU / ASIN 等标识符使用等宽字体
- 颜色层级不变：标题 `gray-900`，正文 `gray-700`，辅助 `gray-500`，弱提示 `gray-400`

### 4. 卡片 & 容器

统一容器样式：

```
// 标准卡片
rounded-lg border border-gray-200 bg-white p-4

// 概览统计卡片
rounded-lg border border-gray-200 bg-white p-4
  └─ 标题：text-xs text-gray-500 mb-1
  └─ 数值：text-lg font-semibold text-gray-900

// 页面外层间距
space-y-8（区块间）
px-4 py-6（页面 padding，已在 layout 中）
max-w-7xl mx-auto（内容最大宽度，需要时加）
```

### 5. 表格规范（antd Table）

```tsx
<Table
  columns={columns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  pagination={{
    current: page,
    pageSize: 20,
    total,
    showSizeChanger: true,
    showTotal: (t) => `共 ${t} 条`,
  }}
  onChange={handleTableChange}
  scroll={{ x: "max-content" }}   // 移动端横向滚动
/>
```

**列定义约定：**
- 金额：`render: (v) => \`AED ${v.toFixed(2)}\`` 或 SAR
- 状态：用 antd `Tag` + `color` prop
- 百分比：`render: (v) => \`${v}%\``
- 操作列：`width: 120`, 用 `Space` 包裹链接
- 排序列：加 `sorter: true`
- 筛选列：加 `filters: [...]`

### 6. 图表规范

使用 `@ant-design/charts`（基于 AntV/G2），不使用 recharts。

```tsx
// 统一外壳
<div className="rounded-lg border border-gray-200 bg-white p-4">
  <h2 className="text-sm font-semibold text-gray-700 mb-3">图表标题</h2>
  <ChartComponent data={data} />
</div>
```

图表组件内部规范：
- 统一高度 `height={256}`
- 颜色从 `config/colors.ts` 的 `CHART_COLORS` 或 `BRAND` 取，不硬编码色值
- 空数据时显示居中提示：`flex h-64 items-center justify-center text-sm text-gray-500`
- Tooltip 中使用中文标签（`name: "产品数"` 等）
- 使用 `dynamic()` + `ssr: false` 懒加载（G2 依赖 Canvas，不支持 SSR）

```tsx
// charts-section.tsx 中的懒加载模式
const PriceTrendChart = dynamic(
  () => import("@/components/charts/price-trend-chart"),
  { ssr: false, loading: () => <div className="h-64 bg-gray-50 animate-pulse rounded-lg" /> },
);
```

常用组件对照：

| 场景 | @ant-design/charts 组件 | 说明 |
|------|------------------------|------|
| 折线/面积图 | `Area` / `Line` | 价格趋势、需求趋势 |
| 柱状图 | `Column` | 价格分布 |
| 饼图/环形图 | `Pie`（`innerRadius={0.5}`） | 品牌分布 |
| 散点图 | `Scatter` | 机会矩阵 |
| 雷达图 | `Radar` | 选品评分卡 |

### 7. 空状态 & 加载态

```tsx
// 空状态
<div className="text-center text-gray-500 py-20">
  <p className="text-lg font-medium">暂无数据</p>
  <p className="text-sm mt-1">描述原因或引导操作。</p>
</div>

// 加载态（antd Table 自带 loading prop）
// 其他场景用 antd Spin 或 skeleton
```

### 8. 响应式断点

沿用 Tailwind 默认断点：
- `sm:` — 640px（手机横屏）
- `lg:` — 1024px（桌面）

**常见模式：**
- 统计卡片：`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- 图表行：`grid grid-cols-1 lg:grid-cols-2 gap-6`
- 表格：`scroll={{ x: "max-content" }}`（横向滚动）

### 9. antd 组件使用清单

当前引入但**仅限使用以下组件**（按需扩展）：

| 组件 | 来源 | 用途 |
|------|------|------|
| `Table` | antd | 数据表格 |
| `Tag` | antd | 状态/分类标签 |
| `Button` | antd | 操作按钮 |
| `Input` / `Input.Search` | antd | 搜索输入 |
| `Form` / `Form.Item` | antd | 表单 |
| `Select` | antd | 下拉选择 |
| `Space` | antd | 元素间距 |
| `ConfigProvider` | antd | 主题/国际化 |
| `Image` | antd | 图片预览 |
| `Bubble` / `Bubble.List` | @ant-design/x | AI 对话气泡 |
| `Sender` | @ant-design/x | AI 输入框 |
| `ThoughtChain` | @ant-design/x | 推理链展示 |

**不引入的：** Modal、Drawer、Menu、Layout、Sider 等重交互组件暂不使用，等 ERP 需求明确后再评估。

---

## 三、Git 规范

### Commit Message

```
<type>: <短描述> (#issue)

<可选详细说明>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

**type 取值：**
- `feat` — 新功能
- `fix` — Bug 修复
- `refactor` — 重构（不改变行为）
- `infra` — 基础设施/依赖/配置
- `docs` — 文档
- `test` — 测试

### 分支命名

```
feat/<描述>          # 新功能
fix/<描述>           # Bug 修复
refactor/<描述>      # 重构
infra/<描述>         # 基础设施
```
