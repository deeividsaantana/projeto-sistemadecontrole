// Entry point do Cloud Functions. Serve os mesmos handlers de api/, nos
// mesmos caminhos relativos que o frontend chama (/api/...). O build
// (functions/build.mjs) resolve estes imports relativos com o esbuild antes
// do deploy; a lógica de negócio continua inteiramente em api/, sem duplicação.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import express from 'express';
import { toExpressHandler } from './handlerAdapter.js';

import { handler as publicPresenca } from '../../api/public-presenca.js';
import { handler as publicTickets } from '../../api/public-tickets.js';
import { handler as masterData } from '../../api/master-data.js';
import { handler as usageTelemetry } from '../../api/usage-telemetry.js';
import { handler as cleanupCloudData } from '../../api/cleanup-cloud-data.js';

const app = express();
app.disable('x-powered-by');
app.use(express.text({ type: '*/*', limit: '2mb' }));

// A API vive em /api/. O prefixo antigo /.netlify/functions/ continua
// respondendo com os mesmos handlers para não quebrar quem ainda está com o
// app antigo aberto, service worker em cache ou fila offline gravada antes
// da troca. Pode sair depois que todos os aparelhos atualizarem.
for (const prefix of ['/api', '/.netlify/functions']) {
  app.get(`${prefix}/public-presenca`, toExpressHandler(publicPresenca));
  app.post(`${prefix}/public-presenca`, toExpressHandler(publicPresenca));
  app.patch(`${prefix}/public-presenca`, toExpressHandler(publicPresenca));
  app.delete(`${prefix}/public-presenca`, toExpressHandler(publicPresenca));

  app.get(`${prefix}/public-tickets`, toExpressHandler(publicTickets));
  app.post(`${prefix}/public-tickets`, toExpressHandler(publicTickets));

  app.all(`${prefix}/master-data`, toExpressHandler(masterData));
  app.all(`${prefix}/usage-telemetry`, toExpressHandler(usageTelemetry));
}

export const api = onRequest({ region: 'southamerica-east1', cors: false }, app);

// O Cloud Scheduler substitui o pinger externo que a hospedagem sem cartão
// (Render) precisaria: 03:15 UTC, nativo, sem serviço terceiro.
export const cleanupCloudDataScheduled = onSchedule(
  { schedule: '15 3 * * *', timeZone: 'Etc/UTC', region: 'southamerica-east1' },
  async () => {
    await cleanupCloudData();
  },
);
