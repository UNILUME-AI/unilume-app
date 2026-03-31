import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

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

  const { rating, userQuery, assistantResponse } = body;

  if (rating !== "up" && rating !== "down") {
    return Response.json({ error: "Invalid rating" }, { status: 400 });
  }

  if (typeof userQuery !== "string" || typeof assistantResponse !== "string") {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const sql = getDb();
    await sql`
      INSERT INTO feedback (rating, user_query, assistant_response, user_id)
      VALUES (${rating}, ${userQuery.slice(0, 5000)}, ${assistantResponse.slice(0, 20000)}, ${userId})
    `;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
