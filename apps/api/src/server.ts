import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { closeKv } from './stores/kv.js';
import { closeQueue } from './jobs/queue.js';
import { logger } from './logger.js';
import { registerPipelineJobs } from './jobs/register.js';

async function main(): Promise<void> {
  await connectMongo();
  registerPipelineJobs();

  if (config.PROCESS_ROLE === 'worker') {
    logger.info('worker role: no HTTP listener');
    return;
  }

  const app = createApp();
  const server = createServer(app);
  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, role: config.PROCESS_ROLE }, 'api listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await closeQueue();
      await closeKv();
      await disconnectMongo();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ err: error instanceof Error ? error.message : String(error) }, 'fatal boot error');
  process.exit(1);
});
