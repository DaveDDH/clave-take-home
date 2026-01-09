import { executeQuery, executeWriteQuery } from "./index.js";

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  charts: unknown[] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new conversation and return its ID
 */
export async function createConversation(): Promise<string> {
  const result = await executeWriteQuery<{ id: string }>(
    "INSERT INTO conversations DEFAULT VALUES RETURNING id"
  );
  return result[0].id;
}

/**
 * Get all messages for a conversation, ordered by creation time
 */
export async function getConversationMessages(
  conversationId: string
): Promise<Message[]> {
  return executeQuery<Message>(
    `SELECT id, conversation_id, role, content, charts, created_at
     FROM messages
     WHERE conversation_id = '${conversationId}'
     ORDER BY created_at ASC`
  );
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  charts?: unknown[]
): Promise<string> {
  const result = await executeWriteQuery<{ id: string }>(
    `INSERT INTO messages (conversation_id, role, content, charts)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [conversationId, role, content, charts ? JSON.stringify(charts) : null]
  );

  // Update conversation's updated_at timestamp
  await executeWriteQuery(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  return result[0].id;
}

/**
 * Check if a conversation exists
 */
export async function conversationExists(conversationId: string): Promise<boolean> {
  const result = await executeQuery<{ count: string }>(
    `SELECT COUNT(*) as count FROM conversations WHERE id = '${conversationId}'`
  );
  return Number.parseInt(result[0].count) > 0;
}

export interface ConversationWithPreview {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  message_count: number;
}

/**
 * List all conversations with a preview of the first message
 */
export async function listConversations(): Promise<ConversationWithPreview[]> {
  return executeQuery<ConversationWithPreview>(`
    SELECT
      c.id,
      c.created_at,
      c.updated_at,
      (
        SELECT LEFT(content, 50)
        FROM messages
        WHERE conversation_id = c.id AND role = 'user'
        ORDER BY created_at ASC
        LIMIT 1
      ) as preview,
      (
        SELECT COUNT(*)
        FROM messages
        WHERE conversation_id = c.id
      )::int as message_count
    FROM conversations c
    WHERE EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id)
    ORDER BY c.updated_at DESC
    LIMIT 50
  `);
}
