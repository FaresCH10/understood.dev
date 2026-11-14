import type { ReactElement } from 'react';

const ICONS: Record<string, ReactElement> = {
  home: (<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></>),
  doc: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  settings: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></>),
  plus: (<><path d="M12 5v14M5 12h14"/></>),
  chevronRight: (<><path d="m9 18 6-6-6-6"/></>),
  chevronDown: (<><path d="m6 9 6 6 6-6"/></>),
  search: (<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>),
  check: (<><path d="m20 6-11 11-5-5"/></>),
  checkCircle: (<><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></>),
  x: (<><path d="M18 6 6 18M6 6l12 12"/></>),
  alertTriangle: (<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>),
  alertCircle: (<><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></>),
  clock: (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  mic: (<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></>),
  play: (<><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></>),
  pause: (<><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/></>),
  copy: (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
  download: (<><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></>),
  share: (<><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 16V3"/><path d="m7 8 5-5 5 5"/></>),
  message: (<><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/></>),
  qr: (<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14h1M14 20h1M20 20h1"/></>),
  globe: (<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></>),
  edit: (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></>),
  refresh: (<><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></>),
  arrowLeft: (<><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>),
  arrowRight: (<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>),
  lock: (<><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
  dots: (<><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></>),
  sparkles: (<><path d="m12 3 1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z"/><path d="M19 15.5 20 18l2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>),
  external: (<><path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>),
  send: (<><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>),
  wifiOff: (<><path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.3"/><path d="M2 8.8a15 15 0 0 1 5-3"/><path d="M15 5.8a15 15 0 0 1 7 3"/><path d="M19 12.5a10 10 0 0 0-2-1.3"/><path d="M12 20h.01"/></>),
  filter: (<><path d="M3 5h18l-7 8v6l-4 2v-8z"/></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
  help: (<><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2-2.4 3.6"/><path d="M12 17h.01"/></>),
  loader: (<><path d="M21 12a9 9 0 1 1-6.2-8.6" /></>),
};

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={`ic ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name] ?? null}
    </svg>
  );
}

export function BrandMark({ size = 32, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? '#ECFDF5' : '#0F766E';
  const fg = inverse ? '#0F766E' : '#FFFFFF';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="9" fill={bg} />
      <path d="M9.5 20v-8M16 22V10M22.5 18v-4" stroke={fg} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
