import { HELP_REASON_LABELS, computeDisplayNames } from '@understood/shared';
import { config } from '../../config.js';
import { sendEmail } from '../../email/mailer.js';
import { logger } from '../../logger.js';
import { Delivery, Instruction, User, Worker } from '../../models.js';

export interface HelpAlertPayload {
  orgId: string;
  instructionId: string;
}

export async function runHelpAlertJob(payload: HelpAlertPayload): Promise<void> {
  const [instruction, users] = await Promise.all([
    Instruction.findOne({ _id: payload.instructionId, orgId: payload.orgId }).select('title').lean(),
    User.find({ orgId: payload.orgId }).select('email').lean(),
  ]);
  if (!instruction || users.length === 0) return;

  const deliveries = await Delivery.find({
    orgId: payload.orgId,
    instructionId: payload.instructionId,
    'help.requested': true,
    'help.resolvedAt': null,
  }).lean();
  if (deliveries.length === 0) return;

  const workers = await Worker.find({ _id: { $in: deliveries.map((delivery) => delivery.workerId) } })
    .select('_id name language')
    .lean();
  const names = computeDisplayNames(workers.map((worker) => ({ id: String(worker._id), name: worker.name, language: worker.language })));
  const byId = new Map(names.map((entry) => [entry.id, entry]));

  const lines = deliveries.map((delivery) => {
    const name = byId.get(String(delivery.workerId))?.displayName ?? 'A worker';
    const reason = delivery.help.reason ? HELP_REASON_LABELS[delivery.help.reason] : 'Needs help';
    return `- ${name} (${delivery.language.toUpperCase()}) — ${reason}`;
  });

  const title = instruction.title?.trim() || 'An instruction';
  const boardUrl = `${config.APP_URL}/instructions/${payload.instructionId}`;
  const subject = `${deliveries.length} worker${deliveries.length === 1 ? '' : 's'} asked for help`;
  const text = [
    `${deliveries.length} worker${deliveries.length === 1 ? '' : 's'} asked for help with "${title}".`,
    '',
    ...lines,
    '',
    `Open the board to follow up: ${boardUrl}`,
  ].join('\n');

  const results = await Promise.allSettled(
    users.map((user) =>
      sendEmail({ to: user.email, subject, text, template: 'help_alert', orgId: payload.orgId }),
    ),
  );
  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed > 0) logger.warn({ orgId: payload.orgId, instructionId: payload.instructionId, failed }, 'help alert partially failed');
}
