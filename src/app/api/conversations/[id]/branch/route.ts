/**
 * POST /api/conversations/{id}/branch — 在指定位置创建新分支 (edit / regenerate)
 * GET  /api/conversations/{id}/branch — 取当前 parent 下的 siblings, 或 switchTo 切换 active branch
 *
 * Clerk auth 必填. path id 必须 UUID v4.
 *
 * Schema: src/lib/api-schemas/chat.ts (Branch* schemas).
 */

import { auth } from "@clerk/nextjs/server";
import {
  deactivateSiblings,
  deactivateDescendants,
  appendMessage,
  getMessageSiblings,
  switchBranch,
  getConversationMessages,
} from "@/lib/db";
import {
  BranchPathSchema,
  BranchPostBodySchema,
  BranchGetQuerySchema,
} from "@/lib/api-schemas/chat";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const pathParsed = BranchPathSchema.safeParse(await params);
  if (!pathParsed.success) {
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });
  }
  const conversationId = pathParsed.data.id;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BranchPostBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      {
        error: `Invalid field '${issue?.path?.join(".") || "body"}': ${issue?.message}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { parentMessageId, message, branchOrdinal } = parsed.data;

  try {
    await deactivateSiblings(conversationId, parentMessageId);
    await deactivateDescendants(conversationId, branchOrdinal - 1);
    await appendMessage(conversationId, {
      id: message.id,
      parentMessageId: parentMessageId ?? null,
      role: message.role,
      parts: message.parts,
      status: "complete",
      ordinal: branchOrdinal,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Branch POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const pathParsed = BranchPathSchema.safeParse(await params);
  if (!pathParsed.success) {
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });
  }
  const conversationId = pathParsed.data.id;

  const url = new URL(req.url);
  const parsed = BranchGetQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      {
        error: `Invalid parameter '${issue?.path?.join(".") || "query"}': ${issue?.message}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const parentMessageId = parsed.data.parentMessageId;
  const switchTo = parsed.data.switchTo;
  const normalizedParent =
    parentMessageId === "null" ? null : parentMessageId;

  try {
    if (switchTo) {
      await switchBranch(conversationId, normalizedParent, switchTo);
      const conversation = await getConversationMessages(conversationId, userId);
      return Response.json({ conversation });
    }
    const siblings = await getMessageSiblings(conversationId, normalizedParent);
    return Response.json({ siblings });
  } catch (error) {
    console.error("Branch GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
