import { logger } from '../logger.js';

/**
 * Placeholder for the v0.1 audit trail: delivery records are the audit source.
 * Admin actions are logged only with IDs; no PII and no general audit collection.
 */
export async function afterWrite(action: string, subjectId: string, actorId: string): Promise<void> {
  logger.info({ action, subjectId, actorId }, 'write');
}
