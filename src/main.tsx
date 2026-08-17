import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { APP_VERSION } from './app/version';
import './index.css';
import { isPublicLinkUrl } from './app/routing/publicRoutes';
import { restoreMissingReneaLocalStorage, startReneaStorageMirror } from './utils/resilientStorage';

const startApplication = async () => {
  document.documentElement.dataset.appVersion = APP_VERSION;
  const root = createRoot(document.getElementById('root')!);
  if (isPublicLinkUrl()) {
    const { default: PublicLinksApp } = await import('./PublicLinksApp');
    root.render(
      <StrictMode>
        <PublicLinksApp />
      </StrictMode>,
    );
  } else {
    const [{ default: App }] = await Promise.all([
      import('./App.tsx'),
      restoreMissingReneaLocalStorage(),
    ]);
    root.render(
      <StrictMode>
        <AppProviders>
          <App />
        </AppProviders>
      </StrictMode>,
    );
    startReneaStorageMirror();
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Service worker indisponível; a operação local continua ativa.', error);
    });
  }
};

void startApplication();
