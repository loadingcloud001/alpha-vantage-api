import { csvToJson, validateColumns } from "./csv-parser";

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
  functionName: string;
  requiredColumns: string[];
  defaultParams?: Record<string, string>;
}

export interface ApiResponse {
  data?: Record<string, string>[];
  error?: string;
  detail?: string;
  raw?: string;
  status: number;
}

export function buildAlphaVantageUrl(
  config: UpstreamConfig,
  params: Record<string, string>
): string {
  const url = new URL(config.baseUrl);
  url.searchParams.set("function", config.functionName);
  url.searchParams.set("apikey", config.apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(config.defaultParams ?? {})) {
    if (!params[key]) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function fetchAlphaVantage(
  config: UpstreamConfig,
  params: Record<string, string>
): Promise<ApiResponse> {
  const url = buildAlphaVantageUrl(config, params);

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    return {
      error: "Upstream request failed",
      detail: err instanceof Error ? err.message : String(err),
      status: 502,
    };
  }

  const csv = await res.text();

  if (!csv || !csv.includes("symbol")) {
    return {
      error: "Unexpected response from Alpha Vantage",
      raw: csv.slice(0, 500),
      status: 500,
    };
  }

  const { data, error: parseError } = csvToJson(csv);

  if (parseError) {
    return { error: parseError, raw: csv.slice(0, 500), status: 500 };
  }

  const { valid, missing } = validateColumns(data, config.requiredColumns);
  if (!valid) {
    return {
      error: `Missing required columns: ${missing.join(", ")}`,
      raw: csv.slice(0, 500),
      status: 500,
    };
  }

  return { data, status: 200 };
}