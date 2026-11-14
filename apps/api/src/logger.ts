import pino from 'pino';
import { config, isTest } from './config.js';

export const logger = pino({
  level: isTest ? 'silent' : config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.email',
      '*.phoneE164',
      '*.transcript',
      '*.text',
      '*.token',
      '*.deliveryToken',
    ],
    censor: '[redacted]',
  },
  base: { service: 'understood-api' },
});

export type Logger = typeof logger;
