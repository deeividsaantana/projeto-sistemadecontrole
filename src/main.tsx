import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { APP_VERSION } from './app/version';
import './index.css';
import '@fontsource-variable/outfit';
import '@fontsource-variable/geist';
import { isPublicLinkUrl } from './app/routing/publicRoutes';
import { parsePrivatePath } from './app/routing/privateRoutes';
import { isSupabaseCloudEnabled } from './platform/cloudProvider';
import { mirrorReneaLocalStorage, restoreMissingReneaLocalStorage, startReneaStorageMirror } from './utils/resilientStorage';
import { instalarReservaEmMemoria, registrarPendentesDaReserva } from './utils/reservaArmazenamento';

const startApplication = async () => {
  // Um service worker de um build anterior pode continuar controlando o
  // localhost e devolver index.html no lugar de módulos .tsx do Vite.
  // Em desenvolvimento, remova esse controle antes de iniciar a aplicação.
  if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  // Antes de qualquer leitura: memória cheia não pode fazer o envio publicar cópia antiga.
  // O que não coube vai na hora para a cópia de recuperação (IndexedDB, bem
  // maior), para um F5 antes do envio à nuvem não perder o que foi lançado.
  let espelhoAgendado = 0;
  const reserva = instalarReservaEmMemoria(window.localStorage, chave => {
    console.warn(`A memória do navegador está cheia; ${chave} fica guardado na cópia de recuperação até a próxima sincronização.`);
    window.clearTimeout(espelhoAgendado);
    espelhoAgendado = window.setTimeout(() => void mirrorReneaLocalStorage(reserva), 0);
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
    // Guarda global de movimento reduzido para o GSAP, instalada antes da
    // primeira tela animar. Carrega junto com o app (o GSAP já faz parte
    // dele); os links públicos ficam de fora para seguirem leves e usam a
    // guarda local de cada tela.
    const guardaDeMovimento = import('./shared/motion/guardaDeMovimento')
      .then(({ instalarGuardaDeMovimento }) => { instalarGuardaDeMovimento(); })
      .catch(error => { console.warn('Guarda de movimento indisponível; as telas seguem com a guarda local.', error); });
    const privateRoute = parsePrivatePath(window.location.pathname);
    if (privateRoute && isSupabaseCloudEnabled) {
      const [{ PrivateRouteApp }] = await Promise.all([import('./app/routing/PrivateRouteApp'), guardaDeMovimento]);
      root.render(<StrictMode><AppProviders><PrivateRouteApp route={privateRoute} /></AppProviders></StrictMode>);
    } else {
      const pendentes = await restoreMissingReneaLocalStorage(reserva);
      registrarPendentesDaReserva(pendentes);
      const [{ default: App }] = await Promise.all([import('./App'), guardaDeMovimento]);
      root.render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>);
    }
    startReneaStorageMirror(reserva);
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Service worker indisponível; a operação local continua ativa.', error);
    });
  }
};

void startApplication();
