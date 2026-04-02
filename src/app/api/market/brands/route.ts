import { getBrandDistribution } from "@/lib/market-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");
  const market = searchParams.get("market") ?? "UAE";

  if (!keyword) {
    return Response.json(
      { error: "Missing required parameter: keyword" },
      { status: 400 }
    );
  }

  try {
    const data = await getBrandDistribution(keyword, market);

    if (!data) {
      return Response.json(
        { error: `No data found for keyword "${keyword}" in ${market}` },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error("Brand distribution API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
