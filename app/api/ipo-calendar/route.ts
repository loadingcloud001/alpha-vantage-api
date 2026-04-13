import { NextResponse } from "next/server";
import { fetchAlphaVantage } from "@/lib/alpha-vantage";

const config = {
  baseUrl: "https://www.alphavantage.co/query",
  apiKey: process.env.ALPHA_VANTAGE_IPO_KEY ?? "",
  functionName: "IPO_CALENDAR",
  requiredColumns: ["symbol", "ipoDate"],
};

if (!config.apiKey) {
  throw new Error("ALPHA_VANTAGE_IPO_KEY environment variable is not set");
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params: Record<string, string> = {};
  const symbol = searchParams.get("symbol");
  const horizon = searchParams.get("horizon");

  if (symbol) params.symbol = symbol;
  if (horizon) params.horizon = horizon;

  const result = await fetchAlphaVantage(config, params);

  if (result.error) {
    const errorHeaders = new Headers();
    errorHeaders.set("Access-Control-Allow-Origin", "*");
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status, headers: errorHeaders }
    );
  }

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");

  return NextResponse.json({ data: result.data }, { headers });
}