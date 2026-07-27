import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readFuelWorkbook } from './lib/fuel-workbook-reader.mjs';

const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
const CONFIG_PATH = path.resolve(configIndex >= 0 ? args[configIndex + 1] : path.join(process.env.LOCALAPPDATA || '.', 'RENEA', 'onedrive-combustivel-sync.json'));
const CONFIG_DIR = path.dirname(CONFIG_PATH);
const LOCK_PATH = path.join(CONFIG_DIR, 'onedrive-combustivel-sync.lock');
const LOG_PATH = path.join(CONFIG_DIR, 'onedrive-combustivel-sync.log');
const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

const filePeriodKey = name => {
  const normalized = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const year = Number(normalized.match(/20\d{2}/)?.[0] || 0);
  const month = MONTHS.findIndex(item => normalized.includes(item)) + 1;
  return year && month ? year * 100 + month : 0;
};

fs.mkdirSync(CONFIG_DIR, { recursive: true });
const log = message => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_PATH, line, 'utf8');
  process.stdout.write(line);
};

const writeConfig = config => {
  const tempPath = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, CONFIG_PATH);
};

const acquireLock = () => {
  if (fs.existsSync(LOCK_PATH)) {
    const age = Date.now() - fs.statSync(LOCK_PATH).mtimeMs;
    if (age < 30 * 60_000) return false;
    fs.rmSync(LOCK_PATH, { force: true });
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
  return true;
};

if (!acquireLock()) process.exit(0);

try {
  if (!fs.existsSync(CONFIG_PATH)) throw new Error('Configuração local da sincronização não encontrada.');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.folderPath || !config.endpoint || !config.token) throw new Error('Configuração local da sincronização está incompleta.');
  const files = fs.readdirSync(config.folderPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.startsWith('~$') && /^FORNECIMENTO DE COMBUSTIVEL - .+\.xlsx$/i.test(entry.name))
    .map(entry => {
      const filePath = path.join(config.folderPath, entry.name);
      return { filePath, name: entry.name, stat: fs.statSync(filePath) };
    })
    .sort((left, right) => filePeriodKey(right.name) - filePeriodKey(left.name) || right.stat.mtimeMs - left.stat.mtimeMs);
  if (!files.length) throw new Error('Nenhuma planilha mensal de combustível foi encontrada na pasta configurada.');

  const latest = files[0];
  const fileBuffer = fs.readFileSync(latest.filePath);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  if (config.lastFileHash === fileHash) {
    log(`Sem alterações em ${latest.name}.`);
  } else {
    const parsed = await readFuelWorkbook(latest.filePath);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response;
    try {
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: latest.name,
          fileModifiedAt: latest.stat.mtime.toISOString(),
          rows: parsed.rows,
          warningCount: parsed.warningCount,
          message: `${parsed.rows.length} linha(s) lida(s) da aba ${parsed.sheetName}.`,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.message || `O site respondeu HTTP ${response.status}.`);
    writeConfig({
      ...config,
      lastFileHash: fileHash,
      lastFileName: latest.name,
      lastBatchId: result.batchId,
      lastRowCount: parsed.rows.length,
      lastWarningCount: parsed.warningCount,
      lastSyncAt: result.syncedAt || new Date().toISOString(),
    });
    log(`${latest.name}: ${parsed.rows.length} linha(s) enviadas; ${parsed.warningCount} para conferência.`);
  }
} catch (error) {
  log(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(LOCK_PATH, { force: true });
}
