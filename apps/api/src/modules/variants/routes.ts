import { Router } from 'express';
import { validateQuestion, variantPatchSchema, type Question } from '@understood/shared';
import { asyncHandler, parseBody, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { Instruction, Variant } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { canEditVariant } from '../../domain/lifecycle.js';
import { getStorage } from '../../media/storage.js';
import { getQueue } from '../../jobs/queue.js';

export const variantsRouter: Router = Router();
variantsRouter.use(requireAuth);

async function loadVariant(orgId: string, id: string) {
  const variant = await Variant.findOne({ _id: id, orgId });
  if (!variant) throw new AppError('NOT_FOUND');
  const instruction = await Instruction.findOne({ _id: variant.instructionId, orgId });
  if (!instruction) throw new AppError('NOT_FOUND');
  return { variant, instruction };
}

variantsRouter.get(
  '/variants/:id/audio',
  asyncHandler(async (req, res) => {
    const { variant } = await loadVariant(req.auth!.orgId, routeParam(req.params.id));
    if (!variant.audioKey) throw new AppError('CONFLICT_STATE');
    const { url } = await getStorage().signedUrl(variant.audioKey);
    res.redirect(302, url);
  }),
);

variantsRouter.patch(
  '/variants/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(variantPatchSchema, req);
    const { variant, instruction } = await loadVariant(req.auth!.orgId, routeParam(req.params.id));
    if (!canEditVariant(instruction.status)) throw new AppError('CONFLICT_STATE');
    let manualQuestion: Question | null = null;
    if (body.question) {
      manualQuestion = {
        text: body.question.text,
        options: body.question.options as [string, string, string],
        correctIndex: body.question.correctIndex,
        source: 'manual',
      };
      const validation = validateQuestion(manualQuestion);
      if (!validation.ok) {
        throw new AppError('VALIDATION_FAILED', validation.issues.map((issue) => ({ field: 'question', issue })));
      }
    }

    const structureChanged = body.text !== undefined || body.title !== undefined;

    if (body.text !== undefined) variant.text = body.text;
    if (body.title !== undefined) variant.title = body.title;

    if (structureChanged) {
      variant.stages.translate = 'done';
      variant.stages.question = manualQuestion ? 'done' : 'pending';
      variant.stages.audio = 'pending';
      if (!manualQuestion) {
        variant.question = null;
        variant.questionStatus = 'pending';
      }
      variant.audioKey = null;
      variant.audioStatus = 'pending';
      variant.status = 'processing';
    }

    if (manualQuestion) {
      variant.question = manualQuestion;
      variant.questionStatus = 'ready';
      variant.stages.question = 'done';
      if (!structureChanged) variant.status = 'processing';
    }

    variant.revision += 1;
    variant.editedAt = new Date();
    variant.lastError = null;
    await variant.save();

    const updatedInstruction = await Instruction.findOneAndUpdate(
      { _id: instruction._id, orgId: req.auth!.orgId },
      {
        $set: {
          status: 'processing',
          'pipeline.startedAt': new Date(),
          'pipeline.finishedAt': null,
          'pipeline.lastError': null,
        },
        $inc: { generation: 1 },
      },
      { new: true },
    );
    if (!updatedInstruction) throw new AppError('CONFLICT_STATE');

    await getQueue().enqueue(
      'variant',
      {
        instructionId: String(instruction._id),
        orgId: req.auth!.orgId,
        language: variant.language,
        generation: updatedInstruction.generation,
        revision: variant.revision,
      },
      { jobId: `${instruction._id}_${variant.language}_${updatedInstruction.generation}_${variant.revision}` },
    );

    sendData(res, { status: 'processing', revision: variant.revision }, undefined, 202);
  }),
);

variantsRouter.post(
  '/variants/:id/regenerate',
  asyncHandler(async (req, res) => {
    const { variant, instruction } = await loadVariant(req.auth!.orgId, routeParam(req.params.id));
    if (!canEditVariant(instruction.status)) throw new AppError('CONFLICT_STATE');

    variant.text = null;
    variant.title = null;
    variant.question = null;
    variant.questionStatus = 'pending';
    variant.audioKey = null;
    variant.audioStatus = 'pending';
    variant.stages.translate = 'pending';
    variant.stages.question = 'pending';
    variant.stages.audio = 'pending';
    variant.status = 'processing';
    variant.revision += 1;
    variant.editedAt = new Date();
    variant.lastError = null;
    await variant.save();

    const updatedInstruction = await Instruction.findOneAndUpdate(
      { _id: instruction._id, orgId: req.auth!.orgId },
      {
        $set: {
          status: 'processing',
          'pipeline.startedAt': new Date(),
          'pipeline.finishedAt': null,
          'pipeline.lastError': null,
        },
        $inc: { generation: 1 },
      },
      { new: true },
    );
    if (!updatedInstruction) throw new AppError('CONFLICT_STATE');

    await getQueue().enqueue(
      'variant',
      {
        instructionId: String(instruction._id),
        orgId: req.auth!.orgId,
        language: variant.language,
        generation: updatedInstruction.generation,
        revision: variant.revision,
      },
      { jobId: `${instruction._id}_${variant.language}_${updatedInstruction.generation}_${variant.revision}` },
    );

    sendData(res, { status: 'processing', revision: variant.revision }, undefined, 202);
  }),
);
