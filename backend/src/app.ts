import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { globalRoutes } from './routes/global-routes';
import { logger } from './logger';

const app: Express = express();
const SERVER_PORT = process.env.SERVER_PORT ?? 8080;

app.use(
  pinoHttp({
    logger,
    // The ALB health-checks /api/v1/health every 15s per target. Logging those at
    // info level would bury real traffic and inflate CloudWatch Logs ingestion for
    // no benefit, so they drop to debug unless something actually went wrong.
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      if (_req.url?.startsWith('/api/v1/health')) return 'debug';
      return 'info';
    },
    // Renamed so the field name states its unit — the saved Logs Insights query
    // (infra/modules/observability/logs.tf) sorts on responseTimeMs.
    customAttributeKeys: { responseTime: 'responseTimeMs' },
  })
);

globalRoutes(app);

app.listen(SERVER_PORT, () => {
  logger.info({ port: SERVER_PORT }, 'Server started');
});
