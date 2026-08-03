import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { globalRoutes } from './routes/global-routes';
import { logger } from './logger';

const app: Express = express();
const SERVER_PORT = process.env.SERVER_PORT ?? 8080;

app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      if (_req.url?.startsWith('/api/v1/health')) return 'debug';
      return 'info';
    },
    customAttributeKeys: { responseTime: 'responseTimeMs' },
  })
);

globalRoutes(app);

app.listen(SERVER_PORT, () => {
  logger.info({ port: SERVER_PORT }, 'Server started');
});
