import { neon } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

/* ─── Conversation-level ─── */

/** Create conversation row if it doesn't exist yet. */
export async function ensureConversation(
  id: string,
  userId: string,
  title?: string,
) {
  const sql = getDb();
  await sql`
    INSERT INTO conversations (id, user_id, title)
    VALUES (${id}, ${userId}, ${title ?? "新对话"})
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Update conversation title (typically after first user message). */
export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string,
) {
  const sql = getDb();
  await sql`
    UPDATE conversations SET title = ${title}, updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

/** List conversations for sidebar (most recent first, max 50). */
export async function listConversations(userId: string) {
  const sql = getDb();
  return sql`
    SELECT id, title AS label, updated_at
    FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 50
  `;
}

/** Delete a conversation (CASCADE deletes its messages). */
export async function deleteConversation(id: string, userId: string) {
  const sql = getDb();
  await sql`
    DELETE FROM conversations
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

/* ─── Message-level ─── */

export interface DbMessage {
  id: string;
  parentMessageId: string | null;
  role: string;
  parts: unknown[];
  status: string;
  ordinal: number;
  isActiveChild: boolean;
}

/** Append a single message. */
export async function appendMessage(
  conversationId: string,
  msg: {
    id: string;
    parentMessageId: string | null;
    role: string;
    parts: unknown[];
    status?: string;
    ordinal: number;
  },
) {
  const sql = getDb();
  await sql`
    INSERT INTO messages (id, conversation_id, parent_message_id, role, parts, status, ordinal)
    VALUES (
      ${msg.id},
      ${conversationId},
      ${msg.parentMessageId},
      ${msg.role},
      ${JSON.stringify(msg.parts)}::jsonb,
      ${msg.status ?? "complete"},
      ${msg.ordinal}
    )
    ON CONFLICT (id, conversation_id) DO NOTHING
  `;
  // Touch conversation updated_at
  await sql`
    UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}
  `;
}

/** Update streaming message parts (called periodically during streaming). */
export async function updateMessageParts(
  messageId: string,
  conversationId: string,
  parts: unknown[],
) {
  const sql = getDb();
  await sql`
    UPDATE messages
    SET parts = ${JSON.stringify(parts)}::jsonb, updated_at = now()
    WHERE id = ${messageId} AND conversation_id = ${conversationId}
  `;
}

/** Finalize a streaming message (mark complete + final parts update). */
export async function finalizeMessage(
  messageId: string,
  conversationId: string,
  parts: unknown[],
) {
  const sql = getDb();
  await sql`
    UPDATE messages
    SET parts = ${JSON.stringify(parts)}::jsonb, status = 'complete', updated_at = now()
    WHERE id = ${messageId} AND conversation_id = ${conversationId}
  `;
  await sql`
    UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}
  `;
}

/** Load active-branch messages for a conversation (ordered). */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
) {
  const sql = getDb();
  // Verify ownership
  const convRows = await sql`
    SELECT id, title FROM conversations
    WHERE id = ${conversationId} AND user_id = ${userId}
  `;
  if (convRows.length === 0) return null;

  const msgRows = await sql`
    SELECT id, parent_message_id, role, parts, status, ordinal, is_active_child
    FROM messages
    WHERE conversation_id = ${conversationId} AND is_active_child = TRUE
    ORDER BY ordinal ASC
  `;

  return {
    id: convRows[0].id,
    title: convRows[0].title,
    messages: msgRows.map((r) => ({
      id: r.id,
      parentMessageId: r.parent_message_id,
      role: r.role,
      parts: r.parts,
      status: r.status,
      ordinal: r.ordinal,
    })),
  };
}

/** Clean up interrupted streaming messages (mark as error). */
export async function cleanupStreamingMessages(conversationId: string) {
  const sql = getDb();
  await sql`
    UPDATE messages SET status = 'error'
    WHERE conversation_id = ${conversationId} AND status = 'streaming'
  `;
}

/* ─── Branching ─── */

/** Deactivate all siblings at a branch point, preparing for a new active child. */
export async function deactivateSiblings(
  conversationId: string,
  parentMessageId: string | null,
) {
  const sql = getDb();
  if (parentMessageId === null) {
    await sql`
      UPDATE messages SET is_active_child = FALSE
      WHERE conversation_id = ${conversationId} AND parent_message_id IS NULL
    `;
  } else {
    await sql`
      UPDATE messages SET is_active_child = FALSE
      WHERE conversation_id = ${conversationId} AND parent_message_id = ${parentMessageId}
    `;
  }
}

/**
 * Deactivate all descendants of a message (the sub-tree below a branch point).
 * This is needed when the user edits a message mid-conversation — all messages
 * after it in the old branch become inactive.
 */
export async function deactivateDescendants(
  conversationId: string,
  afterOrdinal: number,
) {
  const sql = getDb();
  await sql`
    UPDATE messages SET is_active_child = FALSE
    WHERE conversation_id = ${conversationId}
      AND is_active_child = TRUE
      AND ordinal > ${afterOrdinal}
  `;
}

/** Get all sibling messages at a branch point (for branch navigator UI). */
export async function getMessageSiblings(
  conversationId: string,
  parentMessageId: string | null,
) {
  const sql = getDb();
  if (parentMessageId === null) {
    return sql`
      SELECT id, role, parts, status, ordinal, is_active_child, created_at
      FROM messages
      WHERE conversation_id = ${conversationId} AND parent_message_id IS NULL
      ORDER BY created_at ASC
    `;
  }
  return sql`
    SELECT id, role, parts, status, ordinal, is_active_child, created_at
    FROM messages
    WHERE conversation_id = ${conversationId} AND parent_message_id = ${parentMessageId}
    ORDER BY created_at ASC
  `;
}

/** Switch active branch: activate a specific sibling and deactivate the rest, then reload. */
export async function switchBranch(
  conversationId: string,
  parentMessageId: string | null,
  activeMessageId: string,
) {
  const sql = getDb();
  // Deactivate all siblings
  await deactivateSiblings(conversationId, parentMessageId);
  // Activate the chosen one
  await sql`
    UPDATE messages SET is_active_child = TRUE
    WHERE id = ${activeMessageId} AND conversation_id = ${conversationId}
  `;
}
