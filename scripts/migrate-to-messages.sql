-- Migration: Snapshot-style → Message-level storage with tree structure
-- Run this AFTER backing up the database.

-- Step 1: New conversations table (without JSONB messages blob)
CREATE TABLE IF NOT EXISTS conversations_v2 (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '新对话',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_v2_user_id ON conversations_v2(user_id);

-- Step 2: Messages table with tree structure
CREATE TABLE IF NOT EXISTS messages (
  id                  TEXT NOT NULL,
  conversation_id     TEXT NOT NULL REFERENCES conversations_v2(id) ON DELETE CASCADE,
  parent_message_id   TEXT,                          -- NULL = root; forms linked list / tree
  role                TEXT NOT NULL,                  -- 'user' | 'assistant' | 'system'
  parts               JSONB NOT NULL DEFAULT '[]',   -- AI SDK parts array
  status              TEXT NOT NULL DEFAULT 'complete', -- 'streaming' | 'complete' | 'error'
  ordinal             INTEGER NOT NULL,              -- position in current branch (0-based)
  is_active_child     BOOLEAN NOT NULL DEFAULT TRUE, -- active branch selection among siblings
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(conversation_id, parent_message_id);

-- Step 3: Migrate existing conversations
INSERT INTO conversations_v2 (id, user_id, title, created_at, updated_at)
SELECT
  id,
  user_id,
  COALESCE(messages->0->'parts'->0->>'text', '新对话'),
  created_at,
  updated_at
FROM conversations
ON CONFLICT (id) DO NOTHING;

-- Step 4: Explode JSONB messages array → individual rows
-- Each message points to the previous one via parent_message_id
INSERT INTO messages (id, conversation_id, parent_message_id, role, parts, status, ordinal, is_active_child, created_at)
SELECT
  msg->>'id',
  c.id,
  CASE WHEN ordinality = 1 THEN NULL
       ELSE lag(msg->>'id') OVER (PARTITION BY c.id ORDER BY ordinality)
  END,
  msg->>'role',
  COALESCE(msg->'parts', '[]'::jsonb),
  'complete',
  (ordinality - 1)::int,
  TRUE,
  c.created_at + (ordinality - 1) * interval '1 second'
FROM conversations c,
     jsonb_array_elements(c.messages) WITH ORDINALITY AS t(msg, ordinality)
ON CONFLICT DO NOTHING;

-- Step 5: After verifying migration, run these manually:
-- DROP TABLE conversations;
-- ALTER TABLE conversations_v2 RENAME TO conversations;
