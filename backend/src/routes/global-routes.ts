import { type Express, Router } from 'express';
import { healthRoute } from './health.route';

export const globalRoutes = (app: Express) => {
  app.use("/v1/api",
    Router()
      .use("/health", healthRoute))
}
