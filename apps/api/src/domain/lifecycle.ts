import type { DeliveryStatus, InstructionStatus, VariantStatus } from '@understood/shared';

export function canPatchInstruction(status: InstructionStatus): boolean {
  return status === 'draft';
}

export function canGenerate(status: InstructionStatus): boolean {
  return status === 'draft';
}

export function canEditVariant(instructionStatus: InstructionStatus): boolean {
  return instructionStatus === 'ready' || instructionStatus === 'partial_failure';
}

export function canShare(status: InstructionStatus, acceptTextOnly: boolean): boolean {
  return status === 'ready' || (status === 'partial_failure' && acceptTextOnly);
}

export function canRegenerateLink(status: InstructionStatus): boolean {
  return status === 'shared';
}

export function canArchive(status: InstructionStatus): boolean {
  return status === 'shared';
}

export function canReadShareLink(status: InstructionStatus): boolean {
  return status === 'shared' || status === 'archived';
}

export function canDeleteInstruction(status: InstructionStatus): boolean {
  return status === 'draft';
}

export function canIdentify(instructionStatus: InstructionStatus, hasDelivery: boolean): boolean {
  return instructionStatus === 'shared' && hasDelivery;
}

export function canAnswer(status: DeliveryStatus, attemptsCount: number): boolean {
  return (status === 'opened' || status === 'answered') && attemptsCount < 2;
}

export function canComplete(status: DeliveryStatus, attemptsCount: number): 'complete' | 'replay' | 'blocked' {
  if (status === 'completed') return 'replay';
  if (status === 'answered' && attemptsCount >= 1) return 'complete';
  return 'blocked';
}

export function canRequestHelp(status: DeliveryStatus): boolean {
  return status === 'opened' || status === 'answered' || status === 'completed';
}

export function canResolveHelp(helpRequested: boolean): boolean {
  return helpRequested;
}

export const TERMINAL: readonly VariantStatus[] = ['ready', 'failed', 'text_only'];

export function instructionStatusFromVariants(
  variants: Array<{ status: VariantStatus }>,
): Exclude<InstructionStatus, 'draft' | 'shared' | 'archived'> {
  if (variants.length === 0) return 'processing';
  if (variants.every((variant) => variant.status === 'ready')) return 'ready';
  if (variants.every((variant) => TERMINAL.includes(variant.status))) return 'partial_failure';
  return 'processing';
}

export function isTerminalVariant(status: VariantStatus): boolean {
  return TERMINAL.includes(status);
}
