import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db.js';
import '../models.js';
import '../modules/access/models.js';
import '../modules/operations/models.js';
import '../modules/operations/push.js';
import '../modules/operations/privacy.js';

/** Creates missing indexes without dropping existing indexes (safe for rolling releases). */
export async function ensureIndexes(): Promise<void> {
  for (const model of Object.values(mongoose.models)) {
    await model.createIndexes();
    console.log(`Indexes ready: ${model.collection.name}`);
  }
}

try {
  await connectMongo();
  await ensureIndexes();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Index provisioning failed');
  process.exitCode = 1;
} finally {
  await disconnectMongo();
}
