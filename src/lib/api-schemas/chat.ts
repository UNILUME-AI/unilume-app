/**
 * Zod schemas for /api/chat, /api/conversations/*, /api/feedback endpoints.
 *
 * 这一组路径全部要 Clerk auth (responses 含 401 Unauthorized).
 */

import { z } from "zod";

// ── 共用 ─────────────────────────────────────

export const UnauthorizedResponseSchema = z
  .object({ error: z.literal("Unauthorized") })
  .meta({ id: "UnauthorizedResponse" });

const UuidParam = z.uuid().meta({
  description: "UUID v4",
  examples: ["a1b2c3d4-e5f6-4789-9abc-def012345678"],
});

const OkResponseSchema = z
  .object({ ok: z.literal(true) })
  .meta({ id: "OkResponse" });

// ── /api/chat (POST, streaming) ──────────────

// Vercel AI SDK 的 UIMessage 结构, 完整定义在 'ai' 包. 这里给个最小契约.
const UIMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.any() (not z.unknown()) so inferred type is `any[]`, compatible with AI SDK's UIMessagePart<UIDataTypes, UITools>[] without narrowing. zod 只校验是数组, 不复刻 SDK 部件联合.
  parts: z.array(z.any()).meta({
    description: "AI SDK message parts (text / tool-call / tool-result 等), 见 Vercel AI SDK 文档",
  }),
});

export const ChatRequestSchema = z
  .object({
    messages: z.array(UIMessageSchema).min(1).max(50).meta({
      description: "对话历史. 至少 1 条, 最多 50 条; 超过会被 400.",
    }),
  })
  .meta({ id: "ChatRequest" });

// ── /api/conversations (GET / DELETE) ────────

export const ConversationsGetQuerySchema = z.object({
  id: z.uuid().optional().meta({
    description: "传 id 取单个会话详情; 不传则列出当前用户全部会话",
  }),
});

export const ConversationsDeleteQuerySchema = z.object({
  id: UuidParam.meta({ description: "要删除的会话 UUID (必填)" }),
});

// ── /api/conversations/{id}/branch ───────────

export const BranchPathSchema = z.object({ id: UuidParam });

export const BranchPostBodySchema = z
  .object({
    parentMessageId: z.string().nullable().meta({
      description: "分叉点的父消息 id; null = 从对话根开始分叉",
    }),
    message: z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.any() (not z.unknown()) so inferred type is `any[]`, compatible with AI SDK's UIMessagePart<UIDataTypes, UITools>[] without further narrow. zod 只校验是数组, 不复刻 SDK 部件联合.
    parts: z.array(z.any()),
    }),
    branchOrdinal: z.number().int().min(0),
  })
  .meta({ id: "BranchPostBody" });

export const BranchGetQuerySchema = z.object({
  parentMessageId: z
    .string()
    .meta({
      description: "父消息 id, 字符串 'null' 表示对话根",
    }),
  switchTo: z.string().optional().meta({
    description: "若传, 切换到该 branch 并返回最新 active conversation",
  }),
});

// ── /api/conversations/{id}/messages ─────────

export const MessagesPathSchema = z.object({ id: UuidParam });

export const MessagesPostBodySchema = z
  .object({
    id: z.string().meta({ description: "新消息 id" }),
    parentMessageId: z.string().nullable(),
    role: z.enum(["user", "assistant", "system"]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.any() (not z.unknown()) so inferred type is `any[]`, compatible with AI SDK's UIMessagePart<UIDataTypes, UITools>[] without further narrow. zod 只校验是数组, 不复刻 SDK 部件联合.
    parts: z.array(z.any()),
    status: z.enum(["streaming", "complete"]).optional(),
    ordinal: z.number().int().min(0),
    title: z.string().optional().meta({
      description: "可选, role=user 且 ordinal=0 时用作 conversation title",
    }),
  })
  .meta({ id: "MessagesPostBody" });

export const MessagesPatchBodySchema = z
  .object({
    messageId: z.string(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.any() (not z.unknown()) so inferred type is `any[]`, compatible with AI SDK's UIMessagePart<UIDataTypes, UITools>[] without further narrow. zod 只校验是数组, 不复刻 SDK 部件联合.
    parts: z.array(z.any()),
  })
  .meta({ id: "MessagesPatchBody" });

export const MessagesPutBodySchema = MessagesPatchBodySchema.meta({
  id: "MessagesPutBody",
});

// ── /api/feedback ────────────────────────────

export const FeedbackBodySchema = z
  .object({
    rating: z.enum(["up", "down"]),
    userQuery: z.string().min(1).max(5000),
    assistantResponse: z.string().min(1).max(20000),
  })
  .meta({ id: "FeedbackBody" });

// ── 共享导出 ─────────────────────────────────

export { OkResponseSchema };
