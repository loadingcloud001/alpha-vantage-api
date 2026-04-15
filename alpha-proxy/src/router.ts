import { Router, Request, Response } from 'express';
import { SocksProxyAgent } from 'socks-proxy-agent';
import axios, { AxiosError } from 'axios';
import { checkRateLimit } from './rate-limit';
import { getAvailableKey, markKeyUsed } from './key-manager';
import { signalNewNYM } from './tor';
import { UPSTREAM_BASE, SUPPORTED_FUNCTIONS, AlphaKey } from './types';

const router = Router();

function getClientIP(req: Request): string {
  const xForwarded = req.headers['x-forwarded-for'];
  if (typeof xForwarded === 'string') {
    return xForwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/v1/query', async (req: Request, res: Response) => {
  const clientIP = getClientIP(req);

  // Rate limit check
  const rateLimit = checkRateLimit(clientIP);
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    res.status(429).json({ Error Message: 'Rate limit exceeded' });
    return;
  }

  // Validate function parameter
  const { function: func, symbol, interval, outputsize, apikey, ...extra } = req.query;

  if (!func || typeof func !== 'string') {
    res.status(400).json({ Error Message: 'Invalid function parameter' });
    return;
  }

  if (!SUPPORTED_FUNCTIONS.includes(func.toUpperCase())) {
    res.status(400).json({ Error Message: 'Invalid function parameter' });
    return;
  }

  // Get an available key
  let selectedKey: AlphaKey | null = null;
  try {
    selectedKey = getAvailableKey();
  } catch (err) {
    console.error('[router] Failed to load key pool:', err);
  }

  if (!selectedKey) {
    res.status(429).json({ Error Message: 'All API keys exhausted for today' });
    return;
  }

  // Rotate Tor circuit
  try {
    await signalNewNYM();
  } catch (err) {
    console.warn('[router] Tor circuit rotation failed (continuing anyway):', err);
  }

  // Build upstream URL
  const upstreamUrl = new URL(UPSTREAM_BASE);
  upstreamUrl.searchParams.set('function', func.toUpperCase());
  upstreamUrl.searchParams.set('apikey', selectedKey.key);
  if (symbol && typeof symbol === 'string') {
    upstreamUrl.searchParams.set('symbol', symbol);
  }
  if (interval && typeof interval === 'string') {
    upstreamUrl.searchParams.set('interval', interval);
  }
  if (outputsize && typeof outputsize === 'string') {
    upstreamUrl.searchParams.set('outputsize', outputsize);
  }
  // Forward any additional params
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v === 'string') {
      upstreamUrl.searchParams.set(k, v);
    }
  }

  // Proxy via Tor SOCKS
  const agent = new SocksProxyAgent('socks://127.0.0.1:9050');

  try {
    const response = await axios.get(upstreamUrl.toString(), {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 30000,
      responseType: 'json',
    });

    // Mark key as used
    markKeyUsed(selectedKey.key, null);

    // Return Alpha Vantage response as-is
    res.status(response.status).json(response.data);
  } catch (err) {
    const axiosError = err as AxiosError<any>;

    if (axiosError.response) {
      // Alpha Vantage responded — forward error JSON as-is
      res.status(axiosError.response.status).json(axiosError.response.data);
      return;
    }

    // Network-level failure
    console.error('[router] Upstream unavailable:', axiosError.message);
    res.status(502).json({ Error Message: 'Upstream unavailable' });
  }
});

export default router;
