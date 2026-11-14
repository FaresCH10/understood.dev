import mongoose from 'mongoose';
import { config, isProduction } from './config.js';
import { logger } from './logger.js';

mongoose.set('autoIndex', !isProduction);
mongoose.set('strictQuery', true);

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: !isProduction,
  });
  logger.info({ db: mongoose.connection.name }, 'mongo connected');
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function mongoHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}
