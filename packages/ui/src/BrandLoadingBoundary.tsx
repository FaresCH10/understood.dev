import { useEffect, useState, type ReactNode } from 'react';
import { BrandLoader } from './BrandLoader';

type Props = {
  loading: boolean;
  label?: string;
  language?: string;
  children: ReactNode | ((covered: boolean) => ReactNode);
};

// Keep content mounted so requests can finish, but block focus and interaction
// until both the request and the source logo's one-shot animation have finished.
export function BrandLoadingBoundary({ loading, label, language, children }: Props) {
  const [cycle, setCycle] = useState({ loading, finished: false, id: 0 });
  if (cycle.loading !== loading) {
    // Adjust before commit so even an instant request or reduced-motion cycle
    // cannot briefly expose content or miss its completion callback.
    setCycle({ loading, finished: loading ? false : cycle.finished, id: cycle.id + Number(loading) });
  }
  const covered = loading || !cycle.finished;
  useEffect(() => {
    if (!covered) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [covered]);

  return <>
    <div className="page-loading-content" inert={covered} aria-hidden={covered || undefined}
      style={covered ? { visibility: 'hidden' } : undefined}>
      {typeof children === 'function' ? children(covered) : children}
    </div>
    {covered && <BrandLoader key={cycle.id} label={label} language={language}
      onComplete={() => setCycle(current => current.id === cycle.id ? { ...current, finished: true } : current)} />}
  </>;
}
