import { getProductList } from "@/lib/market-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");
  const market = searchParams.get("market") ?? "UAE";
  const sortBy = searchParams.get("sortBy") ?? "position";
  const limitParam = searchParams.get("limit");

  if (!keyword) {
    return Response.json(
      { error: "Missing required parameter: keyword" },
      { status: 400 }
    );
  }

  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 100)
    : 20;

  try {
    const products = await getProductList(keyword, market, sortBy, limit);

    return Response.json({
      keyword,
      market,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Product list API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
