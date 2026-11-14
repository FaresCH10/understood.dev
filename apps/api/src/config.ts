import 'dotenv/config';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const bool = (defaultValue: 'true' | 'false') =>
  z.enum(['true', 'false']).default(defaultValue).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_URL: z.string().url().default('http://localhost:3000'),
    PROCESS_ROLE: z.enum(['api', 'worker', 'both']).default('both'),

    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/understood'),
    REDIS_URL: z.string().min(1).optional(),

    TOKEN_PEPPER: z.string().min(16).default('dev-pepper-change-me-0123456789'),
    TOKEN_ENC_KEY: z.string().optional(),
    PLATFORM_OPERATOR_TOKEN: z.string().min(32).optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),

    MEDIA_DRIVER: z.enum(['local', 'r2']).default('local'),
    MEDIA_LOCAL_DIR: z.string().min(1).default('.data/media'),
    R2_ENDPOINT: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_REGION: z.string().default('auto'),

    EMAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Understood <no-reply@understood.local>'),

    AI_DRIVER: z.enum(['mock', 'live']).default('mock'),
    GROQ_API_KEY: z.string().optional(),
    DEEPL_API_KEY: z.string().optional(),
    AZURE_SPEECH_KEY: z.string().optional(),
    AZURE_SPEECH_REGION: z.string().optional(),

    PIPELINE_ALL_LANGUAGES: bool('true'),
    TTS_MONTHLY_MINUTES: z.coerce.number().int().positive().default(150),
    PREVIEW_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(15),
    MEDIA_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
    HELP_BATCH_SECONDS: z.coerce.number().int().positive().default(600),
    RATE_LIMIT_ENABLED: bool('true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.REDIS_URL) ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'required in production' });
      if (!env.TOKEN_ENC_KEY) ctx.addIssue({ code: 'custom', path: ['TOKEN_ENC_KEY'], message: 'required in production' });
      if (env.TOKEN_PEPPER.length < 32 || env.TOKEN_PEPPER.startsWith('dev-') || /change.?me|replace/i.test(env.TOKEN_PEPPER)) {
        ctx.addIssue({ code: 'custom', path: ['TOKEN_PEPPER'], message: 'must be a random production secret of at least 32 characters' });
      }
      if (!env.APP_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'must be https in production' });
      }
    }
    if (env.TOKEN_ENC_KEY && (Buffer.from(env.TOKEN_ENC_KEY, 'base64').length !== 32 || !/^[A-Za-z0-9+/]{43}=$/.test(env.TOKEN_ENC_KEY))) {
      ctx.addIssue({ code: 'custom', path: ['TOKEN_ENC_KEY'], message: 'must be a base64-encoded 32-byte key' });
    }
    if (env.AI_DRIVER === 'live') {
      for (const key of ['GROQ_API_KEY', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when AI_DRIVER=live' });
      }
    }
    const pushKeys = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
    if (pushKeys.some((key) => env[key]) && !pushKeys.every((key) => env[key])) {
      ctx.addIssue({ code: 'custom', path: ['VAPID_PUBLIC_KEY'], message: 'all three VAPID settings are required to enable push' });
    }
    if (env.MEDIA_DRIVER === 'r2') {
      for (const key of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when MEDIA_DRIVER=r2' });
      }
    }
    if (env.EMAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'required when EMAIL_DRIVER=resend' });
    }
  });

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config = loadConfig();
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

export function encryptionKey(): Buffer {
  if (config.TOKEN_ENC_KEY) {
    const key = Buffer.from(config.TOKEN_ENC_KEY, 'base64');
    if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes base64');
    return key;
  }
  return createHash('sha256').update(`enc:${config.TOKEN_PEPPER}`).digest();
}

export function appOrigin(): string {
  return new URL(config.APP_URL).origin;
}
