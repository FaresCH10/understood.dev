import { z } from 'zod';
import { LANGUAGES, parseLanguage } from './languages.js';
import { CONTENT_KINDS, HELP_REASONS, INSTRUCTION_TYPES } from './enums.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-character id');
export const languageSchema = z.enum(LANGUAGES);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const magicLinkRequestSchema = z.object({ email: emailSchema }).strict();

export const orgPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    locale: z.enum(['en', 'ar']).optional(),
  })
  .strict();

export const crewCreateSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();
export const crewPatchSchema = z
  .object({ name: z.string().trim().min(1).max(80).optional(), archived: z.boolean().optional() })
  .strict();

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'must be E.164 (+ and 8-15 digits)');

export const workerCreateSchema = z
  .object({
    crewId: objectIdSchema,
    name: z.string().trim().min(1).max(80),
    language: languageSchema,
    phoneE164: phoneSchema.optional(),
  })
  .strict();

export const workerPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    language: languageSchema.optional(),
    phoneE164: phoneSchema.nullish(),
    archived: z.boolean().optional(),
  })
  .strict();

export const importRowSchema = z.object({
  row: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  language: languageSchema,
  phoneE164: phoneSchema.nullable(),
  crewName: z.string().trim().min(1).max(80).nullable(),
});

export const instructionPatchSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    type: z.enum(INSTRUCTION_TYPES).optional(),
    sourceLanguage: languageSchema.optional(),
    content: z
      .object({
        kind: z.enum(CONTENT_KINDS).optional(),
        text: z.string().max(2000).nullable().optional(),
        transcript: z.string().max(4000).nullable().optional(),
        transcriptStatus: z.enum(['pending', 'ready', 'failed', 'confirmed']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const generateSchema = z
  .object({
    crewId: objectIdSchema,
    audienceWorkerIds: z.array(objectIdSchema).min(1).max(1000).optional(),
  })
  .strict();

export const questionSchema = z
  .object({
    text: z.string().trim().min(1).max(140),
    options: z
      .array(z.string().trim().min(1).max(60))
      .length(3)
      .refine((options) => new Set(options).size === 3, 'options must be unique'),
    correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  })
  .strict();

export const variantPatchSchema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    title: z.string().trim().max(120).nullable().optional(),
    question: questionSchema.optional(),
  })
  .strict()
  .refine((body) => body.text !== undefined || body.title !== undefined || body.question !== undefined, {
    message: 'at least one field is required',
  });

export const shareSchema = z.object({ acceptTextOnly: z.boolean().optional() }).strict();

export const identifySchema = z
  .object({ workerId: objectIdSchema, language: languageSchema.optional() })
  .strict();

export const answerSchema = z
  .object({ optionIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]) })
  .strict();

export const helpSchema = z.object({ reason: z.enum(HELP_REASONS) }).strict();
export const languageChangeSchema = z.object({ language: languageSchema }).strict();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(512).optional(),
});

export const instructionListQuerySchema = z.object({
  status: z.enum(['shared', 'archived', 'all']).default('shared'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(512).optional(),
});

export const deliveriesQuerySchema = z.object({
  filter: z.enum(['all', 'not_opened', 'wrong', 'needs_help']).default('all'),
});

export const exportQuerySchema = z.object({
  includeHelpReasons: z.enum(['true', 'false']).default('true'),
  includeTimes: z.enum(['true', 'false']).default('true'),
});

export const resolveHelpSchema = z.object({}).strict();

export const deleteOrgSchema = z.object({ confirmName: z.string().min(1).max(120) }).strict();

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;
export type OrgPatch = z.infer<typeof orgPatchSchema>;
export type CrewCreate = z.infer<typeof crewCreateSchema>;
export type CrewPatch = z.infer<typeof crewPatchSchema>;
export type WorkerCreate = z.infer<typeof workerCreateSchema>;
export type WorkerPatch = z.infer<typeof workerPatchSchema>;
export type InstructionPatch = z.infer<typeof instructionPatchSchema>;
export type GenerateRequest = z.infer<typeof generateSchema>;
export type VariantPatch = z.infer<typeof variantPatchSchema>;
export type IdentifyRequest = z.infer<typeof identifySchema>;
export type AnswerRequest = z.infer<typeof answerSchema>;
export type HelpRequest = z.infer<typeof helpSchema>;

export function parseImportLanguage(value: string): string | null {
  return parseLanguage(value);
}
