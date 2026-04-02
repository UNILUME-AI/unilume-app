import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth to avoid server-only module errors
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-user-id" }),
}));

// Mock the database module
vi.mock("@/lib/db", () => ({
  getDb: () => {
    const sql = vi.fn().mockResolvedValue([]);
    // neon returns a tagged template function
    return sql;
  },
}));

// Import after mocking
const { POST } = await import("../route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 for invalid rating", async () => {
    const res = await POST(
      makeRequest({ rating: "maybe", userQuery: "test", assistantResponse: "test" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid rating");
  });

  it("returns 400 for missing fields", async () => {
    const res = await POST(
      makeRequest({ rating: "up" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing fields");
  });

  it("returns 400 when userQuery is not a string", async () => {
    const res = await POST(
      makeRequest({ rating: "up", userQuery: 123, assistantResponse: "test" })
    );
    expect(res.status).toBe(400);
  });

  it("accepts valid 'up' feedback", async () => {
    const res = await POST(
      makeRequest({
        rating: "up",
        userQuery: "What are FBN fees?",
        assistantResponse: "FBN fees are...",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("accepts valid 'down' feedback", async () => {
    const res = await POST(
      makeRequest({
        rating: "down",
        userQuery: "How much commission?",
        assistantResponse: "Commission rates vary...",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
