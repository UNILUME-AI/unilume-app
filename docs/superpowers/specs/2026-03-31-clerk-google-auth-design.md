# Clerk Google OAuth Integration Design

## Overview

Integrate Clerk with Google OAuth into the UNILUME chat app. Users can browse the interface freely but must log in (via Google) when they attempt to send a message. After login, chat history syncs to Neon Postgres.

## Authentication Flow

1. User visits `/` — sees full chat UI (welcome message, quick actions)
2. User clicks send or a quick action → front-end checks login status via `useUser()`
3. If not logged in:
   - Store the pending message text
   - Show a full-screen translucent overlay with Clerk `<SignIn />` (Google-only)
   - On successful login, close overlay and auto-send the stored message
4. If logged in → send message normally
5. Header right side: Clerk `<UserButton />` (avatar + dropdown menu); "New Chat" button moves to its left

## Front-end Changes

### `layout.tsx`

- Wrap `{children}` with `<ClerkProvider>`
- Configure Clerk to only enable Google as a social connection (done in Clerk Dashboard, not in code)

### `page.tsx`

Three modifications:

1. **Header**: Replace right side with `<UserButton />` + "New Chat" button
2. **Login overlay**: New `showSignIn` state; renders overlay with `<SignIn />` when triggered
3. **Send logic**: `send()` checks `useUser().isSignedIn`; if false, stores text and shows overlay

No new pages. No `/sign-in` or `/sign-up` routes.

## API Route Protection

### `/api/chat/route.ts`

- Call Clerk `auth()` at the top of the handler
- If no `userId` → return `401 { error: "Unauthorized" }`
- Pass `userId` through for future use (conversation persistence)

### `/api/feedback/route.ts`

- Same `auth()` check
- Associate feedback records with `userId`

### Front-end 401 fallback

- If a request returns 401, trigger the login overlay (safety net)

## Chat History Cloud Sync

### Database Schema (Neon Postgres)

```sql
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  messages    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
```

### Sync Strategy

- On each AI response completion (`status === "ready"`): upsert current conversation to DB
- On page load (logged-in user): load most recent conversation from DB (replaces localStorage)
- "New Chat" button: create a new conversation record; old ones remain in DB

### New API Routes

- `GET /api/conversations` — fetch current user's most recent conversation
- `POST /api/conversations` — save/update a conversation

### Scope Limitation

No conversation list UI or history browsing for now. Only the current conversation syncs. History sidebar can be added later.

## Dependencies to Add

- `@clerk/nextjs` — Clerk SDK for Next.js

## Environment Variables (via Clerk Marketplace integration)

- `CLERK_SECRET_KEY` (auto-provisioned)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (auto-provisioned)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/layout.tsx` | Modify — add ClerkProvider |
| `src/app/page.tsx` | Modify — add login overlay, UserButton, send logic |
| `src/app/api/chat/route.ts` | Modify — add auth() check |
| `src/app/api/feedback/route.ts` | Modify — add auth() check |
| `src/app/api/conversations/route.ts` | Create — GET/POST for conversation sync |
| `src/lib/db.ts` | Modify — add conversations table query helpers |
| SQL migration | Create conversations table |
