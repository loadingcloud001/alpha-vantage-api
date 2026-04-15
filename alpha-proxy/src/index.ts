import express from 'express';
import router from './router';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = express();

// Trust proxy for correct client IP detection behind reverse proxy / Docker
app.set('trust proxy', true);

app.use(router);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[alpha-proxy] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[alpha-proxy] Endpoints:`);
  console.log(`[alpha-proxy]   GET /health          — health check`);
  console.log(`[alpha-proxy]   GET /v1/query        — Alpha Vantage proxy`);
});

const shutdown = (signal: string) => {
  console.log(`[alpha-proxy] Received ${signal}, shutting down...`);
  server.close(() => {
    console.log('[alpha-proxy] Closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
