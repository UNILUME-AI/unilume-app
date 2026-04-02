import { getPriceTrend } from "@/lib/market-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");
  const daysParam = searchParams.get("days");

  if (!keyword) {
    return Response.json(
      { error: "Missing required parameter: keyword" },
      { status: 400 }
    );
  }

  let days = 7;
  if (daysParam) {
    days = Math.min(Math.max(1, parseInt(daysParam, 10) || 7), 90);
  }

  try {
    const data = await getPriceTrend(keyword, days);
    return Response.json(data);
  } catch (error) {
    console.error("Price trend API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
