import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@understood/design-tokens';
import './styles.css';
import { PreviewPage } from './PreviewPage';
import { SharePage } from './SharePage';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const pathname = window.location.pathname.startsWith(base) ? window.location.pathname.slice(base.length) : window.location.pathname;
const segments = pathname.split('/').filter(Boolean);

function Root() {
  if (segments[0] === 'preview' && segments[1]) {
    return <PreviewPage token={decodeURIComponent(segments[1])} />;
  }
  if (segments[0] === 'preview') {
    return <PreviewPage token="" />;
  }
  if (segments[0]) {
    return <SharePage token={decodeURIComponent(segments[0])} />;
  }
  return (
    <div className="w-app" dir="ltr">
      <div className="w-center">
        <img src="/i/icon.svg" width={64} height={64} alt="" />
        <h1 className="t-title" style={{ marginTop: 16 }}>
          Understood
        </h1>
        <p className="t-sub">Open the link your supervisor sent you.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/i/sw.js', { scope: '/i/' }).catch(() => undefined);
  });
}
