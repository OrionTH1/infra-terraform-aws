import pino from 'pino';

// JSON to stdout, which is what the awslogs driver ships to CloudWatch. The numeric
// `level` field is what the CloudWatch metric filter matches on ({ $.level >= 50 }),
// so it must stay a number — do not enable pretty printing in the container.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'backend',
    env: process.env.NODE_ENV ?? 'development',
  },
});
