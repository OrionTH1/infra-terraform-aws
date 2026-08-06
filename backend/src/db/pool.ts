import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { logger } from '../logger';

const connection = {
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
};

export const writerPool = new Pool({ ...connection, host: process.env.DB_HOST });

export const readerPool = new Pool({
  ...connection,
  host: process.env.DB_READER_HOST ?? process.env.DB_HOST,
});

export async function readQuery<T extends QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await readerPool.query<T>(text, values);
  } catch (error) {
    logger.warn({ err: error }, 'Reader endpoint unavailable, serving this read from the writer');
    return writerPool.query<T>(text, values);
  }
}
