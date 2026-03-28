import { describe, it, expect } from "vitest";
import { trimMessages } from "../context";

type Msg = { role: string; content: string };

function msg(role: string, n: number): Msg {
  return { role, content: `${role}-${n}` };
}

function makePairs(count: number): Msg[] {
  const msgs: Msg[] = [];
  for (let i = 1; i <= count; i++) {
    msgs.push(msg("user", i));
    msgs.push(msg("assistant", i));
  }
  return msgs;
}

describe("trimMessages", () => {
  it("returns all messages when under limit", () => {
    const msgs = makePairs(5); // 10 messages
    expect(trimMessages(msgs)).toEqual(msgs);
  });

  it("returns all messages at exact limit", () => {
    const msgs = makePairs(10); // 20 messages
    expect(trimMessages(msgs)).toEqual(msgs);
  });

  it("trims long conversations keeping first user + recent", () => {
    const msgs = makePairs(15); // 30 messages
    const result = trimMessages(msgs);

    // First message should be the first user message
    expect(result[0]).toEqual(msg("user", 1));

    // Last message should be the last assistant message
    expect(result[result.length - 1]).toEqual(msg("assistant", 15));

    // Should have first user + 20 recent = 21 messages
    expect(result.length).toBe(21);
  });

  it("does not duplicate first user msg if already in recent window", () => {
    const msgs = makePairs(10); // exactly at limit
    const result = trimMessages(msgs);
    const userOnes = result.filter(
      (m) => m.role === "user" && m.content === "user-1"
    );
    expect(userOnes.length).toBe(1);
  });

  it("handles empty array", () => {
    expect(trimMessages([])).toEqual([]);
  });

  it("handles single message", () => {
    const msgs = [msg("user", 1)];
    expect(trimMessages(msgs)).toEqual(msgs);
  });
});
