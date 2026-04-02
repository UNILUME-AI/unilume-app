import { auth } from "@clerk/nextjs/server";
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  cleanupStreamingMessages,
} from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (id) {
      if (!UUID_RE.test(id))
        return Response.json({ error: "Invalid id format" }, { status: 400 });

      // Clean up any interrupted streams before loading
      await cleanupStreamingMessages(id);
      const conversation = await getConversationMessages(id, userId);
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
  const id = url.searchParams.get("id");
  if (!id || !UUID_RE.test(id))
    return Response.json(
      { error: "Missing or invalid id" },
      { status: 400 },
    );

  try {
    await deleteConversation(id, userId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Conversations DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
