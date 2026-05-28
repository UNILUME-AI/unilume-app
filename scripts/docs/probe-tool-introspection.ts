/**
 * 探针: 验证从 src/lib/tools.ts 能自动提取多少 tool 元信息.
 * 不写最终生成器, 只回答 "能拿到啥, 缺啥".
 */
import { z } from "zod";
import { policyTools, marketTools, categoryTools } from "../../src/lib/tools";

const all = { ...policyTools, ...marketTools, ...categoryTools };

console.log(`Found ${Object.keys(all).length} tools:\n`);

for (const [name, t] of Object.entries(all)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = t as any;
  console.log(`── ${name} ──`);
  console.log("  description:", tool.description?.slice(0, 80) + "...");
  console.log("  inputSchema type:", tool.inputSchema?.constructor?.name);

  // 提取 JSON Schema (z.toJSONSchema 同 OpenAPI 那套)
  if (tool.inputSchema) {
    try {
      const json = z.toJSONSchema(tool.inputSchema);
      const props = (json as { properties?: Record<string, unknown> }).properties || {};
      console.log("  params:", Object.keys(props).join(", ") || "(none)");
    } catch (e) {
      console.log("  toJSONSchema failed:", (e as Error).message);
    }
  }
  console.log("  has execute:", typeof tool.execute === "function");
  console.log();
}
