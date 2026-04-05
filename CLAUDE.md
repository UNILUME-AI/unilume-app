@AGENTS.md

# CLAUDE.md — unilume-app

## What is this repo?

UNILUME 主应用——Noon 卖家的 AI 运营合伙人。Next.js 16 App Router + Vercel 部署。

Design docs: `unilume-docs/architecture/app/`
Code standards: `unilume-docs/standards/code-standards.md`
Deployment: `unilume-docs/standards/deployment-guide.md`

## Tech stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **UI**: antd 6 + @ant-design/x 2.0 + Tailwind v4
- **Auth**: Clerk (Google OAuth)
- **Database**: Neon PostgreSQL (@neondatabase/serverless) + pgvector
- **AI**: Google Vertex AI (Gemini 2.5 Flash) via @ai-sdk/google-vertex
- **Deploy**: Vercel (Production: unilume.com)

## Key modules

- **AI Chat** (`src/app/(chat)/`): Noon 政策问答，知识库 RAG 检索
- **Market** (`src/app/market/`): 市场数据看板，选品分析
- **ERP** (`src/app/erp/`): 订单/商品/库存管理（搭建中）
- **API** (`src/app/api/`): chat, feedback, market API routes

## Key files

- `src/lib/knowledge-base.ts` — 知识库查询（Neon pgvector 语义搜索）
- `src/lib/market-data.ts` — 市场数据查询（Neon）
- `src/lib/tools.ts` — AI Chat tool definitions
- `src/lib/prompts.ts` — System prompt 构建
- `src/lib/vertex.ts` — Google Vertex AI 客户端
- `src/lib/db.ts` — Neon 数据库连接
- `src/components/charts/` — @ant-design/charts 图表组件
- `src/components/shared/AntdProvider.tsx` — antd 主题 + SSR 配置

## Commands

```bash
npm install
npm run dev          # 本地开发
npm run build        # 生产构建
npm run lint         # ESLint
npm run test         # Vitest
npm run db:generate  # Schema 变更后生成迁移 SQL
npm run db:migrate   # 执行未应用的迁移
npm run db:pull      # 从数据库反向生成 schema
npm run db:studio    # 打开 Drizzle Studio 浏览数据
```

## Conventions

- Server Component 为默认，仅交互组件加 `"use client"`
- 文件命名 kebab-case（`price-trend-chart.tsx`）
- antd 管组件交互，Tailwind 管布局和细节样式
- 品牌色 `#533afd`，通过 antd ConfigProvider token 配置
- 图表用 @ant-design/charts + `dynamic({ ssr: false })` 懒加载
- SQL 用 Neon tagged template（自动参数化），禁止拼接
- 数据库 schema 定义在 `src/db/schema.ts`（Drizzle ORM，单一事实来源）
- 迁移文件在 `drizzle/`（提交到 git）
- 迁移工作流：改 schema → `db:generate` → 检查 SQL → `db:migrate`
- 迁移在部署前手动执行，不在 Vercel build 中自动执行

## Environment

- Development: Preview URL (Clerk Dev + Neon Staging)
- Staging: staging.unilume.com (Clerk Dev + Neon Staging)
- Production: unilume.com (Clerk Prod + Neon Prod)
