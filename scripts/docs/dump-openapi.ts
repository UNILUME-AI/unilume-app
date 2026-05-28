/**
 * Dump generated OpenAPI spec to stdout (for sanity-check / CI diff).
 *
 * Usage: npx tsx scripts/docs/dump-openapi.ts
 */
import { generateOpenApiSpec } from "../../src/lib/api-schemas/registry";
console.log(JSON.stringify(generateOpenApiSpec(), null, 2));
