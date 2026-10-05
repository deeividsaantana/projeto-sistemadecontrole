// Servidor único do RENEA ERP para hospedagem sem cartão (Render free).
// Serve o build do frontend (dist/) e a API (handlers em api/) no mesmo
// domínio, em /api/... O front não precisa saber onde está hospedado.
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toExpressHandler } from './handlerAdapter.js';

import { handler as publicPresenca } from '../api/public-presenca.js';
import { handler as publicTickets } from '../api/public-tickets.js';
import { handler as publicMateriais } from '../api/public-materiais.js';
import { handler as masterData } from '../api/master-data.js';
import { handler as usageTelemetry } from '../api/usage-telemetry.js';
import { handler as cleanupCloudData } from '../api/cleanup-cloud-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');
// Corpo cru como string: os handlers fazem o próprio parse/limite de tamanho
// (parseJsonBody em firebase-admin.js), no formato de evento que os handlers esperam.
app.use(express.text({ type: '*/*', limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

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

  app.get(`${prefix}/public-materiais`, toExpressHandler(publicMateriais));
  app.post(`${prefix}/public-materiais`, toExpressHandler(publicMateriais));

  app.all(`${prefix}/master-data`, toExpressHandler(masterData));
  app.all(`${prefix}/usage-telemetry`, toExpressHandler(usageTelemetry));
}

// Não existe cron nativo no plano gratuito: um pinger externo gratuito (cron-job.org,
// sem cartão) chama esta rota 1x/dia com o segredo configurado no painel.
app.post('/tasks/cleanup-cloud-data', async (req, res) => {
  const expected = process.env.CLEANUP_TASK_SECRET || '';
  const provided = String(req.headers['x-task-secret'] || '');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const matches = expected
    && expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  if (!matches) {
    res.status(403).json({ success: false, message: 'Segredo da tarefa ausente ou inválido.' });
    return;
  }
  const result = await cleanupCloudData();
  res.status(Number(result?.statusCode) || 200).send(result?.body ?? '');
});

// Pinger de manutenção (UptimeRobot, cron-job.org): evita o serviço dormir
// no plano gratuito e serve como checagem simples de saúde.
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.use(express.static(distDir, {
  maxAge: '1y',
  index: false,
  setHeaders: (res, filePath) => {
    // O browser consulta o service worker para saber se existe uma versão nova.
    // Cache de um ano aqui fazia um deploy continuar servindo o shell antigo.
    if (filePath.endsWith('service-worker.js') || filePath.endsWith('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`RENEA ERP no ar em http://localhost:${port}`);
});
