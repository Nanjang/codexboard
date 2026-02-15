import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(16),
  SESSION_NAME: z.string().min(1).default('codexboard.sid'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  UPLOAD_ROOT: z.string().min(1).default('uploads'),
  APP_ORIGIN: z.string().min(1).default('http://localhost:3000')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  throw new Error(`Invalid environment: ${message}`);
}

export const env = parsed.data;
