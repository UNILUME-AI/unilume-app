/**
 * POST  /api/conversations/{id}/messages — append a new message
 * PATCH /api/conversations/{id}/messages — update streaming message parts (partial)
 * PUT   /api/conversations/{id}/messages — finalize a streaming message
 *
 * Clerk auth 必填. path id 必须 UUID v4.
 *
 * Schema: src/lib/api-schemas/chat.ts (Messages* schemas).
 */

import { auth } from "@clerk/nextjs/server";
import {
  ensureConversation,
  appendMessage,
  updateMessageParts,
  finalizeMessage,
  updateConversationTitle,
} from "@/lib/db";
import {
  MessagesPathSchema,
  MessagesPostBodySchema,
  MessagesPatchBodySchema,
  MessagesPutBodySchema,
} from "@/lib/api-schemas/chat";
import type { ZodError } from "zod";

async function resolvePath(params: Promise<{ id: string }>) {
  const parsed = MessagesPathSchema.safeParse(await params);
  if (!parsed.success) return null;
  return parsed.data.id;
}

function validationError(error: ZodError) {
  const issue = error.issues[0];
  // path 在 zod 4 是 PropertyKey[] (允许 symbol), 用 String() cast 一下兼容
  const fieldPath = issue?.path?.map(String).join(".") || "body";
  return Response.json(
    {
      error: `Invalid field '${fieldPath}': ${issue?.message ?? "validation failed"}`,
      details: error.issues,
    },
    { status: 400 },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = await resolvePath(params);
  if (!conversationId)
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MessagesPostBodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const { id, parentMessageId, role, parts, status, ordinal, title } = parsed.data;

  try {
    await ensureConversation(conversationId, userId, title);
    await appendMessage(conversationId, {
      id,
      parentMessageId: parentMessageId ?? null,
      role,
      parts,
      status,
      ordinal,
    });
    if (role === "user" && ordinal === 0 && title) {
      await updateConversationTitle(conversationId, userId, title);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = await resolvePath(params);
  if (!conversationId)
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MessagesPatchBodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await updateMessageParts(parsed.data.messageId, conversationId, parsed.data.parts);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = await resolvePath(params);
  if (!conversationId)
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MessagesPutBodySchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await finalizeMessage(parsed.data.messageId, conversationId, parsed.data.parts);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
