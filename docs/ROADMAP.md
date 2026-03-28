# UNILUME App 优化路线图

> 更新日期：2026-03-28

## 项目概述

UNILUME 是基于 Next.js 的 AI 聊天助手，帮助 Noon 电商卖家查询平台政策。使用 Google Vertex AI (Gemini 2.5 Flash) + RAG 检索 223+ 篇官方帮助文档。

---

## 第一档：推荐尽快做

### 1. 前端错误处理
- **现状：** API 请求失败时 UI 无任何反馈，用户看到消息发出去但没有回复
- **目标：** 展示错误提示、支持重试、网络超时提示
- **涉及文件：** `src/app/page.tsx`

### 2. API 输入校验
- **现状：** `/api/chat` 的 `messages` 参数没有格式验证，恶意请求可能导致异常
- **目标：** 用 Zod 校验请求体结构，返回明确的错误码（400/500）
- **涉及文件：** `src/app/api/chat/route.ts`

### 3. 聊天记录持久化
- **现状：** 刷新页面后对话历史全部丢失
- **目标：** 用 `localStorage` 保存对话记录，支持恢复历史会话
- **涉及文件：** `src/app/page.tsx`

### 4. 知识库加载错误处理
- **现状：** 文章加载失败时静默返回 `null`，无日志，用户不知道知识库不完整
- **目标：** 加错误日志记录，前端展示降级提示
- **涉及文件：** `src/lib/knowledge-base.ts`

---

## 第二档：体验提升

### 5. 知识库语义检索
- **现状：** 简单关键词匹配路由到分类，精度有限
- **目标：** 引入向量数据库（Pinecone/Weaviate）实现语义搜索，提升检索质量
- **涉及文件：** `src/lib/knowledge-base.ts`, `src/lib/tools.ts`

### 6. 多轮对话上下文管理
- **现状：** 每轮将全部历史消息发给 LLM，token 消耗大
- **目标：** 加上下文窗口管理，截断或摘要早期消息
- **涉及文件：** `src/app/api/chat/route.ts`

### 7. 热门问题响应缓存
- **现状：** 相同问题每次都重新请求 LLM
- **目标：** 对热门问题缓存回答，减少延迟和成本
- **技术选型：** Vercel Edge Config 或 Upstash Redis

### 8. 移动端体验优化
- **现状：** 基本响应式但不够细致
- **目标：** 优化移动端输入框、消息气泡间距、键盘弹出体验
- **涉及文件：** `src/app/page.tsx`, `src/app/globals.css`

### 9. 快捷问题可配置化
- **现状：** 6 个快捷问题硬编码在 `page.tsx`
- **目标：** 移到配置文件或后台管理，支持动态更新
- **涉及文件：** `src/app/page.tsx`

---

## 第三档：生产级加固

### 10. API 限流防护
- **现状：** 无任何请求频率限制，存在滥用风险
- **目标：** 加 rate limiting（基于 IP 或 session）
- **技术选型：** Vercel WAF 或 Upstash Ratelimit

### 11. 可观测性建设
- **现状：** 只有 `console.error`，无结构化日志
- **目标：** 加结构化日志、请求追踪、性能监控
- **技术选型：** Sentry / Vercel Observability / OpenTelemetry

### 12. 测试覆盖
- **现状：** 仅有 e2e 计算器测试
- **目标：** 补充知识库路由单测、API 集成测试、前端组件测试
- **涉及文件：** 新建 `tests/` 目录

### 13. 文章缓存管理
- **现状：** `Map` 缓存无大小上限，长时间运行可能内存泄漏
- **目标：** 加 LRU 淘汰策略或缓存大小限制
- **涉及文件：** `src/lib/knowledge-base.ts`

### 14. Next.js 配置优化
- **现状：** `next.config.ts` 几乎为空
- **目标：** 配置 compression、security headers、image 优化
- **涉及文件：** `next.config.ts`
