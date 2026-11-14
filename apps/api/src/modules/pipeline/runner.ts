import { createHash } from 'node:crypto';
import {
  LANGUAGE_META,
  validateQuestion,
  validateTranslation,
  type InstructionStatus,
  type Language,
  type Question,
  type VariantStatus,
} from '@understood/shared';
import { config, isTest } from '../../config.js';
import { instructionStatusFromVariants } from '../../domain/lifecycle.js';
import { logger } from '../../logger.js';
import { getStorage } from '../../media/storage.js';
import { AiUsage, AudioAsset, Instruction, Variant, type InstructionDoc, type VariantDoc } from '../../models.js';
import { getProviders } from './providers.js';

export interface VariantJobPayload {
  instructionId: string;
  orgId: string;
  language: string;
  generation: number;
  revision: number;
}

class StaleJob extends Error {}

class StageError extends Error {
  constructor(
    readonly stage: 'translate' | 'question' | 'audio',
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function delay(ms: number): Promise<void> {
  if (isTest) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay([1000, 5000, 20000][attempt] ?? 20000);
    }
  }
  throw lastError;
}

export function sourceTextOf(instruction: InstructionDoc): string {
  const content = instruction.content ?? {};
  if (content.kind === 'voice') return (content.transcript ?? '').trim();
  return (content.text ?? '').trim();
}

async function stillCurrent(payload: VariantJobPayload, variantId: string): Promise<boolean> {
  const [instruction, variant] = await Promise.all([
    Instruction.findOne({ _id: payload.instructionId, orgId: payload.orgId }).select('generation status').lean(),
    Variant.findById(variantId).select('revision').lean(),
  ]);
  return (
    Boolean(instruction) &&
    instruction!.generation === payload.generation &&
    instruction!.status === 'processing' &&
    variant?.revision === payload.revision
  );
}

async function recordUsage(input: {
  orgId: string;
  instructionId: string;
  language?: Language;
  stage: 'transcribe' | 'translate' | 'question' | 'tts';
  provider: string;
  units: number;
  unitType: 'chars' | 'seconds' | 'tokens';
  latencyMs: number;
}): Promise<void> {
  await AiUsage.create({
    orgId: input.orgId,
    instructionId: input.instructionId,
    language: input.language ?? null,
    stage: input.stage,
    provider: input.provider,
    units: input.units,
    unitType: input.unitType,
    costUsd: 0,
    latencyMs: input.latencyMs,
  }).catch((error) => logger.warn({ err: String(error) }, 'usage write failed'));
}

async function translateStage(instruction: InstructionDoc, variant: VariantDoc, payload: VariantJobPayload): Promise<void> {
  const language = variant.language;
  const sourceText = sourceTextOf(instruction);
  if (!sourceText) throw new StageError('translate', 'empty_source', 'Instruction has no text to translate.');

  await Variant.updateOne({ _id: variant._id, revision: payload.revision }, { $set: { 'stages.translate': 'running' } });

  let text: string;
  if (language === instruction.sourceLanguage) {
    text = sourceText;
  } else {
    const providers = getProviders();
    const started = Date.now();
    try {
      const result = await retry(async () => {
        let candidate: string;
        try {
          candidate = (await providers.translation.translate({ text: sourceText, sourceLang: instruction.sourceLanguage, targetLang: language })).text;
        } catch (error) {
          if (!providers.fallbackTranslation) throw error;
          candidate = (
            await providers.fallbackTranslation.translate({ text: sourceText, sourceLang: instruction.sourceLanguage, targetLang: language })
          ).text;
        }
        const validation = validateTranslation({
          source: sourceText,
          translated: candidate,
          target: language,
          sourceLang: instruction.sourceLanguage,
        });
        if (!validation.ok) throw new Error(`translation invalid: ${validation.issues.join(',')}`);
        return candidate;
      }, 3);
      text = result;
      await recordUsage({
        orgId: payload.orgId,
        instructionId: payload.instructionId,
        language,
        stage: 'translate',
        provider: providers.translation.name,
        units: sourceText.length,
        unitType: 'chars',
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      throw new StageError('translate', 'translation_failed', error instanceof Error ? error.message : 'translation failed');
    }
  }

  const current = await stillCurrent(payload, String(variant._id));
  if (!current) throw new StaleJob();
  const updated = await Variant.updateOne(
    { _id: variant._id, revision: payload.revision },
    {
      $set: {
        text,
        title: instruction.title ?? null,
        'stages.translate': 'done',
        status: 'processing',
      },
    },
  );
  if (updated.modifiedCount === 0) throw new StaleJob();
}

async function questionStage(instruction: InstructionDoc, variant: VariantDoc, payload: VariantJobPayload): Promise<void> {
  const text = (variant.text ?? '').trim();
  if (!text) throw new StageError('question', 'empty_text', 'No translated text to build a question from.');

  await Variant.updateOne({ _id: variant._id, revision: payload.revision }, { $set: { 'stages.question': 'running' } });
  const providers = getProviders();
  const started = Date.now();

  let question: Question;
  try {
    const result = await retry(async () => {
      const generated = await providers.question.generate({ text, lang: variant.language });
      const candidate: Question = {
        text: generated.question,
        options: generated.options,
        correctIndex: generated.correctIndex,
        source: 'ai',
      };
      const validation = validateQuestion(candidate);
      if (!validation.ok) throw new Error(`question invalid: ${validation.issues.join(',')}`);
      return candidate;
    }, 2);
    question = result;
    await recordUsage({
      orgId: payload.orgId,
      instructionId: payload.instructionId,
      language: variant.language,
      stage: 'question',
      provider: providers.question.name,
      units: Math.ceil(text.length / 4),
      unitType: 'tokens',
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'question generation failed';
    await Variant.updateOne(
      { _id: variant._id, revision: payload.revision },
      {
        $set: {
          questionStatus: 'manual_required',
          'stages.question': 'failed',
          lastError: { stage: 'question', code: 'question_failed', message: message.slice(0, 200), at: new Date() },
          status: 'failed',
        },
      },
    );
    throw new StageError('question', 'question_failed', message);
  }

  const current = await stillCurrent(payload, String(variant._id));
  if (!current) throw new StaleJob();
  const updated = await Variant.updateOne(
    { _id: variant._id, revision: payload.revision },
    { $set: { question, questionStatus: 'ready', 'stages.question': 'done' } },
  );
  if (updated.modifiedCount === 0) throw new StaleJob();
}

function cacheKeyFor(orgId: string, text: string, voiceId: string): string {
  return createHash('sha256').update(`${orgId}|${text}|${voiceId}|-5%|mp3|v1`).digest('hex');
}

async function audioStage(instruction: InstructionDoc, variant: VariantDoc, payload: VariantJobPayload): Promise<void> {
  const text = (variant.text ?? '').trim();
  if (!text) throw new StageError('audio', 'empty_text', 'No text to synthesize.');

  const meta = LANGUAGE_META[variant.language];
  const cacheKey = cacheKeyFor(payload.orgId, text, meta.voiceId);
  await Variant.updateOne({ _id: variant._id, revision: payload.revision }, { $set: { 'stages.audio': 'running' } });

  let audioKey: string | null = null;
  let chars = text.length;
  let durationS = Math.max(1, Math.round(text.length / 14));

  const cached = await AudioAsset.findOne({ orgId: payload.orgId, cacheKey }).lean();
  if (cached) {
    await AudioAsset.updateOne({ _id: cached._id }, { $set: { lastUsedAt: new Date() } });
    audioKey = cached.r2Key;
  } else {
    const providers = getProviders();
    const started = Date.now();
    let audio: Buffer;
    try {
      const result = await retry(() => providers.tts.synthesize({ text, lang: variant.language, voiceId: meta.voiceId }), 3);
      audio = result.audio;
    } catch (error) {
      await Variant.updateOne(
        { _id: variant._id, revision: payload.revision },
        {
          $set: {
            audioStatus: 'failed',
            'stages.audio': 'failed',
            status: 'failed',
            lastError: {
              stage: 'audio',
              code: 'tts_failed',
              message: (error instanceof Error ? error.message : 'tts failed').slice(0, 200),
              at: new Date(),
            },
          },
        },
      );
      throw new StageError('audio', 'tts_failed', error instanceof Error ? error.message : 'tts failed');
    }

    const current = await stillCurrent(payload, String(variant._id));
    if (!current) throw new StaleJob();

    audioKey = `orgs/${payload.orgId}/audio/${cacheKey}.mp3`;
    await getStorage().put(audioKey, audio, 'audio/mpeg');

    const fromBytes = Math.round((audio.length * 8) / 48000);
    if (fromBytes > 1) durationS = fromBytes;

    await AudioAsset.updateOne(
      { orgId: payload.orgId, cacheKey },
      {
        $setOnInsert: {
          orgId: payload.orgId,
          cacheKey,
          r2Key: audioKey,
          chars,
          voiceId: meta.voiceId,
          createdAt: new Date(),
        },
        $set: { lastUsedAt: new Date() },
      },
      { upsert: true },
    ).catch(() => undefined);

    await recordUsage({
      orgId: payload.orgId,
      instructionId: payload.instructionId,
      language: variant.language,
      stage: 'tts',
      provider: providers.tts.name,
      units: chars,
      unitType: 'chars',
      latencyMs: Date.now() - started,
    });
  }

  const updated = await Variant.updateOne(
    { _id: variant._id, revision: payload.revision },
    {
      $set: {
        audioKey,
        audioChars: chars,
        audioDurationS: durationS,
        audioStatus: 'ready',
        'stages.audio': 'done',
        lastError: null,
      },
    },
  );
  if (updated.modifiedCount === 0) throw new StaleJob();
}

async function finalizeVariant(variantId: string, revision: number): Promise<void> {
  const variant = await Variant.findById(variantId).lean();
  if (!variant || variant.revision !== revision) return;

  let status: VariantStatus = 'failed';
  if (variant.stages.translate === 'done' && variant.stages.question === 'done' && variant.stages.audio === 'done') {
    status = 'ready';
  } else if (variant.stages.translate === 'done' && variant.audioStatus === 'skipped' && variant.questionStatus === 'ready') {
    status = 'text_only';
  }

  await Variant.updateOne(
    { _id: variantId, revision },
    { $set: { status, ...(status === 'ready' ? { lastError: null } : {}) } },
  );
}

export async function finalizeInstruction(instructionId: string, generation: number): Promise<InstructionStatus | null> {
  const instruction = await Instruction.findOne({ _id: instructionId, generation }).select('status generation').lean();
  if (!instruction || instruction.status !== 'processing') return null;

  const variants = await Variant.find({ instructionId }).select('status').lean();
  const next = instructionStatusFromVariants(variants);
  if (next === 'processing') return null;

  const updated = await Instruction.updateOne(
    { _id: instructionId, generation, status: 'processing' },
    { $set: { status: next, 'pipeline.finishedAt': new Date() } },
  );
  return updated.modifiedCount > 0 ? next : null;
}

export async function runVariantJob(payload: VariantJobPayload): Promise<void> {
  const instruction = await Instruction.findOne({ _id: payload.instructionId, orgId: payload.orgId });
  if (!instruction || instruction.generation !== payload.generation || instruction.status !== 'processing') return;

  let variant = await Variant.findOne({ instructionId: payload.instructionId, language: payload.language });
  if (!variant || variant.revision !== payload.revision) return;

  await Variant.updateOne(
    { _id: variant._id, revision: payload.revision, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'processing' } },
  );

  try {
    if (variant.stages.translate !== 'done') {
      await translateStage(instruction, variant, payload);
      variant = (await Variant.findById(variant._id)) ?? variant;
      if (variant.revision !== payload.revision) throw new StaleJob();
    }
    if (variant.stages.question !== 'done') {
      await questionStage(instruction, variant, payload);
      variant = (await Variant.findById(variant._id)) ?? variant;
      if (variant.revision !== payload.revision) throw new StaleJob();
    }
    if (variant.stages.audio !== 'done') {
      await audioStage(instruction, variant, payload);
    }
    await finalizeVariant(String(variant._id), payload.revision);
  } catch (error) {
    if (error instanceof StaleJob) return;

    const stage = error instanceof StageError ? error.stage : 'translate';
    const code = error instanceof StageError ? error.code : 'stage_failed';
    const message = error instanceof Error ? error.message : 'stage failed';
    logger.warn({ instructionId: payload.instructionId, language: payload.language, stage, code }, 'variant stage failed');

    if (stage !== 'question' || !(error instanceof StageError)) {
      await Variant.updateOne(
        { _id: variant._id, revision: payload.revision },
        {
          $set: {
            status: 'failed',
            [`stages.${stage}`]: 'failed',
            ...(stage === 'audio' ? { audioStatus: 'failed' } : {}),
            lastError: { stage, code, message: message.slice(0, 200), at: new Date() },
          },
        },
      ).catch(() => undefined);
    }

    await Instruction.updateOne(
      { _id: payload.instructionId, generation: payload.generation },
      {
        $set: {
          'pipeline.lastError': {
            code,
            message: `${stage}: ${message}`.slice(0, 200),
            at: new Date(),
          },
        },
      },
    ).catch(() => undefined);
  }

  await finalizeInstruction(payload.instructionId, payload.generation);
}
