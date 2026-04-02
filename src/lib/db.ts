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

export async function listConversations(userId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT id,
      COALESCE(
        messages->0->'parts'->0->>'text',
        '新对话'
      ) as label,
      updated_at
    FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function getConversation(id: string, userId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, messages FROM conversations
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function deleteConversation(id: string, userId: string) {
  const sql = getDb();
  await sql`
    DELETE FROM conversations
    WHERE id = ${id} AND user_id = ${userId}
  `;
}
