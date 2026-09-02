// Entry point do Cloud Functions. Serve as mesmas 7 funções que já existem
// em netlify/functions/, nos mesmos caminhos relativos que o frontend chama
// (/.netlify/functions/...) — nada muda no app, nenhum link de presença já
// distribuído quebra. O build (functions/build.mjs) resolve estes imports
// relativos com o esbuild antes do deploy; a lógica de negócio continua
// inteiramente em netlify/functions/, sem duplicação.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import express from 'express';
import { toExpressHandler } from './netlifyAdapter.js';

import { handler as publicPresenca } from '../../netlify/functions/public-presenca.js';
import { handler as publicTickets } from '../../netlify/functions/public-tickets.js';
import { handler as masterData } from '../../netlify/functions/master-data.js';
import { handler as usageTelemetry } from '../../netlify/functions/usage-telemetry.js';
import { handler as syncCombustivelOnedrive } from '../../netlify/functions/sync-combustivel-onedrive.js';
import { handler as cleanupCloudData } from '../../netlify/functions/cleanup-cloud-data.js';

const app = express();
app.disable('x-powered-by');
app.use(express.text({ type: '*/*', limit: '2mb' }));

app.get('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.post('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.patch('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.delete('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));

app.get('/.netlify/functions/public-tickets', toExpressHandler(publicTickets));
app.post('/.netlify/functions/public-tickets', toExpressHandler(publicTickets));

app.all('/.netlify/functions/master-data', toExpressHandler(masterData));
app.all('/.netlify/functions/usage-telemetry', toExpressHandler(usageTelemetry));
app.all('/.netlify/functions/sync-combustivel-onedrive', toExpressHandler(syncCombustivelOnedrive));

export const api = onRequest({ region: 'southamerica-east1', cors: false }, app);

// O Cloud Scheduler substitui o pinger externo que a hospedagem sem cartão
// (Render) precisaria: mesmo horário do schedule que já existia no
// netlify.toml, nativo, sem serviço terceiro.
export const cleanupCloudDataScheduled = onSchedule(
  { schedule: '15 3 * * *', timeZone: 'Etc/UTC', region: 'southamerica-east1' },
  async () => {
    await cleanupCloudData();
  },
);
