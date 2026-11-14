import { registerJobHandler, type JobPayloads } from './queue.js';
import { runVariantJob, type VariantJobPayload } from '../modules/pipeline/runner.js';
import { runTranscriptionJob, type TranscriptionJobPayload } from '../modules/pipeline/transcription.js';
import { runOrgDeletionJob, type OrgDeletionPayload } from '../modules/org/deletion.js';
import { runHelpAlertJob, type HelpAlertPayload } from '../modules/worker/help-alert.js';
import { runPreparation } from '../modules/operations/service.js';

export function registerPipelineJobs(): void {
  registerJobHandler('operation', async (_name, data) => {
    await runPreparation(data as { instructionId: string; generation: number });
  });
  registerJobHandler('transcribe', async (_name, data) => {
    await runTranscriptionJob(data as TranscriptionJobPayload);
  });
  registerJobHandler('variant', async (_name, data) => {
    await runVariantJob(data as VariantJobPayload);
  });
  registerJobHandler('help_alert', async (_name, data) => {
    await runHelpAlertJob(data as HelpAlertPayload);
  });
  registerJobHandler('cleanup', async (_name, data) => {
    await runOrgDeletionJob(data as OrgDeletionPayload);
  });
}

export type { JobPayloads };
