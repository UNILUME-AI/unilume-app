/**
 * GET    /api/conversations         — list 当前用户对话 (或 ?id=<uuid> 取单个)
 * DELETE /api/conversations?id=<uuid> — 删除指定对话
 *
 * Clerk auth 必填. id 必须 UUID v4 格式.
 *
 * Schema: src/lib/api-schemas/chat.ts (ConversationsGet/DeleteQuerySchema).
 */

import { auth } from "@clerk/nextjs/server";
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  cleanupStreamingMessages,
} from "@/lib/db";
import {
  ConversationsGetQuerySchema,
  ConversationsDeleteQuerySchema,
} from "@/lib/api-schemas/chat";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = ConversationsGetQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      {
        error: `Invalid parameter '${issue?.path?.map(String).join(".") || "query"}': ${issue?.message}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.id) {
      await cleanupStreamingMessages(parsed.data.id);
      const conversation = await getConversationMessages(parsed.data.id, userId);
      return Response.json({ conversation });
    }
    const conversations = await listConversations(userId);
    return Response.json({ conversations });
  } catch (error) {
    console.error("Conversations GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = ConversationsDeleteQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      {
        error: `Invalid parameter '${issue?.path?.map(String).join(".") || "query"}': ${issue?.message}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    await deleteConversation(parsed.data.id, userId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Conversations DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
