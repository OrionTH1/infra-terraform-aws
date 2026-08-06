import { Router, type Request, type Response } from 'express';
import { readQuery, writerPool } from '../db/pool';
import { logger } from '../logger';

export const healthRoute = Router()

healthRoute.get('/', async (req: Request, res: Response) => {
  try {
    await writerPool.query('SELECT 1');
    await readQuery('SELECT 1');
    res.status(200).send('OK');
  } catch (error) {
    logger.error({ err: error }, 'Health check DB connection failed');
    res.status(503).send('DB unavailable');
  }
});
