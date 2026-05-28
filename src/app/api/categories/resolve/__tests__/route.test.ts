import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/categories-data", () => ({
  resolveCategoryCode: vi.fn(),
}));

import { GET } from "../route";
import { resolveCategoryCode } from "@/lib/categories-data";

const mockResolve = vi.mocked(resolveCategoryCode);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/categories/resolve");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /api/categories/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when side missing", async () => {
    const res = await GET(makeRequest({ code: "foo" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/side/i);
  });

  it("returns 400 when side invalid", async () => {
    const res = await GET(makeRequest({ side: "invalid", code: "foo" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when code missing", async () => {
    const res = await GET(makeRequest({ side: "consumer" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/code/i);
  });

  it("returns 200 with status='active' on direct hit", async () => {
    mockResolve.mockResolvedValue({
      status: "active",
      side: "consumer",
      input_code: "home-and-kitchen",
      canonical_code: "home-and-kitchen",
      id: 31234,
      name: "Home & Kitchen",
      as_of: "2026-05-28T00:00:00Z",
    });

    const res = await GET(
      makeRequest({ side: "consumer", code: "home-and-kitchen" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.canonical_code).toBe("home-and-kitchen");
  });

  it("returns 200 with status='renamed' for aliased code", async () => {
    mockResolve.mockResolvedValue({
      status: "renamed",
      side: "consumer",
      input_code: "old-slug",
      canonical_code: "new-slug",
      id: 12345,
      name: "New Name",
      as_of: "2026-05-28T00:00:00Z",
    });

    const res = await GET(makeRequest({ side: "consumer", code: "old-slug" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("renamed");
    expect(body.canonical_code).toBe("new-slug");
  });

  it("returns 200 with status='removed' for inactive direct hit", async () => {
    mockResolve.mockResolvedValue({
      status: "removed",
      side: "consumer",
      input_code: "deprecated-slug",
      canonical_code: "deprecated-slug",
      id: 99999,
      name: "Deprecated Category",
      as_of: "2026-05-28T00:00:00Z",
    });

    const res = await GET(
      makeRequest({ side: "consumer", code: "deprecated-slug" }),
    );
    expect(res.status).toBe(200); // removed is a valid resolution, not HTTP 410
    const body = await res.json();
    expect(body.status).toBe("removed");
    expect(body.canonical_code).toBe("deprecated-slug");
    expect(body.id).toBe(99999);
  });

  it("returns 200 with status='not_found' when no match", async () => {
    mockResolve.mockResolvedValue({
      status: "not_found",
      side: "consumer",
      input_code: "ghost",
      canonical_code: null,
      as_of: "2026-05-28T00:00:00Z",
    });

    const res = await GET(makeRequest({ side: "consumer", code: "ghost" }));
    expect(res.status).toBe(200); // not_found is a valid resolution, not a HTTP 404
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.canonical_code).toBeNull();
  });

  it("supports side=seller", async () => {
    mockResolve.mockResolvedValue({
      status: "not_found",
      side: "seller",
      input_code: "tuxedo_suit",
      canonical_code: null,
      as_of: "2026-05-28T00:00:00Z",
    });

    await GET(makeRequest({ side: "seller", code: "tuxedo_suit" }));
    expect(mockResolve).toHaveBeenCalledWith("seller", "tuxedo_suit");
  });

  it("returns 500 on data layer error", async () => {
    mockResolve.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest({ side: "consumer", code: "x" }));
    expect(res.status).toBe(500);
  });
});
