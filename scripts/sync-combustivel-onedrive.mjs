import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readFuelWorkbook } from './lib/fuel-workbook-reader.mjs';
import {
  buildFuelFileHashMap,
  FUEL_SYNC_PARSER_VERSION,
  selectChangedFuelFiles,
  sortFuelFiles,
} from './lib/fuel-sync-inventory.mjs';

const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
const CONFIG_PATH = path.resolve(configIndex >= 0 ? args[configIndex + 1] : path.join(process.env.LOCALAPPDATA || '.', 'RENEA', 'onedrive-combustivel-sync.json'));
const CONFIG_DIR = path.dirname(CONFIG_PATH);
const LOCK_PATH = path.join(CONFIG_DIR, 'onedrive-combustivel-sync.lock');
const LOG_PATH = path.join(CONFIG_DIR, 'onedrive-combustivel-sync.log');
const MAX_ROWS_PER_SYNC = 15_000;
const MAX_REQUEST_BYTES = 5_000_000;
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
      const stat = fs.statSync(filePath);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      return { filePath, name: entry.name, stat, hash };
    })
    .sort(sortFuelFiles);
  if (!files.length) throw new Error('Nenhuma planilha mensal de combustível foi encontrada na pasta configurada.');

  const changedFiles = selectChangedFuelFiles(files, config);
  if (!changedFiles.length) {
    log(`Sem alterações nas ${files.length} planilha(s) mensal(is) acompanhada(s).`);
  } else {
    // Cada envio é um retrato completo da pasta. Assim uma linha excluída ou
    // corrigida em um mês antigo também desaparece/é substituída no site.
    const parsedFiles = [];
    for (const file of files) {
      const parsed = await readFuelWorkbook(file.filePath);
      parsedFiles.push({ file, parsed });
    }
    const rows = parsedFiles.flatMap(item => item.parsed.rows);
    if (rows.length > MAX_ROWS_PER_SYNC) {
      throw new Error(`As planilhas somam ${rows.length} linhas; o limite seguro por sincronização é ${MAX_ROWS_PER_SYNC.toLocaleString('pt-BR')}. Nenhuma linha foi enviada parcialmente.`);
    }
    const warningCount = parsedFiles.reduce((sum, item) => sum + item.parsed.warningCount, 0);
    const fileName = files.length === 1
      ? files[0].name
      : `${files.length} planilhas mensais`;
    const fileModifiedAt = new Date(Math.max(...files.map(file => file.stat.mtimeMs))).toISOString();
    const detail = parsedFiles.map(item => `${item.file.name}: ${item.parsed.rows.length}`).join('; ');
    const requestBody = JSON.stringify({
      fileName,
      fileModifiedAt,
      rows,
      warningCount,
      message: `${rows.length} linha(s) no retrato completo de ${files.length} arquivo(s). ${detail}`,
    });
    const requestBytes = Buffer.byteLength(requestBody, 'utf8');
    if (requestBytes > MAX_REQUEST_BYTES) {
      throw new Error(`O retrato completo ocupa ${(requestBytes / 1_000_000).toFixed(2)} MB; o limite seguro é ${(MAX_REQUEST_BYTES / 1_000_000).toFixed(2)} MB. Nenhuma linha foi enviada parcialmente.`);
    }
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
        body: requestBody,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.message || `O site respondeu HTTP ${response.status}.`);
    writeConfig({
      ...config,
      parserVersion: FUEL_SYNC_PARSER_VERSION,
      fileHashes: buildFuelFileHashMap(files),
      lastFileHash: changedFiles.at(-1).hash,
      lastFileName: fileName,
      lastBatchId: result.batchId,
      lastRowCount: rows.length,
      lastWarningCount: warningCount,
      lastSyncAt: result.syncedAt || new Date().toISOString(),
    });
    log(`${fileName}: ${rows.length} linha(s) enviadas; ${warningCount} para conferência.`);
  }
} catch (error) {
  log(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(LOCK_PATH, { force: true });
}
