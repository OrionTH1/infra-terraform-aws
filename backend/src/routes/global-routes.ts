import { type Express, Router } from 'express';
import { healthRoute } from './health.route';

export const globalRoutes = (app: Express) => {
  app.use("/api/v1",
    Router()
      .use("/health", healthRoute))
}
