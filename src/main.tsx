import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { APP_VERSION } from './app/version';
import './index.css';
import '@fontsource-variable/outfit';
import '@fontsource-variable/geist';
import { isPublicLinkUrl } from './app/routing/publicRoutes';
import { parsePrivatePath } from './app/routing/privateRoutes';
import { PrivateRouteApp } from './app/routing/PrivateRouteApp';
import { isSupabaseCloudEnabled } from './platform/cloudProvider';
import { restoreMissingReneaLocalStorage, startReneaStorageMirror } from './utils/resilientStorage';
import { instalarReservaEmMemoria } from './utils/reservaArmazenamento';

const startApplication = async () => {
  // Antes de qualquer leitura: memória cheia não pode fazer o envio publicar cópia antiga.
  instalarReservaEmMemoria(window.localStorage, chave => {
    console.warn(`A memória do navegador está cheia; ${chave} fica em memória até a próxima sincronização.`);
  });
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
    const privateRoute = parsePrivatePath(window.location.pathname);
    if (privateRoute && isSupabaseCloudEnabled) {
      root.render(<StrictMode><AppProviders><PrivateRouteApp route={privateRoute} /></AppProviders></StrictMode>);
    } else {
      const [{ default: App }] = await Promise.all([
        import('./App.tsx'),
        restoreMissingReneaLocalStorage(),
      ]);
      root.render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>);
    }
    startReneaStorageMirror();
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Service worker indisponível; a operação local continua ativa.', error);
    });
  }
};

void startApplication();
