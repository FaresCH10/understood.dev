import { lazy, Suspense, useEffect, useState } from 'react';
import { BrandLoadingBoundary } from '@understood/ui';

const WorkspaceApp = lazy(() => import('./WorkspaceApp'));
const loadPublicProduct = () => import('./landing/PublicProduct');
const PublicProduct = lazy(loadPublicProduct);

function preloadImage(src: string) {
  return new Promise<void>(resolve => {
    const image = new Image();
    image.onload = image.onerror = () => resolve();
    image.src = src;
  });
}

export default function App() {
  const [view, setView] = useState(() => location.hash.slice(1) || 'home');
  useEffect(() => {
    const update = () => setView(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const params = new URLSearchParams(location.search);
  const publicPage = location.pathname === '/' &&
    !['verify', 'reset', 'invite', 'token'].some(key => params.has(key));
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState(false);
  useEffect(() => {
    if (!publicPage) return;
    let active = true;
    void Promise.all([
      loadPublicProduct(),
      preloadImage('/landing/gulf-site.jpg'),
      preloadImage('/landing/site-worker.png'),
      document.fonts.ready,
    ]).then(
      () => { if (active) setLoading(false); },
      () => { if (active) { setStartupError(true); setLoading(false); } },
    );
    return () => { active = false; };
  }, [publicPage]);

  return <BrandLoadingBoundary loading={loading}>
    {covered => <Suspense fallback={null}>
      {publicPage
        ? !covered && (startupError
          ? <main role="alert">This page couldn’t load. <button onClick={() => location.reload()}>Reload page</button></main>
          : <PublicProduct view={view} registrationAvailable />)
        : <WorkspaceApp onLoadingChange={setLoading} />}
    </Suspense>}
  </BrandLoadingBoundary>;
}
