import { auth } from "@clerk/nextjs/server";
import {
  ensureConversation,
  appendMessage,
  updateMessageParts,
  finalizeMessage,
  updateConversationTitle,
} from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST — append a new message */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;
  if (!UUID_RE.test(conversationId))
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id: msgId, parentMessageId, role, parts, status, ordinal, title } = body as {
    id: string;
    parentMessageId: string | null;
    role: string;
    parts: unknown[];
    status?: string;
    ordinal: number;
    title?: string;
  };

  if (!msgId || !role || !Array.isArray(parts) || typeof ordinal !== "number") {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }

  try {
    // Ensure conversation exists (no-op if already created)
    await ensureConversation(conversationId, userId, title);
    await appendMessage(conversationId, {
      id: msgId,
      parentMessageId: parentMessageId ?? null,
      role,
      parts,
      status,
      ordinal,
    });
    // Set title from first user message
    if (role === "user" && ordinal === 0 && title) {
      await updateConversationTitle(conversationId, userId, title);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH — update streaming message parts */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messageId, parts } = body as { messageId: string; parts: unknown[] };
  if (!messageId || !Array.isArray(parts))
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  try {
    await updateMessageParts(messageId, conversationId, parts);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PUT — finalize a streaming message */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messageId, parts } = body as { messageId: string; parts: unknown[] };
  if (!messageId || !Array.isArray(parts))
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  try {
    await finalizeMessage(messageId, conversationId, parts);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Messages PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
