import type { NextFunction, Request, Response } from 'express';
import { LANGUAGES, computeDisplayNames, type Language } from '@understood/shared';
import { AppError } from '../../errors.js';
import { Delivery, Instruction, Organization, Variant, Worker, type DeliveryDoc, type InstructionDoc, type VariantDoc } from '../../models.js';
import { verifyPreviewToken, tokenHash } from '../../auth/tokens.js';
import { getStorage } from '../../media/storage.js';

export interface WorkerAuthContext {
  delivery: DeliveryDoc;
  instruction: InstructionDoc;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      workerAuth?: WorkerAuthContext;
    }
  }
}

export function bearerToken(req: Request): string {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? '';
}

export async function shareContext(req: Request): Promise<InstructionDoc> {
  const token = typeof req.params.token === 'string' ? req.params.token : '';
  if (!token) throw new AppError('LINK_UNAVAILABLE');
  const instruction = await Instruction.findOne({ shareTokenHash: tokenHash(token), status: 'shared' }).lean<InstructionDoc>();
  if (!instruction) throw new AppError('LINK_UNAVAILABLE');
  return instruction;
}

export async function deliveryAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) throw new AppError('DELIVERY_TOKEN_INVALID');
    if (verifyPreviewToken(token)) throw new AppError('PREVIEW_MODE');

    const hash = tokenHash(token);
    const delivery = await Delivery.findOne({ 'deliveryTokens.hash': hash }).lean<DeliveryDoc>();
    if (!delivery) throw new AppError('DELIVERY_TOKEN_INVALID');

    const instruction = await Instruction.findOne({ _id: delivery.instructionId, orgId: delivery.orgId }).lean<InstructionDoc>();
    if (!instruction) throw new AppError('DELIVERY_TOKEN_INVALID');
    if (instruction.status !== 'shared') throw new AppError('LINK_UNAVAILABLE');

    const seenAt = delivery.deliveryTokens.find((entry) => entry.hash === hash)?.lastSeenAt;
    if (!seenAt || Date.now() - new Date(seenAt).getTime() > 60_000) {
      await Delivery.updateOne(
        { _id: delivery._id, 'deliveryTokens.hash': hash },
        { $set: { 'deliveryTokens.$.lastSeenAt': new Date() } },
      ).catch(() => undefined);
    }

    req.workerAuth = { delivery, instruction };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWorkerAuth(req: Request): WorkerAuthContext {
  if (!req.workerAuth) throw new AppError('DELIVERY_TOKEN_INVALID');
  return req.workerAuth;
}

export async function previewInstruction(previewToken: string): Promise<InstructionDoc> {
  const payload = verifyPreviewToken(previewToken);
  if (!payload) throw new AppError('LINK_UNAVAILABLE');
  const instruction = await Instruction.findById(payload.instructionId).lean<InstructionDoc>();
  if (!instruction || !['ready', 'partial_failure', 'shared'].includes(instruction.status)) {
    throw new AppError('LINK_UNAVAILABLE');
  }
  return instruction;
}

export async function availableVariants(instructionId: string): Promise<VariantDoc[]> {
  const variants = await Variant.find({ instructionId }).lean<VariantDoc[]>();
  const usable = variants.filter((variant) => variant.status === 'ready' || variant.status === 'text_only');
  const order = new Map<Language, number>(LANGUAGES.map((language, index) => [language, index]));
  return usable.sort((a, b) => (order.get(a.language) ?? 99) - (order.get(b.language) ?? 99));
}

export interface MetaResponse {
  org: { name: string };
  instruction: { title: string | null; titleVariants: Partial<Record<Language, string | null>>; type: string };
  availableLanguages: Language[];
  audience: Array<{ id: string; displayName: string; firstName: string; lastInitial: string; language: Language }>;
  preview: boolean;
}

export async function buildMeta(instruction: InstructionDoc): Promise<MetaResponse> {
  const [org, variants, deliveries] = await Promise.all([
    Organization.findById(instruction.orgId).select('name').lean(),
    availableVariants(String(instruction._id)),
    Delivery.find({ instructionId: instruction._id }).select('workerId language').lean(),
  ]);
  if (!org) throw new AppError('LINK_UNAVAILABLE');

  const titleVariants: Partial<Record<Language, string | null>> = {};
  for (const variant of variants) titleVariants[variant.language] = variant.title ?? null;

  const deliveryLanguage = new Map(deliveries.map((delivery) => [String(delivery.workerId), delivery.language]));
  const workerIds = deliveries.length > 0 ? deliveries.map((delivery) => delivery.workerId) : instruction.audienceWorkerIds;
  const workers = await Worker.find({ _id: { $in: workerIds }, orgId: instruction.orgId })
    .select('_id name language')
    .sort({ name: 1 })
    .lean();

  const names = computeDisplayNames(
    workers.map((worker) => ({ id: String(worker._id), name: worker.name, language: worker.language })),
  );
  const byId = new Map(names.map((entry) => [entry.id, entry]));

  return {
    org: { name: org.name },
    instruction: { title: instruction.title ?? null, titleVariants, type: instruction.type },
    availableLanguages: variants.map((variant) => variant.language),
    audience: workers.map((worker) => {
      const entry = byId.get(String(worker._id));
      return {
        id: String(worker._id),
        displayName: entry?.displayName ?? worker.name,
        firstName: entry?.firstName ?? worker.name,
        lastInitial: entry?.lastInitial ?? '',
        language: deliveryLanguage.get(String(worker._id)) ?? worker.language,
      };
    }),
    preview: false,
  };
}

async function signedMedia(key: string | null | undefined): Promise<{ url: string | null; expiresAt: string | null }> {
  if (!key) return { url: null, expiresAt: null };
  try {
    const signed = await getStorage().signedUrl(key);
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  } catch {
    return { url: null, expiresAt: null };
  }
}

export interface ContentResponse {
  title: string | null;
  type: string;
  text: string | null;
  audioUrl: string | null;
  audioExpiresAt: string | null;
  photoUrl: string | null;
  photoExpiresAt: string | null;
  question: { text: string; options: string[]; correctIndex?: 0 | 1 | 2; selectedIndex?: 0 | 1 | 2 } | null;
  preview: boolean;
}

export async function buildContent(
  instruction: InstructionDoc,
  variant: VariantDoc | null,
  options: { preview: boolean; revealCorrect?: boolean; selectedIndex?: 0 | 1 | 2 | null },
): Promise<ContentResponse> {
  const [audio, photo] = await Promise.all([
    signedMedia(variant?.audioKey),
    signedMedia(instruction.content.photoKey),
  ]);

  let question: ContentResponse['question'] = null;
  if (variant?.question && variant.questionStatus === 'ready') {
    question = { text: variant.question.text, options: [...variant.question.options] };
    if (options.revealCorrect) question.correctIndex = variant.question.correctIndex;
    if (options.selectedIndex !== undefined && options.selectedIndex !== null) {
      question.selectedIndex = options.selectedIndex;
    }
  }

  return {
    title: variant?.title ?? instruction.title ?? null,
    type: instruction.type,
    text: variant?.text ?? null,
    audioUrl: audio.url,
    audioExpiresAt: audio.expiresAt,
    photoUrl: photo.url,
    photoExpiresAt: photo.expiresAt,
    question,
    preview: options.preview,
  };
}

export async function loadVariantForDelivery(delivery: DeliveryDoc): Promise<VariantDoc | null> {
  const variant = await Variant.findOne({ _id: delivery.variantId, instructionId: delivery.instructionId }).lean<VariantDoc>();
  return variant ?? null;
}
