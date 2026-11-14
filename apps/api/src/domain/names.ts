export function normalizeWorkerName(name: string): string {
  return name
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function defaultUserName(email: string): string {
  const local = email.split('@')[0] ?? 'Owner';
  return local.replace(/[._-]+/g, ' ').trim().slice(0, 80) || 'Owner';
}

export function defaultOrgName(email: string): string {
  const domain = email.split('@')[1] ?? '';
  const label = domain.split('.')[0] ?? '';
  if (!label || ['gmail', 'outlook', 'yahoo', 'hotmail', 'icloud', 'protonmail'].includes(label)) {
    return 'My organization';
  }
  return `${label.charAt(0).toLocaleUpperCase()}${label.slice(1)}`;
}
