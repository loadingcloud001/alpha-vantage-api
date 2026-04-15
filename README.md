# Alpha Vantage API Explorer

Next.js app for exploring the [Alpha Vantage](https://www.alphavantage.co/) financial data API.

## Tech Stack

- **Next.js 15** — React framework
- **TypeScript** — Type safety
- **@upstash/ratelimit** — API rate limiting

## Setup

```bash
npm install
```

## Environment Variables

Create `.env.local`:

```env
ALPHA_VANTAGE_API_KEY=your_api_key
```

Get a free API key at [alphavantage.co](https://www.alphavantage.co/support/#api-key).

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## API

This app proxies Alpha Vantage API calls server-side to protect the API key.

### Endpoints

| Function | Description |
|---------|-------------|
| `TIME_SERIES_INTRADAY` | Intraday time series |
| `TIME_SERIES_DAILY` | Daily time series |
| `GLOBAL_QUOTE` | Stock quote |
| `SYMBOL_SEARCH` | Search symbols |

## Deployment

Deployed via GitHub Actions to a DigitalOcean droplet.
