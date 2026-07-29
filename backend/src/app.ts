import express, { type Express } from 'express';
import { globalRoutes } from './routes/global-routes';

const app: Express = express();
const SERVER_PORT = process.env.SERVER_PORT ?? 8080;

globalRoutes(app)

app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});
