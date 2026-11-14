import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config, isProduction } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { closeKv, getKv } from './stores/kv.js';
import { closeQueue, getQueue } from './jobs/queue.js';
import { logger } from './logger.js';
import { registerPipelineJobs } from './jobs/register.js';
import { startOperationsScheduler } from './modules/operations/service.js';

export async function boot(): Promise<void> {
  await connectMongo();
  registerPipelineJobs();
  await getQueue().ready();
  const stopOperations = config.PROCESS_ROLE === 'api' ? () => {} : startOperationsScheduler();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  if (config.PROCESS_ROLE !== 'api') {
    const beat = () => getKv().set('worker:heartbeat', new Date().toISOString(), 30).catch((error) => {
      logger.error({ err: String(error) }, 'worker heartbeat failed');
    });
    await beat();
    heartbeat = setInterval(() => void beat(), 10_000);
    heartbeat.unref();
  }

  const server = config.PROCESS_ROLE === 'worker' ? null : createServer(createApp());
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    if (heartbeat) clearInterval(heartbeat);
    stopOperations();
    const deadline = setTimeout(() => process.exit(1), 15_000);
    deadline.unref();
    try {
      if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await closeQueue();
      await closeKv();
      await disconnectMongo();
      clearTimeout(deadline);
      process.exit(0);
    } catch (error) {
      logger.error({ err: String(error) }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  if (config.PROCESS_ROLE === 'worker') {
    logger.info('background worker consuming jobs');
    return;
  }

  server!.listen(config.PORT, isProduction ? '0.0.0.0' : undefined, () => {
    logger.info({ port: config.PORT, role: config.PROCESS_ROLE }, 'api listening');
  });
}
