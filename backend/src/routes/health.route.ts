import { Router, type Request, type Response } from 'express';
import { pool } from '../db/pool';

export const healthRoute = Router()

healthRoute.get('/', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('OK');
  } catch (error) {
    console.error('Health check DB connection failed', error);
    res.status(503).send('DB unavailable');
  }
});
