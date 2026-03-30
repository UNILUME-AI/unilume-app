import { auth } from "@/lib/auth";
import { listConversations, saveConversation } from "@/lib/conversations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(session.user.id);
  return Response.json(conversations);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, title, messages } = body;
  if (typeof id !== "string" || typeof title !== "string" || !Array.isArray(messages)) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  await saveConversation(session.user.id, id, title, messages);
  return Response.json({ ok: true });
}
