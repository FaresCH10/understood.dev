import { boot } from './boot.js';
import { logger } from './logger.js';

boot().catch((error) => {
  logger.error({ err: error instanceof Error ? error.message : String(error) }, 'fatal boot error');
  process.exit(1);
});
