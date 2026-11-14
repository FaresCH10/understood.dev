import type { Language } from '@understood/shared';
import { logger } from '../../logger.js';
import { getStorage } from '../../media/storage.js';
import { AiUsage, Instruction } from '../../models.js';
import { getProviders } from './providers.js';

export interface TranscriptionJobPayload {
  instructionId: string;
  orgId: string;
  audioKey: string;
}

export async function runTranscriptionJob(payload: TranscriptionJobPayload): Promise<void> {
  const instruction = await Instruction.findOne({
    _id: payload.instructionId,
    orgId: payload.orgId,
    status: 'draft',
    'content.audioKey': payload.audioKey,
    'content.transcriptStatus': 'pending',
  }).lean();

  if (!instruction) return;

  const started = Date.now();
  try {
    const audio = await getStorage().get(payload.audioKey);
    const providers = getProviders();
    const result = await providers.transcription.transcribe({
      audio,
      mime: instruction.content.audioMime ?? 'audio/webm',
    });
    if (!result.text.trim()) throw new Error('empty transcript');

    const detected = (result.detectedLanguage ?? null) as Language | null;
    await Instruction.updateOne(
      {
        _id: payload.instructionId,
        status: 'draft',
        'content.audioKey': payload.audioKey,
        'content.transcriptStatus': 'pending',
      },
      {
        $set: {
          'content.transcript': result.text.slice(0, 4000),
          'content.transcriptStatus': 'ready',
          'content.detectedSourceLanguage': detected,
        },
      },
    );

    await AiUsage.create({
      orgId: payload.orgId,
      instructionId: payload.instructionId,
      stage: 'transcribe',
      provider: providers.transcription.name,
      units: instruction.content.durationS ?? 0,
      unitType: 'seconds',
      costUsd: 0,
      latencyMs: Date.now() - started,
    }).catch(() => undefined);
  } catch (error) {
    logger.warn(
      { instructionId: payload.instructionId, err: error instanceof Error ? error.message : String(error) },
      'transcription failed',
    );
    await Instruction.updateOne(
      {
        _id: payload.instructionId,
        status: 'draft',
        'content.audioKey': payload.audioKey,
        'content.transcriptStatus': 'pending',
      },
      { $set: { 'content.transcriptStatus': 'failed' } },
    ).catch(() => undefined);
  }
}
