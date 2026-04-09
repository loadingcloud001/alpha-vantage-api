# Alpha Vantage Compatible Proxy API — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Overview

A public API deployed on a DigitalOcean VPS (Ubuntu 22.04 LTS) that acts as a **drop-in replacement for Alpha Vantage**. It accepts the same URL structure, rotates API keys + Tor exit IPs, and forwards requests to Alpha Vantage — returning the same JSON responses.

Alpha Vantage enforces **25 requests/day per API key per source IP**. With 100 keys and Tor-based IP rotation, the effective limit becomes 100 × 25 = **2,500 requests/day**.

---

## Architecture

```
Internet → Your API (Express on VPS:3000)
              ↓
         Tor SOCKS Proxy (127.0.0.1:9050)
              ↓
         Alpha Vantage (alphavantage.co)
```

**Single VPS:** Ubuntu 22.04 LTS on DigitalOcean, with Tor installed and configured as a SOCKS proxy.

---

## API Interface

### Endpoint

```
GET /v1/query?function=FUNCTION&symbol=SYM&apikey=YOUR_KEY&...
```

This mirrors Alpha Vantage exactly — consumers can replace `https://www.alphavantage.co/query` with your VPS IP/domain and it works.

### Supported Functions

| Function | Description |
|----------|-------------|
| `GLOBAL_QUOTE` | Stock quote |
| `TIME_SERIES_INTRADAY` | Intraday time series |
| `SYMBOL_SEARCH` | Symbol search |
| `EARNINGS_CALENDAR` | Upcoming earnings |
| `LISTING_STATUS` | Listing/delisting status |
| `IPO_CALENDAR` | Upcoming IPOs |

### Request Flow

1. Consumer calls `GET /v1/query?function=GLOBAL_QUOTE&symbol=AAPL`
2. Your API picks an available API key (round-robin or random, skipping exhausted keys)
3. Your API signals Tor to rotate circuit (`signal NEWNYM`)
4. Your API forwards request to Alpha Vantage via Tor SOCKS proxy
5. Alpha Vantage responds → your API returns JSON (unchanged)

### Response

Same JSON as Alpha Vantage (passthrough). If Alpha Vantage returns an error JSON, that error JSON is returned as-is.

### Rate Limiting (你自己的 API)

To protect your infrastructure: **100 requests/minute per IP** via a simple in-memory rate limiter.

### Error Handling

| Situation | Behavior |
|-----------|----------|
| All API keys exhausted | `{ "Error Message": "All API keys exhausted for today" }` + 429 |
| Alpha Vantage returns error | Forward error JSON as-is |
| Alpha Vantage unreachable | `{ "Error Message": "Upstream unavailable" }` + 502 |
| Invalid function param | `{ "Error Message": "Invalid function parameter" }` + 400 |

---

## Key + IP Rotation

### Key Storage

100 API keys stored in a JSON file: `keys.json`

```json
[
  { "key": "CZPPCQBI9LSY0VLX", "used": 0, "lastIP": null },
  { "key": "UPZ0OYBPJFM6LXIK", "used": 0, "lastIP": null },
  ...
]
```

- `used`: number of requests made today (reset at midnight UTC)
- `lastIP`: last Tor exit IP used with this key (for tracing if needed)

### Rotation Strategy

1. On each request, find keys where `used < 25`
2. Pick one randomly (not round-robin — avoids predictable patterns)
3. Send `SIGNAL NEWNYM` to Tor controller to rotate exit IP
4. Mark the key as used (+1)
5. If no keys available, return 429

### Tor Setup

- **Tor daemon** running as system service (`tor` package)
- **Tor controller** via `tor-ctrl` or `stem` Python library
- SOCKS proxy on `127.0.0.1:9050`
- Control port on `127.0.0.1:9051`

---

## Deployment

- **Platform:** DigitalOcean VPS (Ubuntu 22.04 LTS)
- **Server:** Express.js (Node.js) on port 3000
- **Domain:** None needed initially — just VPS IP: `http://YOUR_DROPLET_IP:3000`
- **Process manager:** PM2 (to keep server alive)
- **Firewall:** ufw allowing port 3000 only (or restrict to your consumer IPs)

---

## File Structure

```
/opt/alpha-proxy/
├── keys.json          # 100 API keys
├── src/
│   ├── index.ts      # Express server entry point
│   ├── router.ts     # /v1/query route handler
│   ├── tor.ts        # Tor SOCKS connection + circuit rotation
│   ├── key-manager.ts # Key selection + tracking
│   └── rate-limit.ts  # Per-IP rate limiting
├── package.json
├── tsconfig.json
└── torrc             # Tor configuration
```

---

## Security Notes

- The `keys.json` file is stored on the VPS only — not in git or public repos
- Rate limiting on your API prevents abuse from consumers
- Alpha Vantage keys are only sent through Tor — no direct IP association