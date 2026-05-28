import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/categories-data", () => ({
  getConsumerCategoryTree: vi.fn(),
}));

import { GET } from "../route";
import { getConsumerCategoryTree } from "@/lib/categories-data";

const mockTree = vi.mocked(getConsumerCategoryTree);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/categories/consumer/tree");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

const sampleNode = (id: number, code: string, name: string, children = []) => ({
  id_category: id,
  code,
  name,
  parent_code: null as string | null,
  depth: 1,
  is_leaf: children.length === 0,
  children,
});

describe("GET /api/categories/consumer/tree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with full tree by default", async () => {
    mockTree.mockResolvedValue({
      count: 2,
      depth_max: 1,
      tree: [
        sampleNode(31234, "home-and-kitchen", "Home & Kitchen"),
        sampleNode(31278, "electronics-and-mobiles", "Electronics & Mobiles"),
      ],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.tree).toHaveLength(2);
    expect(body.tree[0].code).toBe("home-and-kitchen");
  });

  it("sets Cache-Control header", async () => {
    mockTree.mockResolvedValue({ count: 0, depth_max: 0, tree: [] });
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });

  it("defaults active=true and leafOnly=false", async () => {
    mockTree.mockResolvedValue({ count: 0, depth_max: 0, tree: [] });
    await GET(makeRequest());
    expect(mockTree).toHaveBeenCalledWith({
      root: undefined,
      maxDepth: undefined,
      leafOnly: false,
      active: true,
    });
  });

  it("passes root + maxDepth through", async () => {
    mockTree.mockResolvedValue({ count: 0, depth_max: 0, tree: [] });
    await GET(makeRequest({ root: "home-and-kitchen", maxDepth: "2" }));
    expect(mockTree).toHaveBeenCalledWith({
      root: "home-and-kitchen",
      maxDepth: 2,
      leafOnly: false,
      active: true,
    });
  });

  it("converts leafOnly='true' to boolean true", async () => {
    mockTree.mockResolvedValue({ count: 0, depth_max: 0, tree: [] });
    await GET(makeRequest({ leafOnly: "true" }));
    expect(mockTree).toHaveBeenCalledWith(
      expect.objectContaining({ leafOnly: true }),
    );
  });

  it("returns 400 when maxDepth is not a positive integer", async () => {
    const res = await GET(makeRequest({ maxDepth: "abc" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maxDepth/i);
    expect(mockTree).not.toHaveBeenCalled();
  });

  it("returns 400 when maxDepth exceeds 10", async () => {
    const res = await GET(makeRequest({ maxDepth: "99" }));
    expect(res.status).toBe(400);
    expect(mockTree).not.toHaveBeenCalled();
  });

  it("returns 400 when active is not 'true'/'false'", async () => {
    const res = await GET(makeRequest({ active: "yes" }));
    expect(res.status).toBe(400);
    expect(mockTree).not.toHaveBeenCalled();
  });

  it("returns 500 on data layer error", async () => {
    mockTree.mockRejectedValue(new Error("DB connection lost"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
