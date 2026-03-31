import { neon } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export async function upsertConversation(
  id: string,
  userId: string,
  messages: unknown[]
) {
  const sql = getDb();
  await sql`
    INSERT INTO conversations (id, user_id, messages, updated_at)
    VALUES (${id}, ${userId}, ${JSON.stringify(messages)}::jsonb, now())
    ON CONFLICT (id)
    DO UPDATE SET messages = ${JSON.stringify(messages)}::jsonb, updated_at = now()
  `;
}

export async function getLatestConversation(userId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, messages FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}
