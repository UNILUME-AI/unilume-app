/**
 * OpenAPI 3.1 spec generator from Zod schemas.
 *
 * 维护一个静态 endpoints 数组, 每个条目声明:
 *   method / path / query schema / body schema / responses schema
 *
 * 在生成时把所有 schema 跑过 z.toJSONSchema(), 拼成 OpenAPI 3.1 文档.
 *
 * 为什么用静态注册而非 route-side 副作用:
 *   Next.js App Router 按需 lazy-load route 文件, 副作用注册不可靠.
 *   静态数组是 build-time 确定的, 走任意 next.js 渲染路径都拿得到.
 */

import { z } from "zod";
import {
  ConsumerSearchQuerySchema,
  ConsumerSearchResponseSchema,
  ErrorResponseSchema,
} from "./categories";

// ── Types ─────────────────────────────────────

export interface ResponseSpec {
  description: string;
  schema?: z.ZodTypeAny;
}

export interface EndpointSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  tags: string[];
  summary: string;
  description?: string;
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodTypeAny;
  responses: Record<number, ResponseSpec>;
}

// ── Endpoint registry ────────────────────────

export const endpoints: EndpointSpec[] = [
  {
    method: "GET",
    path: "/api/categories/consumer",
    tags: ["Categories"],
    summary: "搜索 C 端类目",
    description:
      "AI Selection Agent 的 category_lookup tool 主路径. " +
      "按 code/name LIKE 匹配, 默认只返回 active 类目, 支持按 parent 精确过滤.",
    query: ConsumerSearchQuerySchema,
    responses: {
      200: {
        description: "搜索成功 (即使 results 为空也是 200)",
        schema: ConsumerSearchResponseSchema,
      },
      400: { description: "参数无效", schema: ErrorResponseSchema },
      500: { description: "数据库错误", schema: ErrorResponseSchema },
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
  const components: Record<string, Record<string, unknown>> = { schemas: {} };

  for (const ep of endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};

    const operation: Record<string, unknown> = {
      tags: ep.tags,
      summary: ep.summary,
      description: ep.description,
      responses: Object.fromEntries(
        Object.entries(ep.responses).map(([status, r]) => [
          status,
          {
            description: r.description,
            ...(r.schema && {
              content: {
                "application/json": { schema: z.toJSONSchema(r.schema) },
              },
            }),
          },
        ]),
      ),
    };

    if (ep.query) {
      operation.parameters = zodObjectToParameters(ep.query, "query");
    }
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
        "UNILUME 主应用对外 / 内部 API. 大部分 endpoint 当前只读, 配合 AI Selection Agent 和市场看板.",
    },
    servers: SERVERS,
    paths,
    components,
  };
}

// ── Helpers ───────────────────────────────────

/** 把 zod object 拆成 OpenAPI parameters 数组. 识别 default / optional 决定 required. */
function zodObjectToParameters(
  obj: z.ZodObject<z.ZodRawShape>,
  location: "query" | "path" | "header",
) {
  const shape = obj.shape;
  return Object.entries(shape).map(([name, schema]) => {
    const jsonSchema = z.toJSONSchema(schema as z.ZodTypeAny);
    // 有 default 或 optional 都视作 not required
    const hasDefault = "default" in (jsonSchema as Record<string, unknown>);
    const isOptional = (schema as z.ZodTypeAny).safeParse(undefined).success;

    return {
      name,
      in: location,
      required: !hasDefault && !isOptional,
      schema: jsonSchema,
      description: (jsonSchema as { description?: string }).description,
    };
  });
}
