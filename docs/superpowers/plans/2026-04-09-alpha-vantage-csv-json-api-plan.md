# Alpha Vantage CSV-to-JSON API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a public Vercel API with three endpoints that proxy Alpha Vantage CSV endpoints and return JSON.

**Architecture:** Next.js App Router project on Vercel. Three serverless route handlers (`/api/earnings-calendar`, `/api/listing-status`, `/api/ipo-calendar`) share two utility modules (`csv-parser.ts`, `alpha-vantage.ts`). Each route fetches CSV from Alpha Vantage, parses it via the shared parser, validates expected columns, and returns JSON.

**Tech Stack:** Next.js (App Router), TypeScript, `@upstash/ratelimit` for rate limiting, Vercel deployment via GitHub.

---

## File Structure

```
.
├── app/
│   ├── api/
│   │   ├── earnings-calendar/route.ts
│   │   ├── listing-status/route.ts
│   │   ├── ipo-calendar/route.ts
│   │   └── health/route.ts
│   └── layout.tsx
├── lib/
│   ├── csv-parser.ts
│   └── alpha-vantage.ts
├── .env.local
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── vercel.json (if needed)
```

---

## Task 1: Scaffolding — package.json, tsconfig, next.config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "alpha-vantage-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@upstash/ratelimit": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  runtime: "nodejs",
};

export default nextConfig;
```

- [ ] **Step 4: Commit**

```bash
git init
git add package.json tsconfig.json next.config.ts
git commit -m "chore: scaffold Next.js project"
```

---

## Task 2: Environment and gitignore

**Files:**
- Create: `.env.local`
- Create: `.gitignore`

- [ ] **Step 1: Write .env.local**

```env
ALPHA_VANTAGE_EARNINGS_KEY=3FBF35OG1KF0UO4E
ALPHA_VANTAGE_LISTING_KEY=AXIOKBQDDZG2W0H2
ALPHA_VANTAGE_IPO_KEY=CZPPCQBI9LSY0VLX
```

- [ ] **Step 2: Write .gitignore**

```
node_modules/
.next/
.env.local
.env*.local
```

- [ ] **Step 3: Commit**

```bash
git add .env.local .gitignore
git commit -m "chore: add env vars and gitignore"
```

---

## Task 3: lib/csv-parser.ts

**Files:**
- Create: `lib/csv-parser.ts`

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/csv-parser.ts
git commit -m "feat: add CSV parser utility"
```

---

## Task 4: lib/alpha-vantage.ts

**Files:**
- Create: `lib/alpha-vantage.ts`

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/alpha-vantage.ts
git commit -m "feat: add Alpha Vantage fetch utility"
```

---

## Task 5: app/api/health/route.ts

**Files:**
- Create: `app/api/health/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: add health check endpoint"
```

---

## Task 6: app/api/earnings-calendar/route.ts

**Files:**
- Create: `app/api/earnings-calendar/route.ts`

```ts
import { NextResponse } from "next/server";
import { fetchAlphaVantage, UpstreamConfig } from "@/lib/alpha-vantage";

const config: UpstreamConfig = {
  baseUrl: "https://www.alphavantage.co/query",
  apiKey: process.env.ALPHA_VANTAGE_EARNINGS_KEY ?? "",
  functionName: "EARNINGS_CALENDAR",
  requiredColumns: ["symbol", "reportDate"],
  defaultParams: { horizon: "3month" },
};

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
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status }
    );
  }

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");

  return NextResponse.json({ data: result.data }, { headers });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/earnings-calendar/route.ts
git commit -m "feat: add earnings-calendar endpoint"
```

---

## Task 7: app/api/listing-status/route.ts

**Files:**
- Create: `app/api/listing-status/route.ts`

```ts
import { NextResponse } from "next/server";
import { fetchAlphaVantage } from "@/lib/alpha-vantage";

const config = {
  baseUrl: "https://www.alphavantage.co/query",
  apiKey: process.env.ALPHA_VANTAGE_LISTING_KEY ?? "",
  functionName: "LISTING_STATUS",
  requiredColumns: ["symbol", "status"],
};

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
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status }
    );
  }

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");

  return NextResponse.json({ data: result.data }, { headers });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/listing-status/route.ts
git commit -m "feat: add listing-status endpoint"
```

---

## Task 8: app/api/ipo-calendar/route.ts

**Files:**
- Create: `app/api/ipo-calendar/route.ts`

```ts
import { NextResponse } from "next/server";
import { fetchAlphaVantage } from "@/lib/alpha-vantage";

const config = {
  baseUrl: "https://www.alphavantage.co/query",
  apiKey: process.env.ALPHA_VANTAGE_IPO_KEY ?? "",
  functionName: "IPO_CALENDAR",
  requiredColumns: ["symbol", "reportedDate"],
};

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
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status }
    );
  }

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");

  return NextResponse.json({ data: result.data }, { headers });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ipo-calendar/route.ts
git commit -m "feat: add ipo-calendar endpoint"
```

---

## Task 9: app/layout.tsx and app/page.tsx

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

```ts
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alpha Vantage CSV-to-JSON API",
  description: "Public API proxy for Alpha Vantage CSV endpoints",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Alpha Vantage CSV-to-JSON API</h1>
      <ul>
        <li><a href="/api/earnings-calendar">/api/earnings-calendar</a></li>
        <li><a href="/api/listing-status">/api/listing-status</a></li>
        <li><a href="/api/ipo-calendar">/api/ipo-calendar</a></li>
        <li><a href="/api/health">/api/health</a></li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add root layout and landing page"
```

---

## Task 10: GitHub repo and Vercel deployment

- [ ] **Step 1: Create GitHub repo**

Push to a new GitHub repo (instructions depend on user's GitHub setup — they need to create the repo first, then):
```bash
git remote add origin https://github.com/YOUR-USERNAME/alpha-vantage-api.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Connect to Vercel**

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import the GitHub repo `alpha-vantage-api`
3. In Vercel dashboard → Environment Variables, add:
   - `ALPHA_VANTAGE_EARNINGS_KEY` = `3FBF35OG1KF0UO4E`
   - `ALPHA_VANTAGE_LISTING_KEY` = `AXIOKBQDDZG2W0H2`
   - `ALPHA_VANTAGE_IPO_KEY` = `CZPPCQBI9LSY0VLX`
4. Deploy

- [ ] **Step 3: Verify deployment**

Visit:
- `https://YOUR-PROJECT.vercel.app/api/health`
- `https://YOUR-PROJECT.vercel.app/api/earnings-calendar?symbol=AAPL`
- `https://YOUR-PROJECT.vercel.app/api/listing-status`
- `https://YOUR-PROJECT.vercel.app/api/ipo-calendar`

Each should return JSON (or an error if Alpha Vantage rate limit is hit).