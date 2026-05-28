/**
 * POST /api/feedback
 *
 * AI 对话点赞 / 点踩反馈. Clerk auth 必填.
 * userQuery 截断到 5000 字符, assistantResponse 截断到 20000 字符.
 *
 * Schema: src/lib/api-schemas/chat.ts (FeedbackBodySchema).
 */

import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { FeedbackBodySchema } from "@/lib/api-schemas/chat";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = FeedbackBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") || "body";
    return Response.json(
      {
        error: `Invalid field '${field}': ${issue?.message ?? "validation failed"}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { rating, userQuery, assistantResponse } = parsed.data;

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
