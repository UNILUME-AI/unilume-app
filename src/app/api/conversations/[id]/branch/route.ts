import { auth } from "@clerk/nextjs/server";
import {
  deactivateSiblings,
  deactivateDescendants,
  appendMessage,
  getMessageSiblings,
  switchBranch,
  getConversationMessages,
} from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST — create a branch (edit or regenerate) */
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

  const { parentMessageId, message, branchOrdinal } = body as {
    parentMessageId: string | null;
    message: { id: string; role: string; parts: unknown[] };
    branchOrdinal: number;
  };

  if (!message?.id || !message?.role || !Array.isArray(message?.parts)) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }

  try {
    // Deactivate siblings at the branch point
    await deactivateSiblings(conversationId, parentMessageId);
    // Deactivate all descendants after the branch point
    await deactivateDescendants(conversationId, branchOrdinal - 1);
    // Insert new message as the active child
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

/** GET — get siblings for branch navigator, or switch active branch */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;
  const url = new URL(req.url);
  const parentMessageId = url.searchParams.get("parentMessageId"); // null-string = root
  const switchTo = url.searchParams.get("switchTo"); // optional: switch active branch

  try {
    if (switchTo) {
      await switchBranch(
        conversationId,
        parentMessageId === "null" ? null : parentMessageId,
        switchTo,
      );
      // Return the reloaded active branch
      const conversation = await getConversationMessages(conversationId, userId);
      return Response.json({ conversation });
    }

    const siblings = await getMessageSiblings(
      conversationId,
      parentMessageId === "null" ? null : parentMessageId,
    );
    return Response.json({ siblings });
  } catch (error) {
    console.error("Branch GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
