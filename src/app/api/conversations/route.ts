import { auth } from "@clerk/nextjs/server";
import { upsertConversation, getLatestConversation } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversation = await getLatestConversation(userId);
    return Response.json({ conversation });
  } catch (error) {
    console.error("Conversations GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, messages } = body;
  if (typeof id !== "string" || !Array.isArray(messages)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await upsertConversation(id, userId, messages);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Conversations POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
