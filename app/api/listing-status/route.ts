import { NextResponse } from "next/server";
import { fetchAlphaVantage } from "@/lib/alpha-vantage";

const config = {
  baseUrl: "https://www.alphavantage.co/query",
  apiKey: process.env.ALPHA_VANTAGE_LISTING_KEY ?? "",
  functionName: "LISTING_STATUS",
  requiredColumns: ["symbol", "status"],
};

if (!config.apiKey) {
  throw new Error("ALPHA_VANTAGE_LISTING_KEY environment variable is not set");
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params: Record<string, string> = {};
  const date = searchParams.get("date");
  const state = searchParams.get("state");

  if (date) params.date = date;
  if (state) params.state = state;

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