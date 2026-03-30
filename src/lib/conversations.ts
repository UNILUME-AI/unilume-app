import { getDb } from "./db";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: unknown[];
  createdAt: string;
  updatedAt: string;
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, title, updated_at
    FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    updatedAt: r.updated_at as string,
  }));
}

export async function getConversation(
  userId: string,
  conversationId: string
): Promise<Conversation | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, user_id, title, messages, created_at, updated_at
    FROM conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    messages: r.messages as unknown[],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function saveConversation(
  userId: string,
  conversationId: string,
  title: string,
  messages: unknown[]
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO conversations (id, user_id, title, messages, updated_at)
    VALUES (${conversationId}, ${userId}, ${title}, ${JSON.stringify(messages)}, now())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      messages = EXCLUDED.messages,
      updated_at = now()
  `;
}

export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}
