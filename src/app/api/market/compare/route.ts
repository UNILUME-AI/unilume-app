import { getCrossMarketComparison } from "@/lib/market-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return Response.json(
      { error: "Missing required parameter: keyword" },
      { status: 400 }
    );
  }

  try {
    const data = await getCrossMarketComparison(keyword);
    return Response.json(data);
  } catch (error) {
    console.error("Cross-market comparison API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
