# Alpha Vantage Express Proxy — Implementation Plan

**Date:** 2026-04-15
**Status:** Ready for deployment

---

## Overview

Deploy an **Express.js proxy** inside Docker on the do002 droplet (138.197.126.250) that exposes a `/v1/query` endpoint matching Alpha Vantage's API exactly. The proxy rotates through 200 Alpha Vantage API keys and routes requests through a **Tor SOCKS proxy** for IP rotation.

This gives ~5,000 requests/day (200 keys × 25 req/key/day) instead of the 25/day single-key limit.

---

## Architecture

```
Internet → Express Proxy (:3000, Docker)
              ↓
         Tor SOCKS Proxy (127.0.0.1:9050, host)
              ↓
         Alpha Vantage (alphavantage.co)
```

**Note:** Tor runs as a **system service on the host** (already configured), NOT inside the container.

---

## File Structure

```
loading-alphavantage/
├── alpha-proxy/                    # NEW: Express proxy service
│   ├── src/
│   │   ├── index.ts                # Express server entry point
│   │   ├── router.ts               # GET /v1/query handler
│   │   ├── tor.ts                  # Tor circuit rotation (pure JS, no stem)
│   │   ├── key-manager.ts          # Key selection + usage tracking
│   │   ├── rate-limit.ts           # Per-IP rate limiting (100/min)
│   │   └── types.ts                # Shared types + config constants
│   ├── Dockerfile                  # Multi-stage build (no Tor inside)
│   ├── docker-compose.yml          # Host network mode, volume mount for keys
│   ├── package.json
│   ├── tsconfig.json
│   ├── keys.json                   # Placeholder (200 keys injected at deploy)
│   └── .env.example
├── .github/workflows/
│   ├── ci.yml                      # Type check + build only
│   └── deploy-docker.yml           # Decrypt keys → Docker build → deploy
└── docs/
    └── IMPLEMENTATION_PLAN.md
```

---

## Key Design Decisions

### 1. Tor on Host, Not in Container
- **Rationale:** Simplifies container, avoids Tor complexity inside Docker
- **Trade-off:** Container must use `--network=host` to reach host Tor
- **Tor already running** on do002: SOCKS on 9050, Control on 9051

### 2. keys.json Mounted Read-Only via Volume
- **Rationale:** Keys must not be baked into Docker image
- **Path:** `/opt/loading-alphavantage/alpha-proxy/keys.json` mounted to `/app/keys.json:ro`
- **Injected at deploy time** from decrypted `.secrets/alpha-vantage-pool.age`

### 3. In-Memory Key Usage Tracking
- **Rationale:** Cannot write to read-only mounted keys.json in Docker
- **Trade-off:** Usage counts reset on container restart (rare, ~5000 req/day capacity)
- **Mitigation:** 200 keys × 25 = 5,000 req/day; probability of collision is low

### 4. Pure JavaScript Tor Control (No stem package)
- **Rationale:** The `stem` npm package is broken (requires deprecated `node-waf`)
- **Solution:** Custom implementation using Node.js built-in `net` module + Control Protocol

### 5. Random Key Selection (Not Round-Robin)
- **Rationale:** Avoids predictable patterns; equalizes usage across keys

---

## Deployment Workflow

1. Push to `main` branch (or trigger `workflow_dispatch`)
2. GitHub Actions:
   - Checkout code
   - Decrypt `.secrets/alpha-vantage-pool.age` → `keys.json`
   - SSH to do002 droplet
   - `rsync` alpha-proxy source + keys.json to `/opt/loading-alphavantage/alpha-proxy/`
   - `docker build -t alpha-vantage-proxy:latest .`
   - `docker stop alpha-proxy; docker rm alpha-proxy`
   - `docker run -d ... --network=host --volume keys.json ...`
3. Health check: `GET /health` → `{ status: "ok" }`
4. Functional test: `GET /v1/query?function=GLOBAL_QUOTE&symbol=IBM`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/query?function=FUNC&symbol=SYM&...` | Alpha Vantage proxy (78 functions) |

---

## Supported Functions (78 total)

**Alpha Intelligence (5):** EARNINGS_ESTIMATES, ETF_PROFILE, INSIDER_TRANSACTIONS, INSTITUTIONAL_HOLDINGS, NEWS_SENTIMENT

**Core Stock APIs (6):** MARKET_STATUS, GLOBAL_QUOTE, SYMBOL_SEARCH, TIME_SERIES_DAILY, TIME_SERIES_MONTHLY, TIME_SERIES_WEEKLY

**Economic Indicators (10):** CPI, DURABLES, FEDERAL_FUNDS_RATE, INFLATION, NONFARM_PAYROLL, REAL_GDP, REAL_GDP_PER_CAPITA, RETAIL_SALES, TREASURY_YIELD, UNEMPLOYMENT

**Fundamental Data (8):** BALANCE_SHEET, CASH_FLOW, DIVIDENDS, EARNINGS, INCOME_STATEMENT, OVERVIEW, SHARES_OUTSTANDING, SPLITS

**Index Data APIs (1):** INDEX_CATALOG

**Technical Indicators (48):** AD, ADOSC, ADX, ADXR, APO, AROON, AROONOSC, ATR, BBANDS, BOP, CCI, CMO, DEMA, DX, EMA, HT_DCPERIOD, HT_DCPHASE, HT_PHASOR, HT_SINE, HT_TRENDLINE, HT_TRENDMODE, KAMA, MACDEXT, MAMA, MFI, MIDPOINT, MIDPRICE, MINUS_DI, MOM, NATR, OBV, PLUS_DI, PPO, ROC, ROCR, RSI, SAR, SMA, STOCH, STOCHF, STOCHRSI, TEMA, TRANGE, TRIMA, TRIX, ULTOSC, WILLR, WMA

---

## Rate Limits

| Limit | Value | Scope |
|-------|-------|-------|
| Alpha Vantage | 25 req/key/day | Per API key (upstream) |
| Our Proxy | 100 req/min | Per client IP |

---

## Secrets Management

| Secret | Location | Purpose |
|--------|----------|---------|
| `alpha-vantage-pool.age` | `.secrets/` | 200 Alpha Vantage API keys |
| `SSH_PRIVATE_KEY` | GitHub repo secrets | Deploy access to do002 |
| `SSH_HOST` | GitHub repo secrets | Droplet IP address |
| `DEV_STANDARDS_AGE_KEY` | GitHub repo secrets | Decrypt age-encrypted secrets |

---

## Migration from PM2/Next.js

See [MIGRATION.md](./MIGRATION.md) for step-by-step instructions.

**Summary:**
1. Deploy Docker proxy to port 3000
2. Verify with health check + functional test
3. Stop/disable PM2 Next.js app
4. Optionally add nginx reverse proxy for HTTPS termination

---

## Troubleshooting

### "Authentication failed: Password did not match"
Tor Control authentication is using the hashed password directly. The hashed password `16:FE73C...` in `types.ts` must match the `HashedControlPassword` in `/etc/tor/torrc` on the host.

### Container can't reach Tor at 127.0.0.1:9050
- Verify Tor is running: `ssh do002 'ss -tlnp | grep 9050'`
- Ensure `--network=host` is set in docker run
- Tor must bind to 127.0.0.1, not 0.0.0.0 (for security)

### Curl returns 502 "Upstream unavailable"
- Check if Tor SOCKS proxy is working: `curl --socks5 127.0.0.1:9050 https://check.torproject.org`
- Check if Alpha Vantage is reachable from droplet: `curl https://www.alphavantage.co/query?function=MARKET_STATUS`
- Check container logs: `docker logs alpha-proxy`
