import { Router } from 'express';
import { Types } from 'mongoose';
import { orgPatchSchema } from '@understood/shared';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { AiUsage, Crew, Delivery, Instruction, Organization, User, Worker } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { config } from '../../config.js';
import { afterWrite } from '../../domain/audit.js';

const orgRouter: Router = Router();
orgRouter.use(requireAuth);

orgRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.auth!.orgId);
    if (!org) throw new AppError('NOT_FOUND');

    const [crews, workers] = await Promise.all([
      Crew.countDocuments({ orgId: org._id, archivedAt: null }),
      Worker.countDocuments({ orgId: org._id, archivedAt: null }),
    ]);

    sendData(res, {
      id: String(org._id),
      name: org.name,
      timezone: org.timezone,
      locale: org.locale,
      plan: org.plan,
      counts: { crews, workers },
      createdAt: org.createdAt,
    });
  }),
);

orgRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const patch = parseBody(orgPatchSchema, req);
    const org = await Organization.findById(req.auth!.orgId);
    if (!org) throw new AppError('NOT_FOUND');

    if (patch.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: patch.timezone }).format(new Date());
      } catch {
        throw new AppError('VALIDATION_FAILED', [{ field: 'timezone', issue: 'must be a valid IANA timezone' }]);
      }
      org.timezone = patch.timezone;
    }
    if (patch.name !== undefined) org.name = patch.name;
    if (patch.locale !== undefined) org.locale = patch.locale;
    await org.save();

    sendData(res, {
      id: String(org._id),
      name: org.name,
      timezone: org.timezone,
      locale: org.locale,
      plan: org.plan,
    });
  }),
);

orgRouter.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const orgId = req.auth!.orgId;

    const [usage, instructionsSent, deliveries] = await Promise.all([
      AiUsage.aggregate<{ _id: null; chars: number }>([
        {
          $match: {
            orgId: new Types.ObjectId(orgId),
            createdAt: { $gte: periodStart, $lt: periodEnd },
            unitType: 'chars',
            stage: 'tts',
          },
        },
        { $group: { _id: null, chars: { $sum: '$units' } } },
      ]),
      Instruction.countDocuments({ orgId, sharedAt: { $gte: periodStart, $lt: periodEnd } }),
      Delivery.countDocuments({ orgId, createdAt: { $gte: periodStart, $lt: periodEnd } }),
    ]);

    const ttsChars = usage[0]?.chars ?? 0;
    const ttsMinutes = Math.round((ttsChars / 14 / 60) * 10) / 10;

    sendData(res, {
      periodStart,
      periodEnd,
      ttsChars,
      ttsMinutes,
      capMinutes: config.TTS_MONTHLY_MINUTES,
      instructionsSent,
      deliveries,
    });
  }),
);

orgRouter.post(
  '/delete',
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.auth!.orgId);
    if (!org) throw new AppError('NOT_FOUND');
    const body = req.body as { confirmName?: unknown };
    if (typeof body.confirmName !== 'string' || body.confirmName !== org.name) {
      throw new AppError('VALIDATION_FAILED', [{ field: 'confirmName', issue: 'must match the organization name' }]);
    }

    const users = await User.find({ orgId: org._id }).select('email').lean();
    org.deletingAt = new Date();
    await org.save();

    const { getQueue } = await import('../../jobs/queue.js');
    await getQueue().enqueue('cleanup', { orgId: String(org._id) }, { jobId: `org-delete_${org._id}` });
    await afterWrite('org_delete_requested', String(org._id), String(req.auth!.userId));

    const { sendEmail } = await import('../../email/mailer.js');
    await Promise.allSettled(
      users.map((user) =>
        sendEmail({
          to: user.email,
          subject: 'Your Understood organization is being deleted',
          text: `The organization "${org.name}" and its data are being deleted. If this was a mistake, contact support immediately.`,
          template: 'org_deletion',
          orgId: String(org._id),
        }),
      ),
    );

    const { revokeAllSessions } = await import('../../auth/sessions.js');
    await Promise.all(users.map((user) => revokeAllSessions(String(user._id))));

    sendData(res, { deletionQueued: true }, undefined, 202);
  }),
);

export default orgRouter;
