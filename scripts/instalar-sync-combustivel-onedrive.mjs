import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DIR = path.join(process.env.LOCALAPPDATA || ROOT, 'RENEA');
const CONFIG_PATH = path.join(LOCAL_DIR, 'onedrive-combustivel-sync.json');
const LAUNCHER_PATH = path.join(LOCAL_DIR, 'sincronizar-combustivel-onedrive.vbs');
const TASK_NAME = 'RENEA - Combustivel OneDrive - 10 minutos';

if (process.platform !== 'win32') throw new Error('O agente local do OneDrive requer Windows.');

let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch {}
const token = String(process.env.RENEA_ONEDRIVE_SYNC_TOKEN || previous.token || '');
const endpoint = String(process.env.RENEA_ONEDRIVE_SYNC_ENDPOINT || previous.endpoint || '');
if (!token || !endpoint) throw new Error('Token ou endereço do sincronizador não configurado. Execute o publicador completo uma vez.');

const oneDriveRoots = [
  process.env.OneDriveCommercial,
  process.env.OneDrive,
  process.env.UserProfile ? path.join(process.env.UserProfile, 'OneDrive - RENEA INFRAESTRUTURA S.A') : '',
].filter(Boolean);
const folderCandidates = oneDriveRoots.flatMap(root => [
  path.join(root, 'Documentos', 'Planilhas de Apoio'),
  path.join(root, 'Documents', 'Planilhas de Apoio'),
]);
const folderPath = String(process.env.RENEA_ONEDRIVE_FUEL_FOLDER || previous.folderPath || folderCandidates.find(candidate => fs.existsSync(candidate)) || '');
if (!folderPath || !fs.existsSync(folderPath)) {
  throw new Error('A pasta Planilhas de Apoio não foi encontrada dentro do OneDrive corporativo.');
}

fs.mkdirSync(LOCAL_DIR, { recursive: true });
fs.writeFileSync(CONFIG_PATH, `${JSON.stringify({
  ...previous,
  version: 2,
  intervalMinutes: 10,
  folderPath,
  endpoint,
  token,
  installedAt: new Date().toISOString(),
}, null, 2)}\n`, 'utf8');

const syncScript = path.join(ROOT, 'scripts', 'sync-combustivel-onedrive.mjs');
const command = `"${process.execPath}" "${syncScript}" --config "${CONFIG_PATH}"`;
const launcher = [
  'Set shell = CreateObject("WScript.Shell")',
  `exitCode = shell.Run("${command.replace(/"/g, '""')}", 0, True)`,
  'WScript.Quit exitCode',
  '',
].join('\r\n');
fs.writeFileSync(LAUNCHER_PATH, launcher, 'utf8');

const wscriptPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');
const create = spawnSync('schtasks.exe', [
  '/Create', '/F', '/SC', 'MINUTE', '/MO', '10', '/TN', TASK_NAME,
  '/TR', `"${wscriptPath}" //B //NoLogo "${LAUNCHER_PATH}"`,
], { encoding: 'utf8', windowsHide: true });
if (create.status !== 0) throw new Error(`Não foi possível criar a tarefa automática: ${create.stderr || create.stdout || 'erro desconhecido'}`);

spawnSync('schtasks.exe', ['/Run', '/TN', TASK_NAME], { encoding: 'utf8', windowsHide: true });
console.log(`[OK] OneDrive encontrado em: ${folderPath}`);
console.log('[OK] Sincronização de combustível instalada para executar a cada 10 minutos.');
