export interface ParseResult {
  data: Record<string, string>[];
  error?: string;
  raw?: string;
}

export function csvToJson(csv: string): ParseResult {
  if (!csv || !csv.trim()) {
    return { data: [], error: "Empty CSV response", raw: csv };
  }

  const lines = csv.trim().split("\n");
  if (lines.length < 2) {
    return { data: [], error: "CSV has no data rows", raw: csv };
  }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const data = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });

  return { data };
}

export function validateColumns(
  data: Record<string, string>[],
  requiredColumns: string[]
): { valid: boolean; missing: string[] } {
  if (data.length === 0) {
    return { valid: false, missing: requiredColumns };
  }

  const firstRow = data[0];
  const missing = requiredColumns.filter((col) => !(col in firstRow));
  return { valid: missing.length === 0, missing };
}