import { Router } from 'express';
import { shareSchema } from '@understood/shared';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { config } from '../../config.js';
import { Delivery, Instruction, Variant, Worker } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { canArchive, canReadShareLink, canRegenerateLink, canShare } from '../../domain/lifecycle.js';
import { decryptSecret, encryptedSecret, randomToken, tokenHash } from '../../auth/tokens.js';
import { shareMessages } from './messages.js';

export const sharingRouter: Router = Router();
sharingRouter.use(requireAuth);

sharingRouter.post(
  '/instructions/:id/share',
  asyncHandler(async (req, res) => {
    const body = parseBody(shareSchema, req);
    const orgId = req.auth!.orgId;

    const session = await Instruction.startSession();
    let outcome: { token: string; deliveriesCreated: number; archivedDropped: number } | undefined;

    try {
      outcome = await session.withTransaction(async () => {
        const instruction = await Instruction.findOne({ _id: req.params.id, orgId }).session(session);
        if (!instruction) throw new AppError('NOT_FOUND');
        if (instruction.status === 'shared') throw new AppError('SHARE_CONFLICT');
        if (!canShare(instruction.status, Boolean(body.acceptTextOnly))) throw new AppError('INSTRUCTION_NOT_READY');

        if (instruction.status === 'partial_failure' && body.acceptTextOnly) {
          const variants = await Variant.find({ instructionId: instruction._id }).session(session);
          for (const variant of variants) {
            if (
              variant.status === 'failed' &&
              variant.stages.translate === 'done' &&
              variant.questionStatus === 'ready' &&
              variant.audioStatus === 'failed'
            ) {
              variant.audioStatus = 'skipped';
              variant.audioKey = null;
              variant.status = 'text_only';
              await variant.save({ session });
            }
          }
        }

        const variants = await Variant.find({ instructionId: instruction._id }).session(session);
        if (variants.length === 0 || variants.some((variant) => !['ready', 'text_only'].includes(variant.status))) {
          throw new AppError('INSTRUCTION_NOT_READY');
        }
        const byLanguage = new Map(variants.map((variant) => [variant.language, variant]));

        const workers = await Worker.find({
          _id: { $in: instruction.audienceWorkerIds },
          orgId,
          archivedAt: null,
        })
          .select('_id language')
          .session(session)
          .lean();

        if (workers.length === 0) throw new AppError('INSTRUCTION_NOT_READY');

        const rawToken = randomToken(32);
        const now = new Date();
        const updated = await Instruction.findOneAndUpdate(
          { _id: instruction._id, orgId, status: instruction.status },
          {
            $set: {
              status: 'shared',
              shareTokenHash: tokenHash(rawToken),
              shareTokenEnc: encryptedSecret(rawToken),
              shareTokenIssuedAt: now,
              shareTokenRevokedAt: null,
              sharedAt: now,
              sharedBy: req.auth!.userId,
            },
          },
          { new: true, session },
        );
        if (!updated) throw new AppError('SHARE_CONFLICT');

        const deliveries = workers.map((worker) => {
          const variant =
            byLanguage.get(worker.language) ??
            byLanguage.get(instruction.sourceLanguage) ??
            variants.find((candidate) => candidate.status === 'ready');
          if (!variant) throw new AppError('PIPELINE_FAILED');
          return {
            orgId,
            instructionId: instruction._id,
            workerId: worker._id,
            variantId: variant._id,
            language: variant.language,
            status: 'pending',
            attempts: [],
            deliveryTokens: [],
            help: { requested: false, reason: null, requestedAt: null, resolvedAt: null, resolvedBy: null },
            channel: 'link',
          };
        });

        await Delivery.insertMany(deliveries, { session });

        return {
          token: rawToken,
          deliveriesCreated: deliveries.length,
          archivedDropped: instruction.audienceWorkerIds.length - workers.length,
        };
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError('SHARE_CONFLICT');
      throw error;
    } finally {
      await session.endSession();
    }

    if (!outcome) throw new AppError('INTERNAL');
    const url = `${config.APP_URL}/i/${outcome.token}`;
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId }).lean();
    if (!instruction) throw new AppError('NOT_FOUND');
    const messages = shareMessages({ url, instruction });

    sendData(res, {
      url,
      whatsappMessage: messages.whatsappMessage,
      deliveriesCreated: outcome.deliveriesCreated,
      archivedDropped: outcome.archivedDropped,
    });
  }),
);

sharingRouter.get(
  '/instructions/:id/share-link',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId }).lean();
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canReadShareLink(instruction.status) || !instruction.shareTokenEnc) throw new AppError('NOT_FOUND');

    let token: string;
    try {
      token = decryptSecret(instruction.shareTokenEnc);
    } catch {
      throw new AppError('NOT_FOUND');
    }
    const url = `${config.APP_URL}/i/${token}`;
    const messages = shareMessages({ url, instruction });

    sendData(res, {
      url,
      issuedAt: instruction.shareTokenIssuedAt ?? null,
      whatsappMessage: messages.whatsappMessage,
      reminderMessage: messages.reminderMessage,
    });
  }),
);

sharingRouter.post(
  '/instructions/:id/regenerate-link',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canRegenerateLink(instruction.status)) throw new AppError('CONFLICT_STATE');

    const token = randomToken(32);
    instruction.shareTokenHash = tokenHash(token);
    instruction.shareTokenEnc = encryptedSecret(token);
    instruction.shareTokenIssuedAt = new Date();
    instruction.shareTokenRevokedAt = new Date();
    await instruction.save();

    sendData(res, { url: `${config.APP_URL}/i/${token}` });
  }),
);

sharingRouter.post(
  '/instructions/:id/archive',
  asyncHandler(async (req, res) => {
    const instruction = await Instruction.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!instruction) throw new AppError('NOT_FOUND');
    if (!canArchive(instruction.status)) throw new AppError('CONFLICT_STATE');

    instruction.status = 'archived';
    instruction.archivedAt = new Date();
    await instruction.save();

    sendData(res, { status: 'archived' });
  }),
);
