// Servidor único do RENEA ERP para hospedagem sem cartão (Render free).
// Serve o build do frontend (dist/) e as mesmas 7 funções públicas, no mesmo
// domínio e nos mesmos caminhos relativos que o app já usa
// (/.netlify/functions/...). O front não precisa saber onde está hospedado.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toExpressHandler } from './netlifyAdapter.js';

import { handler as publicPresenca } from '../netlify/functions/public-presenca.js';
import { handler as publicTickets } from '../netlify/functions/public-tickets.js';
import { handler as masterData } from '../netlify/functions/master-data.js';
import { handler as usageTelemetry } from '../netlify/functions/usage-telemetry.js';
import { handler as syncCombustivelOnedrive } from '../netlify/functions/sync-combustivel-onedrive.js';
import { handler as cleanupCloudData } from '../netlify/functions/cleanup-cloud-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');
// Corpo cru como string: os handlers fazem o próprio parse/limite de tamanho
// (parseJsonBody em firebase-admin.js), igual ao que a Netlify já entrega.
app.use(express.text({ type: '*/*', limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

app.get('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.post('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.patch('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));
app.delete('/.netlify/functions/public-presenca', toExpressHandler(publicPresenca));

app.get('/.netlify/functions/public-tickets', toExpressHandler(publicTickets));
app.post('/.netlify/functions/public-tickets', toExpressHandler(publicTickets));

app.all('/.netlify/functions/master-data', toExpressHandler(masterData));
app.all('/.netlify/functions/usage-telemetry', toExpressHandler(usageTelemetry));
app.all('/.netlify/functions/sync-combustivel-onedrive', toExpressHandler(syncCombustivelOnedrive));

// A limpeza roda no Netlify por schedule (netlify.toml). Aqui não existe
// cron nativo no plano gratuito: um pinger externo gratuito (cron-job.org,
// sem cartão) chama esta rota 1x/dia com o segredo configurado no painel.
app.post('/tasks/cleanup-cloud-data', async (req, res) => {
  const expected = process.env.CLEANUP_TASK_SECRET || '';
  const provided = req.headers['x-task-secret'] || '';
  if (!expected || provided !== expected) {
    res.status(403).json({ success: false, message: 'Segredo da tarefa ausente ou inválido.' });
    return;
  }
  const result = await cleanupCloudData();
  res.status(Number(result?.statusCode) || 200).send(result?.body ?? '');
});

// Pinger de manutenção (UptimeRobot, cron-job.org): evita o serviço dormir
// no plano gratuito e serve como checagem simples de saúde.
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.use(express.static(distDir, { maxAge: '1y', index: false }));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`RENEA ERP no ar em http://localhost:${port}`);
});
