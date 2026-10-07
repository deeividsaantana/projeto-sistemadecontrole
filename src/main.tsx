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
import { mirrorReneaLocalStorage, restoreMissingReneaLocalStorage, startReneaStorageMirror } from './utils/resilientStorage';
import { instalarReservaEmMemoria, registrarPendentesDaReserva } from './utils/reservaArmazenamento';

const startApplication = async () => {
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
    const privateRoute = parsePrivatePath(window.location.pathname);
    if (privateRoute) {
      root.render(<StrictMode><AppProviders><PrivateRouteApp route={privateRoute} /></AppProviders></StrictMode>);
    } else {
      const [{ default: App }] = await Promise.all([import('./App.tsx')]);
      root.render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>);
      void restoreMissingReneaLocalStorage(reserva)
        .then(registrarPendentesDaReserva)
        .catch(error => console.warn('Não foi possível restaurar a reserva local imediatamente.', error));
    }
    startReneaStorageMirror(reserva);
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Service worker indisponível; a operação local continua ativa.', error);
    });
  }
};

void startApplication().catch(error => {
  console.error('Falha ao iniciar o aplicativo RENEA.', error);
  const root = document.getElementById('root');
  if (!root) return;
  const message = error instanceof Error ? error.message : String(error || 'Falha desconhecida');
  root.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui;color:#0f172a"><section style="max-width:640px;border:1px solid #fecaca;padding:24px"><h1 style="margin:0 0 12px;font-size:24px">Não foi possível iniciar o sistema.</h1><p style="margin:0;color:#475569">Atualize a página. Se o erro continuar, envie esta mensagem:</p><pre style="margin-top:16px;white-space:pre-wrap;color:#991b1b">${message.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character] || character))}</pre></section></main>`;
});
