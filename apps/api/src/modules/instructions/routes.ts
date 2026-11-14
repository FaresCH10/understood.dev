import { Router } from 'express';
import { Types } from 'mongoose';
import {
  LANGUAGES,
  generateSchema,
  instructionPatchSchema,
  type InstructionPatch,
  type Language,
} from '@understood/shared';
import { asyncHandler, parseBody, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { config } from '../../config.js';
import { Crew, Instruction, Variant, Worker, type InstructionDoc } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { canGenerate, canPatchInstruction, canDeleteInstruction } from '../../domain/lifecycle.js';
import { mediaKeyForPhoto, mediaKeyForVoice, getStorage } from '../../media/storage.js';
import { probeAudio, reencodePhoto } from '../../media/probe.js';
import { uploader, AUDIO_MIME, PHOTO_MIME } from '../../http/upload.js';
import { rateLimit } from '../../auth/rate-limit.js';
import { getQueue } from '../../jobs/queue.js';
import { signPreviewToken } from '../../auth/tokens.js';
import { sourceTextOf } from '../pipeline/runner.js';

export const instructionsRouter: Router = Router();
instructionsRouter.use(requireAuth);

const AUDIO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

async function loadOwned(orgId: string, id: string): Promise<InstructionDoc> {
  const instruction = await Instruction.findOne({ _id: id, orgId });
  if (!instruction) throw new AppError('NOT_FOUND');
  return instruction.toObject();
}

async function deleteMediaIfPresent(keys: Array<string | null | undefined>): Promise<void> {
  const storage = getStorage();
  await Promise.all(keys.filter(Boolean).map((key) => storage.delete(key!).catch(() => undefined)));
}

function assertPatchable(instruction: InstructionDoc): void {
  if (!canPatchInstruction(instruction.status)) throw new AppError('CONFLICT_STATE');
}

instructionsRouter.post(
  '/instructions',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.create({
      orgId: req.auth!.orgId,
      createdBy: req.auth!.userId,
      type: 'task',
      sourceLanguage: 'en',
      status: 'draft',
      generation: 0,
    });
    sendData(res, { id: String(instruction._id), status: 'draft' }, undefined, 201);
  }),
);

instructionsRouter.patch(
  '/instructions/:id',
  asyncHandler(async (req, res) => {
    const patch = parseBody(instructionPatchSchema, req);
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canPatchInstruction(instruction.status)) throw new AppError('CONFLICT_STATE');

    if (patch.title !== undefined) instruction.title = patch.title;
    if (patch.type !== undefined) instruction.type = patch.type;
    if (patch.sourceLanguage !== undefined) instruction.sourceLanguage = patch.sourceLanguage;

    const oldKeys: Array<string | null> = [];
    if (patch.content) {
      const content = instruction.content ?? {};
      const nextKind = patch.content.kind;

      if (nextKind === 'voice') {
        throw new AppError('VALIDATION_FAILED', [
          { field: 'content.kind', issue: 'voice content is set by uploading audio' },
        ]);
      }

      if (nextKind && nextKind !== content.kind) {
        if (nextKind === 'text') {
          oldKeys.push(content.audioKey ?? null, content.photoKey ?? null);
          content.audioKey = null;
          content.audioMime = null;
          content.durationS = null;
          content.photoKey = null;
          content.transcript = null;
          content.transcriptStatus = undefined;
          content.detectedSourceLanguage = null;
        }
        if (nextKind === 'photo') {
          oldKeys.push(content.audioKey ?? null);
          content.audioKey = null;
          content.audioMime = null;
          content.durationS = null;
          content.transcript = null;
          content.transcriptStatus = undefined;
          content.detectedSourceLanguage = null;
        }
        content.kind = nextKind;
      }

      if (patch.content.text !== undefined) {
        content.text = patch.content.text;
      }

      if (patch.content.transcript !== undefined || patch.content.transcriptStatus !== undefined) {
        if (content.kind !== 'voice') {
          throw new AppError('VALIDATION_FAILED', [
            { field: 'content.transcript', issue: 'transcripts only apply to voice drafts' },
          ]);
        }
        if (patch.content.transcript !== undefined) content.transcript = patch.content.transcript;
        if (patch.content.transcriptStatus !== undefined) {
          if (patch.content.transcriptStatus === 'confirmed') {
            const transcript = (patch.content.transcript ?? content.transcript ?? '').trim();
            if (!transcript) {
              throw new AppError('VALIDATION_FAILED', [
                { field: 'content.transcript', issue: 'a transcript is required before confirming' },
              ]);
            }
            content.transcript = transcript;
            if (!patch.sourceLanguage && content.detectedSourceLanguage) {
              instruction.sourceLanguage = content.detectedSourceLanguage;
            }
          }
          content.transcriptStatus = patch.content.transcriptStatus;
        }
      }

      instruction.content = content as InstructionDoc['content'];
      instruction.markModified('content');
    }

    await instruction.save();
    await deleteMediaIfPresent(oldKeys);

    sendData(res, {
      id: String(instruction._id),
      title: instruction.title ?? null,
      type: instruction.type,
      sourceLanguage: instruction.sourceLanguage,
      status: instruction.status,
      content: {
        kind: instruction.content.kind ?? null,
        text: instruction.content.text ?? null,
        transcript: instruction.content.transcript ?? null,
        transcriptStatus: instruction.content.transcriptStatus ?? null,
        detectedSourceLanguage: instruction.content.detectedSourceLanguage ?? null,
        durationS: instruction.content.durationS ?? null,
        hasAudio: Boolean(instruction.content.audioKey),
        hasPhoto: Boolean(instruction.content.photoKey),
      },
    });
  }),
);

instructionsRouter.post(
  '/instructions/:id/voice',
  uploader(AUDIO_MIME).single('file'),
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    assertPatchable(instruction.toObject());

    const file = req.file;
    if (!file) throw new AppError('VALIDATION_FAILED', [{ field: 'file', issue: 'audio file required' }]);

    const ext = AUDIO_EXT[file.mimetype] ?? 'webm';
    const probe = await probeAudio(file.buffer, ext === 'mp3' ? 'mp3' : ext);
    if (!probe) throw new AppError('UNSUPPORTED_MEDIA');
    if (probe.durationS > 185) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'file', issue: 'audio must be 3:00 or shorter' }]);
    }

    const key = mediaKeyForVoice(req.auth!.orgId, routeParam(req.params.id), ext);
    await getStorage().put(key, file.buffer, file.mimetype);

    const oldKeys: string[] = [];
    if (instruction.content.photoKey) oldKeys.push(instruction.content.photoKey);
    if (instruction.content.audioKey) oldKeys.push(instruction.content.audioKey);

    instruction.content.kind = 'voice';
    instruction.content.audioKey = key;
    instruction.content.audioMime = file.mimetype;
    instruction.content.durationS = probe.durationS;
    instruction.content.photoKey = null;
    instruction.content.transcript = null;
    instruction.content.transcriptStatus = 'pending';
    instruction.content.detectedSourceLanguage = null;
    instruction.markModified('content');
    await instruction.save();
    await deleteMediaIfPresent(oldKeys);

    await getQueue().enqueue('transcribe', {
      instructionId: String(instruction._id),
      orgId: req.auth!.orgId,
      audioKey: key,
    });

    sendData(res, { durationS: probe.durationS, transcriptStatus: 'pending' });
  }),
);

instructionsRouter.post(
  '/instructions/:id/photo',
  uploader(PHOTO_MIME).single('file'),
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    assertPatchable(instruction.toObject());

    const file = req.file;
    if (!file) throw new AppError('VALIDATION_FAILED', [{ field: 'file', issue: 'image file required' }]);

    let jpeg: Buffer;
    try {
      jpeg = await reencodePhoto(file.buffer);
    } catch {
      throw new AppError('UNSUPPORTED_MEDIA');
    }

    const key = mediaKeyForPhoto(req.auth!.orgId, routeParam(req.params.id));
    await getStorage().put(key, jpeg, 'image/jpeg');

    const oldKeys: string[] = [];
    if (instruction.content.photoKey) oldKeys.push(instruction.content.photoKey);
    if (instruction.content.audioKey) oldKeys.push(instruction.content.audioKey);

    instruction.content.kind = 'photo';
    instruction.content.photoKey = key;
    instruction.content.audioKey = null;
    instruction.content.audioMime = null;
    instruction.content.durationS = null;
    instruction.content.transcript = null;
    instruction.content.transcriptStatus = undefined;
    instruction.content.detectedSourceLanguage = null;
    instruction.markModified('content');
    await instruction.save();
    await deleteMediaIfPresent(oldKeys);

    sendData(res, { kind: 'photo' });
  }),
);

instructionsRouter.delete(
  '/instructions/:id/media',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    assertPatchable(instruction.toObject());

    const oldKeys = [instruction.content.audioKey, instruction.content.photoKey];
    instruction.content.kind = 'text';
    instruction.content.audioKey = null;
    instruction.content.audioMime = null;
    instruction.content.durationS = null;
    instruction.content.photoKey = null;
    instruction.content.transcript = null;
    instruction.content.transcriptStatus = undefined;
    instruction.content.detectedSourceLanguage = null;
    instruction.markModified('content');
    await instruction.save();
    await deleteMediaIfPresent(oldKeys);

    res.status(204).end();
  }),
);

instructionsRouter.post(
  '/instructions/:id/generate',
  rateLimit({ bucket: 'generate-org', limit: 10, windowSeconds: 3600 }),
  asyncHandler(async (req, res) => {
    const body = parseBody(generateSchema, req);
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canGenerate(instruction.status)) throw new AppError('CONFLICT_STATE');

    const content = instruction.content ?? {};
    const text = sourceTextOf(instruction.toObject());
    if (content.kind === 'voice') {
      if (content.transcriptStatus !== 'confirmed' || !text) throw new AppError('TRANSCRIPT_UNCONFIRMED');
    } else if (!text) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'content.text', issue: 'instruction text is required' }]);
    }
    if (content.kind === 'photo' && !content.photoKey) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'content.photoKey', issue: 'upload a photo before generating' }]);
    }

    const crew = await Crew.findOne({ _id: body.crewId, orgId: req.auth!.orgId, archivedAt: null }).lean();
    if (!crew) throw new AppError('NOT_FOUND');

    let audienceIds: Types.ObjectId[];
    if (body.audienceWorkerIds) {
      const workers = await Worker.find({
        _id: { $in: body.audienceWorkerIds },
        orgId: req.auth!.orgId,
        crewId: crew._id,
        archivedAt: null,
      })
        .select('_id')
        .lean();
      if (workers.length !== new Set(body.audienceWorkerIds).size) {
        throw new AppError('VALIDATION_FAILED', [
          { field: 'audienceWorkerIds', issue: 'every worker must be active and in the chosen crew' },
        ]);
      }
      audienceIds = workers.map((worker) => worker._id);
    } else {
      const workers = await Worker.find({ orgId: req.auth!.orgId, crewId: crew._id, archivedAt: null })
        .select('_id')
        .limit(1000)
        .lean();
      audienceIds = workers.map((worker) => worker._id);
    }
    if (audienceIds.length === 0) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'audienceWorkerIds', issue: 'the crew has no active workers' }]);
    }

    const audienceLanguages = new Set<Language>();
    const audienceDocs = await Worker.find({ _id: { $in: audienceIds } }).select('language').lean();
    for (const worker of audienceDocs) audienceLanguages.add(worker.language);

    const languages: Language[] = config.PIPELINE_ALL_LANGUAGES
      ? [...LANGUAGES]
      : [...new Set<Language>([...audienceLanguages, instruction.sourceLanguage])];

    const updated = await Instruction.findOneAndUpdate(
      { _id: instruction._id, orgId: req.auth!.orgId, status: 'draft' },
      {
        $set: {
          crewId: crew._id,
          audienceWorkerIds: audienceIds,
          status: 'processing',
          'pipeline.startedAt': new Date(),
          'pipeline.finishedAt': null,
          'pipeline.lastError': null,
        },
        $inc: { generation: 1 },
      },
      { new: true },
    );
    if (!updated) throw new AppError('CONFLICT_STATE');

    try {
      await Variant.insertMany(
        languages.map((language) => ({
          orgId: updated.orgId,
          instructionId: updated._id,
          language,
          status: 'pending',
          revision: 1,
          stages: { translate: 'pending', question: 'pending', audio: 'pending' },
          audioStatus: 'pending',
          questionStatus: 'pending',
        })),
      );
    } catch (error) {
      await Instruction.updateOne(
        { _id: updated._id, generation: updated.generation },
        { $set: { status: 'draft' } },
      );
      throw error;
    }

    const queue = getQueue();
    await Promise.all(
      languages.map((language) =>
        queue.enqueue(
          'variant',
          {
            instructionId: String(updated._id),
            orgId: req.auth!.orgId,
            language,
            generation: updated.generation,
            revision: 1,
          },
          { jobId: `${updated._id}_${language}_${updated.generation}_1` },
        ),
      ),
    );

    sendData(res, { status: 'processing' }, { languages }, 202);
  }),
);

instructionsRouter.get(
  '/instructions/:id',
  asyncHandler(async (req, res) => {
    const instruction = await loadOwned(req.auth!.orgId, routeParam(req.params.id));
    const variants = await Variant.find({ instructionId: instruction._id }).sort({ language: 1 }).lean();

    sendData(res, {
      id: String(instruction._id),
      title: instruction.title ?? null,
      type: instruction.type,
      status: instruction.status,
      sourceLanguage: instruction.sourceLanguage,
      crewId: instruction.crewId ? String(instruction.crewId) : null,
      audienceCount: instruction.audienceWorkerIds.length,
      content: {
        kind: instruction.content.kind ?? null,
        text: instruction.content.text ?? null,
        transcript: instruction.content.transcript ?? null,
        transcriptStatus: instruction.content.transcriptStatus ?? null,
        detectedSourceLanguage: instruction.content.detectedSourceLanguage ?? null,
        durationS: instruction.content.durationS ?? null,
        hasAudio: Boolean(instruction.content.audioKey),
        hasPhoto: Boolean(instruction.content.photoKey),
      },
      share: {
        sharedAt: instruction.sharedAt ?? null,
        shareTokenIssuedAt: instruction.shareTokenIssuedAt ?? null,
        canShare: instruction.status === 'ready' || instruction.status === 'partial_failure',
        canPreview: ['ready', 'partial_failure', 'shared'].includes(instruction.status),
      },
      variants: variants.map((variant) => ({
        id: String(variant._id),
        language: variant.language,
        title: variant.title ?? null,
        text: variant.text ?? null,
        hasAudio: Boolean(variant.audioKey),
        audioDurationS: variant.audioDurationS ?? null,
        audioStatus: variant.audioStatus,
        question: variant.question ?? null,
        questionStatus: variant.questionStatus,
        status: variant.status,
        stages: variant.stages,
        revision: variant.revision,
        lastError: variant.lastError ?? null,
      })),
      createdAt: instruction.createdAt,
      updatedAt: instruction.updatedAt,
    });
  }),
);

instructionsRouter.get(
  '/instructions/:id/status',
  asyncHandler(async (req, res) => {
    const instruction = await loadOwned(req.auth!.orgId, routeParam(req.params.id));
    const variants = await Variant.find({ instructionId: instruction._id }).lean();

    const stages: Record<string, Record<string, string>> = { translate: {}, question: {}, audio: {} };
    for (const variant of variants) {
      stages.translate![variant.language] = variant.stages.translate;
      stages.question![variant.language] = variant.stages.question;
      stages.audio![variant.language] = variant.stages.audio;
    }

    sendData(
      res,
      {
        status: instruction.status,
        transcript:
          instruction.content.kind === 'voice'
            ? {
                status: instruction.content.transcriptStatus ?? 'pending',
                language: instruction.content.detectedSourceLanguage ?? null,
                text: instruction.content.transcript ?? null,
              }
            : null,
        stages,
        error: instruction.pipeline.lastError ?? null,
      },
      { languages: variants.map((variant) => variant.language).sort(), audienceCount: instruction.audienceWorkerIds.length },
    );
  }),
);

instructionsRouter.post(
  '/instructions/:id/preview-token',
  asyncHandler(async (req, res) => {
    const instruction = await loadOwned(req.auth!.orgId, routeParam(req.params.id));
    if (!['ready', 'partial_failure', 'shared'].includes(instruction.status)) throw new AppError('CONFLICT_STATE');

    const { token, expiresAt } = signPreviewToken(String(instruction._id), config.PREVIEW_TTL_MINUTES);
    sendData(res, { token, url: `${config.APP_URL}/i/preview/${token}`, expiresAt }, undefined, 201);
  }),
);

instructionsRouter.delete(
  '/instructions/:id',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canDeleteInstruction(instruction.status)) throw new AppError('CONFLICT_STATE');

    await deleteMediaIfPresent([instruction.content.audioKey, instruction.content.photoKey]);
    await Variant.deleteMany({ instructionId: instruction._id });
    await Instruction.deleteOne({ _id: instruction._id });
    res.status(204).end();
  }),
);

export type { InstructionPatch };
