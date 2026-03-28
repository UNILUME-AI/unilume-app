/**
 * Trim conversation history to stay within context budget.
 *
 * Strategy: keep the first user message (sets the topic) + the most recent
 * MAX_RECENT_PAIRS user-assistant pairs. This drops middle messages that
 * are least relevant to the current turn.
 */

const MAX_RECENT_PAIRS = 10; // 10 pairs = 20 messages max

export function trimMessages<T extends { role: string }>(messages: T[]): T[] {
  if (messages.length <= MAX_RECENT_PAIRS * 2) {
    return messages;
  }

  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  const firstUserMsg = firstUserIdx >= 0 ? [messages[firstUserIdx]] : [];

  // Take the most recent messages
  const recent = messages.slice(-MAX_RECENT_PAIRS * 2);

  // Avoid duplicating the first message if it's already in the recent window
  if (
    firstUserMsg.length > 0 &&
    recent.length > 0 &&
    recent[0] !== firstUserMsg[0]
  ) {
    return [...firstUserMsg, ...recent];
  }

  return recent;
}
