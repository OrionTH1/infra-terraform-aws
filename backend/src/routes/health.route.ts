import { Router, type Request, type Response } from 'express';

export const healthRoute = Router()

healthRoute.get('/', (req: Request, res: Response) => {
  res.status(200).send('OK');
});
