import { Types } from 'mongoose';
import { Delivery } from '../../models.js';

export interface DeliverySummary {
  targeted: number;
  opened: number;
  understood: number;
  helpCount: number;
}

export async function summarizeInstructions(
  instructionIds: Types.ObjectId[],
): Promise<Map<string, DeliverySummary>> {
  if (instructionIds.length === 0) return new Map();

  const rows = await Delivery.aggregate<{
    _id: Types.ObjectId;
    targeted: number;
    opened: number;
    understood: number;
    helpCount: number;
  }>([
    { $match: { instructionId: { $in: instructionIds } } },
    { $lookup: { from: 'instructions', localField: 'instructionId', foreignField: '_id', as: 'instruction' } },
    { $unwind: '$instruction' },
    {
      $group: {
        _id: '$instructionId',
        targeted: { $sum: 1 },
        opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
        understood: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$firstAttemptCorrect', true] },
                  { $ne: ['$completedAt', null] },
                  { $ne: ['$instruction.sharedAt', null] },
                  { $lte: ['$completedAt', { $add: ['$instruction.sharedAt', 24 * 60 * 60 * 1000] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        helpCount: { $sum: { $cond: [{ $eq: ['$help.requested', true] }, 1, 0] } },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      { targeted: row.targeted, opened: row.opened, understood: row.understood, helpCount: row.helpCount },
    ]),
  );
}
