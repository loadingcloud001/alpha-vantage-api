# Alpha Vantage CSV-to-JSON API — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Overview

A public serverless API deployed on Vercel (Next.js) that proxies three Alpha Vantage endpoints, fetches their CSV output, parses it to JSON, and returns it. Acts as a CSV-to-JSON converter for public consumption.

---

## Endpoints

| Route | Alpha Vantage Function | Purpose |
|-------|----------------------|---------|
| `GET /api/earnings-calendar` | `EARNINGS_CALENDAR` | Upcoming earnings dates |
| `GET /api/listing-status` | `LISTING_STATUS` | Stock listing/delisting status |
| `GET /api/ipo-calendar` | `IPO_CALENDAR` | Upcoming IPOs |

Each endpoint also has a `GET /api/health` route for health checks.

---

## Architecture

```
app/
  api/
    earnings-calendar/route.ts
    listing-status/route.ts
    ipo-calendar/route.ts
    health/route.ts
lib/
  csv-parser.ts          # Shared CSV → JSON converter
  alpha-vantage.ts       # Shared upstream fetch + error handling
.env.local
vercel.json
```

**Shared modules:**
- `lib/csv-parser.ts` — parses CSV string to JSON array, handles headers
- `lib/alpha-vantage.ts` — builds upstream URL, fetches, returns parsed data or error

---

## Behavior

### Query Parameter Handling

Each route passes through relevant query params to Alpha Vantage:

- **EARNINGS_CALENDAR:** `symbol` (optional), `horizon` (optional, default `3month`)
- **LISTING_STATUS:** `date` (optional), `state` (optional)
- **IPO_CALENDAR:** `symbol` (optional), `horizon` (optional)

Unknown params are ignored. Alpha Vantage key is always sent via the shared module.

### CSV Parsing

- Split on newlines, first line = headers
- Map each subsequent line to an object using header positions
- Trim whitespace from keys and values
- Return `Record<string, string>[]`

### Validation

Each route checks for expected columns before returning:
- `EARNINGS_CALENDAR`: must contain `symbol` and `reportDate`
- `LISTING_STATUS`: must contain `symbol` and `status`
- `IPO_CALENDAR`: must contain `symbol` and `reportedDate`

If validation fails, return `{ error: "...", raw: "..." }` with status 500.

### Error Responses

- **Upstream failure:** `{ error: "Upstream request failed", detail: string }` + status 502
- **Empty response:** `{ error: "Empty response from Alpha Vantage" }` + status 502
- **Malformed CSV (missing columns):** `{ error: "...", raw: "..." }` + status 500
- **Rate limited:** `{ error: "Rate limit exceeded" }` + status 429

### CORS

All routes set `Access-Control-Allow-Origin: *` headers to support cross-origin public access.

### Rate Limiting

Use `@upstash/ratelimit` with a simple fixed window:
- 30 requests per minute per IP for all `/api/` routes
- Return 429 with `{ error: "Rate limit exceeded" }` when exceeded

---

## Environment Variables

- `ALPHA_VANTAGE_API_KEY` — API key for Alpha Vantage (set in Vercel dashboard, not hardcoded)

Local development uses `.env.local` with the same variable name.

---

## Deployment

- Framework: Next.js (App Router)
- Runtime: Node.js (serverless)
- Platform: Vercel
- Connect via GitHub repo for automatic deployments on push

---

## Alpha Vantage API Keys (current)

The project uses three keys — one per endpoint:

| Endpoint | Key |
|----------|-----|
| EARNINGS_CALENDAR | `3FBF35OG1KF0UO4E` |
| LISTING_STATUS | `AXIOKBQDDZG2W0H2` |
| IPO_CALENDAR | `CZPPCQBI9LSY0VLX` |

These are stored as separate env vars per route to limit scope: `ALPHA_VANTAGE_EARNINGS_KEY`, `ALPHA_VANTAGE_LISTING_KEY`, `ALPHA_VANTAGE_IPO_KEY`.