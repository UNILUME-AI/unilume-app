import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock sql tagged-template function
const mockSql = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => mockSql,
}));

import { getCategoryMapping, getConsumerCategoryTree } from "../categories-data";

beforeEach(() => {
  mockSql.mockReset();
});

// ── getCategoryMapping: alias 链解析 ──────────────────

describe("getCategoryMapping alias resolution", () => {
  it("follows a single alias hop to active code", async () => {
    // hop 0: 直接查 old_code, 没找到 active 行
    mockSql.mockResolvedValueOnce([]);
    // hop 0: 查 alias, 找到 new_code
    mockSql.mockResolvedValueOnce([{ new_code: "new-code" }]);
    // hop 1: 查 new_code, 找到 active 行
    mockSql.mockResolvedValueOnce([{ id_category: 31234 }]);
    // 然后查 category_mappings
    mockSql.mockResolvedValueOnce([
      {
        seller_pk: 42,
        seller_code: "tuxedo_suit",
        tier: "high",
        confidence: 0.92,
        mapped_at: "2026-06-01T00:00:00Z",
      },
    ]);

    const result = await getCategoryMapping("old-code");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.seller_pk).toBe(42);
      expect(result.tier).toBe("high");
    }
  });

  it("detects cycles and returns no_confirmed_mapping (a→b→a)", async () => {
    // hop 0: 查 "a", 没找到 active
    mockSql.mockResolvedValueOnce([]);
    // hop 0: 查 alias old_code='a', 拿到 new_code='b'
    mockSql.mockResolvedValueOnce([{ new_code: "b" }]);
    // hop 1: 查 "b", 没找到 active
    mockSql.mockResolvedValueOnce([]);
    // hop 1: 查 alias old_code='b', 拿到 new_code='a' (循环)
    mockSql.mockResolvedValueOnce([{ new_code: "a" }]);
    // ← visited.has('a') 命中, 循环立即终止, 不会再查第三次

    const result = await getCategoryMapping("a");
    expect(result.status).toBe("no_confirmed_mapping");
    expect(result.consumer_code).toBe("a");
    // 4 次 SQL: 2x (lookup + alias). 循环检测阻止第 5/6 次.
    expect(mockSql).toHaveBeenCalledTimes(4);
  });

  it("stops at MAX_ALIAS_HOPS even without explicit cycle", async () => {
    // a → b → c → d → e, 每步都有 alias 但永远找不到 active 行
    // MAX_ALIAS_HOPS = 3 → 最多走 hop 0,1,2,3 共 4 轮, 每轮 2 次 SQL = 8 次
    for (let i = 0; i < 4; i++) {
      mockSql.mockResolvedValueOnce([]); // active lookup miss
      mockSql.mockResolvedValueOnce([{ new_code: `step${i + 1}` }]); // alias hop
    }

    const result = await getCategoryMapping("step0");
    expect(result.status).toBe("no_confirmed_mapping");
    expect(mockSql.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it("returns no_confirmed_mapping when code unknown and no alias", async () => {
    mockSql.mockResolvedValueOnce([]); // active lookup miss
    mockSql.mockResolvedValueOnce([]); // alias miss

    const result = await getCategoryMapping("ghost");
    expect(result.status).toBe("no_confirmed_mapping");
    expect(result.consumer_code).toBe("ghost");
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns no_confirmed_mapping when consumer exists but no mapping row", async () => {
    mockSql.mockResolvedValueOnce([{ id_category: 31234 }]); // active hit
    mockSql.mockResolvedValueOnce([]); // mapping miss (Phase 1 always-empty table)

    const result = await getCategoryMapping("home-and-kitchen");
    expect(result.status).toBe("no_confirmed_mapping");
  });
});

// ── getConsumerCategoryTree: 内存构树正确性 ─────

describe("getConsumerCategoryTree", () => {
  // 一个 3 层小样本: root1 -> child1 -> grandchild1
  //                  root2 (leaf)
  const sampleRows = [
    { id_category: 1, code: "root1", name: "Root 1", parent_code: null, depth: 1, is_leaf: false, is_active: true },
    { id_category: 2, code: "root2", name: "Root 2", parent_code: null, depth: 1, is_leaf: true, is_active: true },
    { id_category: 3, code: "root1/child1", name: "Child 1", parent_code: "root1", depth: 2, is_leaf: false, is_active: true },
    { id_category: 4, code: "root1/child1/gc1", name: "Grandchild 1", parent_code: "root1/child1", depth: 3, is_leaf: true, is_active: true },
  ];

  it("builds nested tree from flat rows", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, depth_max, tree } = await getConsumerCategoryTree();

    expect(count).toBe(4);
    expect(depth_max).toBe(3);
    expect(tree).toHaveLength(2); // 2 roots
    const root1 = tree.find((n) => n.code === "root1")!;
    expect(root1.children).toHaveLength(1);
    expect(root1.children[0].code).toBe("root1/child1");
    expect(root1.children[0].children[0].code).toBe("root1/child1/gc1");
    expect(root1.children[0].children[0].is_leaf).toBe(true);
  });

  it("root='root1' returns only that subtree", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, tree } = await getConsumerCategoryTree({ root: "root1" });

    expect(tree).toHaveLength(1);
    expect(tree[0].code).toBe("root1");
    expect(count).toBe(3); // root1 + child1 + gc1
  });

  it("root='nonexistent' returns empty tree", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, tree } = await getConsumerCategoryTree({ root: "ghost" });

    expect(tree).toHaveLength(0);
    expect(count).toBe(0);
  });

  it("maxDepth=1 prunes to root level only", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, tree } = await getConsumerCategoryTree({ maxDepth: 1 });

    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(0); // children pruned
    expect(tree[1].children).toHaveLength(0);
    expect(count).toBe(2);
  });

  it("maxDepth=2 keeps 2 levels", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, tree } = await getConsumerCategoryTree({ maxDepth: 2 });
    const root1 = tree.find((n) => n.code === "root1")!;
    expect(root1.children).toHaveLength(1); // child1 visible
    expect(root1.children[0].children).toHaveLength(0); // grandchild pruned
    expect(count).toBe(3);
  });

  it("leafOnly=true returns flat leaf array (no children)", async () => {
    mockSql.mockResolvedValueOnce(sampleRows);
    const { count, tree } = await getConsumerCategoryTree({ leafOnly: true });
    // is_leaf=true rows: root2 + gc1
    expect(tree).toHaveLength(2);
    expect(tree.every((n) => n.is_leaf === true)).toBe(true);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
    expect(count).toBe(2);
  });

  it("orphan rows (parent missing from result set) are promoted to roots", async () => {
    // 模拟: parent (root1) 不在结果集 (例如被 active=false 过滤掉)
    const rowsMinusParent = sampleRows.filter((r) => r.code !== "root1");
    mockSql.mockResolvedValueOnce(rowsMinusParent);
    const { tree } = await getConsumerCategoryTree();
    // root2, root1/child1 都成了 root (child1 因为找不到 parent 也成了 orphan-root)
    const codes = tree.map((n) => n.code).sort();
    expect(codes).toContain("root1/child1");
    expect(codes).toContain("root2");
  });
});
