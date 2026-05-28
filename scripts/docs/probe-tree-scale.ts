/** Quick probe: how many active consumer_categories rows by depth? */
import { getDb } from "../../src/lib/db";

async function main() {
  const sql = getDb();
  const rows = await sql`
    SELECT depth, COUNT(*) as n
    FROM consumer_categories
    WHERE is_active = TRUE
    GROUP BY depth
    ORDER BY depth NULLS FIRST
  `;
  console.log("Active rows by depth:");
  for (const r of rows) console.log(`  depth=${r.depth ?? "null"}: ${r.n} nodes`);
  const total = await sql`SELECT COUNT(*) AS n FROM consumer_categories WHERE is_active = TRUE`;
  console.log(`Total active: ${total[0].n}`);
}
main().catch(console.error);
