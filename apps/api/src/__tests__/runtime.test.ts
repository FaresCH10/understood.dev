import { describe, expect, it } from 'vitest';
import { envSchema } from '../config.js';
import { localMediaSignature, verifyLocalMediaSignature } from '../media/storage.js';

describe('production configuration', () => {
  const production = {
    NODE_ENV: 'production', APP_URL: 'https://app.example.com', REDIS_URL: 'redis://redis:6379',
    TOKEN_PEPPER: 'a'.repeat(48), TOKEN_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
  };

  it('rejects development secrets, malformed encryption keys and partial live credentials', () => {
    expect(envSchema.safeParse(production).success).toBe(true);
    expect(envSchema.safeParse({ ...production, TOKEN_PEPPER: 'dev-pepper-change-me-0123456789' }).success).toBe(false);
    expect(envSchema.safeParse({ ...production, TOKEN_ENC_KEY: 'bad' }).success).toBe(false);
    expect(envSchema.safeParse({ ...production, AI_DRIVER: 'live', GROQ_API_KEY: 'key' }).success).toBe(false);
    expect(envSchema.safeParse({ ...production, AI_DRIVER: 'live', GROQ_API_KEY: 'key', AZURE_SPEECH_KEY: 'key', AZURE_SPEECH_REGION: 'uaenorth' }).success).toBe(true);
  });

  it('rejects partially configured browser push', () => {
    expect(envSchema.safeParse({ ...production, VAPID_PUBLIC_KEY: 'public' }).success).toBe(false);
  });
});

describe('local media authorization', () => {
  it('binds the signature to the object and expiry and rejects expired or modified links', () => {
    const now = 1_800_000_000_000;
    const expires = Math.floor(now / 1000) + 900;
    const key = 'orgs/one/audio/example.mp3';
    const signature = localMediaSignature(key, expires);
    expect(verifyLocalMediaSignature(key, String(expires), signature, now)).toBe(true);
    expect(verifyLocalMediaSignature('orgs/two/audio/example.mp3', String(expires), signature, now)).toBe(false);
    expect(verifyLocalMediaSignature(key, String(expires + 1), signature, now)).toBe(false);
    expect(verifyLocalMediaSignature(key, String(expires), signature, (expires + 1) * 1000)).toBe(false);
    expect(verifyLocalMediaSignature(key, String(expires), 'bad', now)).toBe(false);
  });
});
