/**
 * OpenAPI 3.1 spec generator from Zod schemas.
 *
 * 静态 endpoints 数组声明所有 route 的 method / path / query / body / responses.
 * 生成时跑 z.toJSONSchema() 拼成 OpenAPI 3.1 文档. OpenAPI 3.1 基于 JSON Schema
 * draft 2020-12, 和 zod 4 输出完全兼容.
 *
 * 为什么用静态注册而非 route-side 副作用:
 *   Next.js App Router 按需 lazy-load, 副作用注册不可靠.
 *   静态数组让 spec 在任何 next.js 渲染路径都完整.
 */

import { z } from "zod";
import {
  ConsumerSearchQuerySchema,
  ConsumerSearchResponseSchema,
  ErrorResponseSchema,
  SellerSearchQuerySchema,
  SellerSearchResponseSchema,
  ResolveQuerySchema,
  CategoryResolveResultSchema,
  MapQuerySchema,
  CategoryMappingResultSchema,
} from "./categories";
import {
  MarketOverviewSchema,
  OverviewQuerySchema,
  PriceTrendSchema,
  TrendQuerySchema,
  KeywordsResponseSchema,
  CrossMarketComparisonSchema,
  CompareQuerySchema,
  ProductsQuerySchema,
  ProductsResponseSchema,
  BrandDistributionSchema,
} from "./market";
import {
  ChatRequestSchema,
  ConversationsGetQuerySchema,
  ConversationsDeleteQuerySchema,
  BranchPathSchema,
  BranchPostBodySchema,
  BranchGetQuerySchema,
  MessagesPathSchema,
  MessagesPostBodySchema,
  MessagesPatchBodySchema,
  MessagesPutBodySchema,
  FeedbackBodySchema,
  OkResponseSchema,
  UnauthorizedResponseSchema,
} from "./chat";

// ── Types ─────────────────────────────────────

type ResponseShape =
  | { description: string; schema?: z.ZodTypeAny }
  | { description: string; contentType: string; note?: string };

export interface EndpointSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  tags: string[];
  summary: string;
  description?: string;
  query?: z.ZodObject<z.ZodRawShape>;
  pathParams?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodTypeAny;
  responses: Record<number, ResponseShape>;
  requiresAuth?: boolean;
}

// ── Common responses ─────────────────────────

const stdErrors = {
  400: { description: "参数无效", schema: ErrorResponseSchema },
  500: { description: "服务器错误", schema: ErrorResponseSchema },
};

const authErrors = {
  401: {
    description: "未登录或 Clerk session 失效",
    schema: UnauthorizedResponseSchema,
  },
};

// ── Endpoint registry (15 个) ────────────────

export const endpoints: EndpointSpec[] = [
  // ── Categories (4) ─────────────────────────
  {
    method: "GET",
    path: "/api/categories/consumer",
    tags: ["Categories"],
    summary: "搜索 C 端类目",
    description:
      "AI Selection Agent 的 category_lookup 主路径. 按 code/name LIKE 匹配, 默认只返回 active 类目, 支持按 parent 精确过滤.",
    query: ConsumerSearchQuerySchema,
    responses: {
      200: { description: "搜索成功", schema: ConsumerSearchResponseSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/categories/seller",
    tags: ["Categories"],
    summary: "搜索 B 端类目",
    description:
      "运维 / 调试用. AI 应该走 /api/categories/map 而非 free-text 搜 seller.\n\nPhase 1: seller_categories 表 0 行 (Phase 2 接 partners-catalogmd-v2 才有数据).",
    query: SellerSearchQuerySchema,
    responses: {
      200: { description: "搜索成功 (Phase 1 可能为空)", schema: SellerSearchResponseSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/categories/resolve",
    tags: ["Categories"],
    summary: "解析(过时)code 到 canonical",
    description:
      "把可能过时的 code resolve 到当前 canonical code, 处理改名 / 软删除 / 不存在场景. `not_found` 和 `removed` 都是 HTTP 200 域状态, 不是 HTTP 404.",
    query: ResolveQuerySchema,
    responses: {
      200: { description: "返回 status + canonical_code", schema: CategoryResolveResultSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/categories/map",
    tags: ["Categories"],
    summary: "C 端 → B 端类目映射",
    description:
      "AI / 上架流程把 consumer code 转 seller pk/code.\n\nPhase 1 永远返回 `no_confirmed_mapping`, AI tool 必须走 concierge 兜底.",
    query: MapQuerySchema,
    responses: {
      200: { description: "返回映射或 no_confirmed_mapping", schema: CategoryMappingResultSchema },
      ...stdErrors,
    },
  },

  // ── Market (6) ─────────────────────────────
  {
    method: "GET",
    path: "/api/market/overview",
    tags: ["Market"],
    summary: "市场概览",
    description: "给定关键词 + 市场的价格分布 / 评分 / sponsored 占比 / top sellers.",
    query: OverviewQuerySchema,
    responses: {
      200: { description: "市场概览数据", schema: MarketOverviewSchema },
      404: { description: "该关键词 + 市场无数据", schema: ErrorResponseSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/market/brands",
    tags: ["Market"],
    summary: "品牌占比分布",
    description: "Top N brands 的商品数 / 占比 / 平均价.",
    query: OverviewQuerySchema,
    responses: {
      200: { description: "品牌分布", schema: BrandDistributionSchema },
      404: { description: "无数据", schema: ErrorResponseSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/market/compare",
    tags: ["Market"],
    summary: "跨市场对比 (UAE vs KSA)",
    description: "返回两市场的 MarketOverview + deltas + AI 偏好建议.",
    query: CompareQuerySchema,
    responses: {
      200: { description: "跨市场对比", schema: CrossMarketComparisonSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/market/keywords",
    tags: ["Market"],
    summary: "可用关键词列表 + 类目分组",
    description: "供市场看板侧栏 / 关键词选择器使用.",
    responses: {
      200: { description: "关键词列表", schema: KeywordsResponseSchema },
      500: stdErrors[500],
    },
  },
  {
    method: "GET",
    path: "/api/market/products",
    tags: ["Market"],
    summary: "商品列表",
    description: "给定关键词 + 市场的前 N 条商品, 可排序.",
    query: ProductsQuerySchema,
    responses: {
      200: { description: "商品列表", schema: ProductsResponseSchema },
      ...stdErrors,
    },
  },
  {
    method: "GET",
    path: "/api/market/trend",
    tags: ["Market"],
    summary: "价格趋势",
    description: "回溯 N 天的每日 median / p25 / p75 + 趋势方向 + 涨跌幅.",
    query: TrendQuerySchema,
    responses: {
      200: { description: "价格趋势", schema: PriceTrendSchema },
      ...stdErrors,
    },
  },

  // ── Chat / AI (1, streaming) ───────────────
  {
    method: "POST",
    path: "/api/chat",
    tags: ["Chat"],
    summary: "AI 对话主入口 (streaming)",
    description:
      "Vercel AI SDK UIMessage stream (SSE). 工具: policyTools + marketTools. 模型: Gemini 2.5 Flash.",
    body: ChatRequestSchema,
    requiresAuth: true,
    responses: {
      200: {
        description: "SSE stream (text/event-stream)",
        contentType: "text/event-stream",
        note: "Vercel AI SDK 的 UIMessage stream protocol, 见 https://sdk.vercel.ai",
      },
      ...stdErrors,
      ...authErrors,
    },
  },

  // ── Conversations (3) ──────────────────────
  {
    method: "GET",
    path: "/api/conversations",
    tags: ["Conversations"],
    summary: "列出对话 / 取单条详情",
    description: "传 id 取单条详情; 不传则列出当前用户全部对话.",
    query: ConversationsGetQuerySchema,
    requiresAuth: true,
    responses: {
      200: { description: "对话列表或单条详情" },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "DELETE",
    path: "/api/conversations",
    tags: ["Conversations"],
    summary: "删除对话",
    description: "永久删除指定 UUID 的对话 (含关联 messages).",
    query: ConversationsDeleteQuerySchema,
    requiresAuth: true,
    responses: {
      200: { description: "删除成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "POST",
    path: "/api/conversations/{id}/branch",
    tags: ["Conversations"],
    summary: "创建分支 (edit / regenerate)",
    description: "在指定位置创建新分支, 会 deactivate 同级和子级.",
    pathParams: BranchPathSchema,
    body: BranchPostBodySchema,
    requiresAuth: true,
    responses: {
      200: { description: "创建成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "GET",
    path: "/api/conversations/{id}/branch",
    tags: ["Conversations"],
    summary: "取 siblings 或切换 branch",
    description:
      "GET parent 下的 siblings; 传 switchTo 切换到指定 branch 并返回最新 active 对话.",
    pathParams: BranchPathSchema,
    query: BranchGetQuerySchema,
    requiresAuth: true,
    responses: {
      200: { description: "siblings 列表 或 当前 active 对话" },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "POST",
    path: "/api/conversations/{id}/messages",
    tags: ["Conversations"],
    summary: "追加消息",
    description: "POST 新消息. role=user 且 ordinal=0 时, title 字段会写到对话标题.",
    pathParams: MessagesPathSchema,
    body: MessagesPostBodySchema,
    requiresAuth: true,
    responses: {
      200: { description: "成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "PATCH",
    path: "/api/conversations/{id}/messages",
    tags: ["Conversations"],
    summary: "更新 streaming 消息 (中间态)",
    description: "用于 AI streaming 过程中持续写入 parts.",
    pathParams: MessagesPathSchema,
    body: MessagesPatchBodySchema,
    requiresAuth: true,
    responses: {
      200: { description: "成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },
  {
    method: "PUT",
    path: "/api/conversations/{id}/messages",
    tags: ["Conversations"],
    summary: "finalize streaming 消息",
    description: "streaming 结束后调用一次, 标记 status=complete.",
    pathParams: MessagesPathSchema,
    body: MessagesPutBodySchema,
    requiresAuth: true,
    responses: {
      200: { description: "成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },

  // ── Feedback (1) ───────────────────────────
  {
    method: "POST",
    path: "/api/feedback",
    tags: ["Feedback"],
    summary: "AI 回答点赞 / 点踩",
    description: "userQuery 截断到 5000 字符, assistantResponse 截断到 20000 字符.",
    body: FeedbackBodySchema,
    requiresAuth: true,
    responses: {
      200: { description: "成功", schema: OkResponseSchema },
      ...stdErrors,
      ...authErrors,
    },
  },
];

// ── OpenAPI 3.1 generation ───────────────────

const SERVERS = [
  { url: "https://unilume.com", description: "Production" },
  { url: "https://staging.unilume.com", description: "Staging" },
  { url: "http://localhost:3000", description: "Local dev" },
];

export function generateOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};

    const operation: Record<string, unknown> = {
      tags: ep.tags,
      summary: ep.summary,
      description: ep.description,
      ...(ep.requiresAuth && { security: [{ ClerkAuth: [] }] }),
      responses: Object.fromEntries(
        Object.entries(ep.responses).map(([status, r]) => [
          status,
          {
            description: r.description,
            ...("schema" in r && r.schema
              ? {
                  content: {
                    "application/json": { schema: z.toJSONSchema(r.schema) },
                  },
                }
              : {}),
            ...("contentType" in r
              ? {
                  content: { [r.contentType]: {} },
                  ...(r.note && { "x-stream-note": r.note }),
                }
              : {}),
          },
        ]),
      ),
    };

    const parameters: unknown[] = [];
    if (ep.pathParams) {
      parameters.push(...zodObjectToParameters(ep.pathParams, "path"));
    }
    if (ep.query) {
      parameters.push(...zodObjectToParameters(ep.query, "query"));
    }
    if (parameters.length > 0) operation.parameters = parameters;

    if (ep.body) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: z.toJSONSchema(ep.body) } },
      };
    }

    paths[ep.path][ep.method.toLowerCase()] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "UNILUME App API",
      version: "1.0.0",
      description:
        "UNILUME 主应用对外 / 内部 API. Categories / Market 为只读公开, Chat / Conversations / Feedback 需 Clerk auth.",
    },
    servers: SERVERS,
    components: {
      schemas: {},
      securitySchemes: {
        ClerkAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Clerk JWT, 通过 cookie 或 Authorization header 传入",
        },
      },
    },
    paths,
  };
}

// ── Helpers ───────────────────────────────────

function zodObjectToParameters(
  obj: z.ZodObject<z.ZodRawShape>,
  location: "query" | "path" | "header",
) {
  const shape = obj.shape;
  return Object.entries(shape).map(([name, schema]) => {
    const jsonSchema = z.toJSONSchema(schema as z.ZodTypeAny);
    const hasDefault = "default" in (jsonSchema as Record<string, unknown>);
    const isOptional = (schema as z.ZodTypeAny).safeParse(undefined).success;
    // path params 必须 required
    const required = location === "path" || (!hasDefault && !isOptional);

    return {
      name,
      in: location,
      required,
      schema: jsonSchema,
      description: (jsonSchema as { description?: string }).description,
    };
  });
}
