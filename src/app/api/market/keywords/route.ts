import { getAvailableKeywords, getKeywordCategories } from "@/lib/market-data";

export async function GET() {
  try {
    const [keywords, categories] = await Promise.all([
      getAvailableKeywords(),
      getKeywordCategories(),
    ]);

    return Response.json({ keywords, categories });
  } catch (error) {
    console.error("Keywords API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
