export interface AlphaKey {
  key: string;
  used: number;
  lastIP: string | null;
}

export interface KeyPool {
  keys: AlphaKey[];
  lastUpdated: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface TorConfig {
  socksHost: string;
  socksPort: number;
  controlHost: string;
  controlPort: number;
  hashedPassword: string;
}

// Tor ControlPassword hash from /etc/tor/torrc on do002
export const TOR_CONFIG: TorConfig = {
  socksHost: '127.0.0.1',
  socksPort: 9050,
  controlHost: '127.0.0.1',
  controlPort: 9051,
  hashedPassword: '16:FE73C2AA84D821D1608FC9309CD462E786F0A49A4AC9D1DBDEE1BFADD0',
};

export const UPSTREAM_BASE = 'https://www.alphavantage.co/query';

export const MAX_REQUESTS_PER_KEY = 25; // Alpha Vantage: 25 req/day per key
export const RATE_LIMIT_REQUESTS = 100; // 100 req/min per IP (our own limit)
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// All 78 FREE endpoints from Alpha Vantage
export const SUPPORTED_FUNCTIONS = [
  // Alpha Intelligence
  'EARNINGS_ESTIMATES',
  'ETF_PROFILE',
  'INSIDER_TRANSACTIONS',
  'INSTITUTIONAL_HOLDINGS',
  'NEWS_SENTIMENT',
  // Core Stock APIs
  'MARKET_STATUS',
  'GLOBAL_QUOTE',
  'SYMBOL_SEARCH',
  'TIME_SERIES_DAILY',
  'TIME_SERIES_MONTHLY',
  'TIME_SERIES_WEEKLY',
  // Economic Indicators
  'CPI',
  'DURABLES',
  'FEDERAL_FUNDS_RATE',
  'INFLATION',
  'NONFARM_PAYROLL',
  'REAL_GDP',
  'REAL_GDP_PER_CAPITA',
  'RETAIL_SALES',
  'TREASURY_YIELD',
  'UNEMPLOYMENT',
  // Fundamental Data
  'BALANCE_SHEET',
  'CASH_FLOW',
  'DIVIDENDS',
  'EARNINGS',
  'INCOME_STATEMENT',
  'OVERVIEW',
  'SHARES_OUTSTANDING',
  'SPLITS',
  // Index Data APIs
  'INDEX_CATALOG',
  // Technical Indicators — all 48 indicators
  'AD',
  'ADOSC',
  'ADX',
  'ADXR',
  'APO',
  'AROON',
  'AROONOSC',
  'ATR',
  'BBANDS',
  'BOP',
  'CCI',
  'CMO',
  'DEMA',
  'DX',
  'EMA',
  'HT_DCPERIOD',
  'HT_DCPHASE',
  'HT_PHASOR',
  'HT_SINE',
  'HT_TRENDLINE',
  'HT_TRENDMODE',
  'KAMA',
  'MACDEXT',
  'MAMA',
  'MFI',
  'MIDPOINT',
  'MIDPRICE',
  'MINUS_DI',
  'MOM',
  'NATR',
  'OBV',
  'PLUS_DI',
  'PPO',
  'ROC',
  'ROCR',
  'RSI',
  'SAR',
  'SMA',
  'STOCH',
  'STOCHF',
  'STOCHRSI',
  'TEMA',
  'TRANGE',
  'TRIMA',
  'TRIX',
  'ULTOSC',
  'WILLR',
  'WMA',
];
