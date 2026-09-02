import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_CONFIG_PATH = path.join(ROOT, '.publicar-tudo.local.json');
const TEMP_ENV_PATH = path.join(ROOT, '.env.publicar-tudo.local');
const LOCAL_SECRET_DIR = path.join(process.env.LOCALAPPDATA || ROOT, 'RENEA');
const INITIAL_PASSWORD_PATH = path.join(LOCAL_SECRET_DIR, 'senha-inicial-administrador.txt');
const ONEDRIVE_SYNC_CONFIG_PATH = path.join(LOCAL_SECRET_DIR, 'onedrive-combustivel-sync.json');
const PUBLIC_TICKET_TOKEN_PATH = path.join(LOCAL_SECRET_DIR, 'public-ticket-link-token.txt');
// Projeto Firebase da obra. O nome nao acompanha o da empresa por razoes
// historicas; os prefixos 'sistemarenea_' das colecoes sao so nomenclatura.
const FIREBASE_PROJECT_ID = 'sistemaerp-787f6';
const FIREBASE_DATABASE_URL = 'https://sistemaerp-787f6-default-rtdb.firebaseio.com';
const FIREBASE_WEB_API_KEY = 'AIzaSyBPcOluz5J84fdSMRFekHwa-6TCk2ts4K8';
const MANUTENCAO_SOURCE_URL = 'https://dynamic-manatee-66561d.netlify.app/';
const EXPECTED_REMOTE = 'deeividsaantana/projeto-sistemadecontrole';
const EXPECTED_REMOTE_URL = `https://github.com/${EXPECTED_REMOTE}.git`;
const LEGACY_REMOTE = 'deeividsaantana/teste-70';
// Site de produção padrão. Trocar de conta Netlify não exige mexer no código:
// defina RENEA_NETLIFY_SITE_URL (ou RENEA_NETLIFY_SITE_ID), ou grave
// netlifySiteUrl/netlifySiteId em .publicar-tudo.local.json, fora do Git.
// O identificador é opcional: sem ele o vínculo é feito pelo nome do site, e o
// id descoberto fica gravado na configuração local para as próximas vezes.
const DEFAULT_NETLIFY_SITE_URL = 'https://reneaerp.netlify.app';

const readLocalConfig = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const localConfig = readLocalConfig();
const cleanSiteUrl = value => String(value || '').trim().replace(/\/+$/, '');
const NETLIFY_SITE_URL = cleanSiteUrl(process.env.RENEA_NETLIFY_SITE_URL || localConfig.netlifySiteUrl || DEFAULT_NETLIFY_SITE_URL);
const NETLIFY_SITE_ID = String(process.env.RENEA_NETLIFY_SITE_ID || localConfig.netlifySiteId || '').trim();
// O nome do site é o subdomínio de netlify.app. Domínio próprio não tem nome
// derivável, e aí o identificador passa a ser obrigatório.
const NETLIFY_SITE_NAME = (NETLIFY_SITE_URL.match(/^https:\/\/([^.]+)\.netlify\.app$/) || [])[1] || '';

const rememberNetlifySite = siteId => {
  if (!siteId || localConfig.netlifySiteId === siteId) return;
  try {
    fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify({
      ...localConfig,
      netlifySiteId: siteId,
      netlifySiteUrl: NETLIFY_SITE_URL,
    }, null, 2)}\n`, 'utf8');
    localConfig.netlifySiteId = siteId;
  } catch {
    // Guardar o id é conveniência. Falhar aqui não pode interromper a publicação.
  }
};
const LOCAL_TOOLS_DIR = path.join(ROOT, '.publicar-tudo-tools');
const LOCAL_NPM_CLI = path.join(LOCAL_TOOLS_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js');
const LOCAL_TOOLS_BIN = path.join(LOCAL_TOOLS_DIR, 'node_modules', '.bin');
const LOCAL_NPM_VERSION = '11.18.0';
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const quickCheck = args.has('--quick');
const forceSetup = args.has('--setup');
const refreshNetlifyLogin = args.has('--relogin');

process.chdir(ROOT);

const info = message => console.log(`\n[RENEA] ${message}`);
const ok = message => console.log(`[OK] ${message}`);
const warn = message => console.warn(`[ATENÇÃO] ${message}`);

const commandResult = (command, commandArgs = [], options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });
  if (result.error && !options.allowFailure) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const suffix = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
    throw new Error(`Comando falhou (${command} ${commandArgs.join(' ')}).${suffix}`);
  }
  return result;
};

const shellTool = (command, commandArgs = [], options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error && !options.allowFailure) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const suffix = options.capture ? `\n${result.stderr || result.stdout || ''}` : '';
    throw new Error(`Comando falhou (${command} ${commandArgs.join(' ')}).${suffix}`);
  }
  return result;
};

const git = (gitArgs, options = {}) => commandResult('git', gitArgs, options);

const bundledPnpmPath = path.join(
  path.dirname(path.dirname(path.dirname(process.execPath))),
  'bin',
  'fallback',
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
);
const bundledPnpmCli = path.join(
  path.dirname(path.dirname(path.dirname(process.execPath))),
  'node',
  'node_modules',
  'pnpm',
  'bin',
  'pnpm.mjs',
);
const detectPackageTools = () => {
  if (fs.existsSync(LOCAL_NPM_CLI)) {
    return { kind: 'npm-local', packageManager: LOCAL_NPM_CLI };
  }
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const npmFound = commandResult(locator, ['npm'], { capture: true, allowFailure: true }).status === 0;
  if (npmFound) return { kind: 'npm', packageManager: 'npm', dlx: 'npx' };
  if (fs.existsSync(bundledPnpmPath) && fs.existsSync(bundledPnpmCli)) {
    return { kind: 'pnpm', packageManager: bundledPnpmPath, dlx: bundledPnpmPath };
  }
  throw new Error('npm ou pnpm não encontrado. Instale o Node.js LTS antes de publicar.');
};

let packageTools = detectPackageTools();
const withPackageEnvironment = (options = {}) => ({
  ...options,
  env: {
    PATH: [path.dirname(process.execPath), LOCAL_TOOLS_BIN, process.env.PATH || ''].filter(Boolean).join(path.delimiter),
    NPM_CONFIG_OFFLINE: 'false',
    ...(options.env || {}),
  },
});

const runPackage = (packageArgs, options = {}) => {
  if (packageTools.kind === 'npm-local') {
    return commandResult(process.execPath, [LOCAL_NPM_CLI, ...packageArgs], withPackageEnvironment(options));
  }
  if (packageTools.kind === 'npm') {
    return shellTool(packageTools.packageManager, packageArgs, withPackageEnvironment(options));
  }
  return commandResult(process.execPath, [bundledPnpmCli, ...packageArgs], withPackageEnvironment(options));
};

const runDlx = (packageName, packageArgs, options = {}) => {
  if (packageTools.kind === 'npm-local') {
    const executable = packageName === 'netlify-cli'
      ? 'netlify'
      : packageName === 'firebase-tools' ? 'firebase' : packageName;
    const localResult = commandResult(process.execPath, [
      LOCAL_NPM_CLI,
      'exec',
      '--offline=false',
      '--ignore-scripts',
      '--yes',
      `--package=${packageName}`,
      '--',
      executable,
      ...packageArgs,
    ], withPackageEnvironment({ ...options, allowFailure: true }));
    if (localResult.status === 0 || !fs.existsSync(bundledPnpmCli)) return localResult;
    warn(`Ferramenta local não disponível para ${packageName}; tentando o runtime alternativo.`);
    const fallbackArgs = packageName === 'netlify-cli'
      ? [bundledPnpmCli, '--package=netlify-cli', 'dlx', 'netlify', ...packageArgs]
      : [bundledPnpmCli, 'dlx', packageName, ...packageArgs];
    return commandResult(process.execPath, fallbackArgs, withPackageEnvironment(options));
  }
  if (packageTools.kind === 'npm') {
    return shellTool(packageTools.dlx, ['--yes', packageName, ...packageArgs], withPackageEnvironment(options));
  }
  return commandResult(process.execPath, [bundledPnpmCli, 'dlx', packageName, ...packageArgs], withPackageEnvironment(options));
};

const ensureLocalNpm = () => {
  if (packageTools.kind !== 'pnpm' || fs.existsSync(LOCAL_NPM_CLI)) return;

  info('Preparando ferramentas compatíveis com a política do Windows');
  fs.mkdirSync(LOCAL_TOOLS_DIR, { recursive: true });
  const toolsPackagePath = path.join(LOCAL_TOOLS_DIR, 'package.json');
  if (!fs.existsSync(toolsPackagePath)) {
    fs.writeFileSync(toolsPackagePath, `${JSON.stringify({ private: true })}\n`, 'utf8');
  }

  commandResult(process.execPath, [
    bundledPnpmCli,
    'add',
    `npm@${LOCAL_NPM_VERSION}`,
    '--dir',
    LOCAL_TOOLS_DIR,
    '--ignore-scripts',
    '--lockfile=false',
  ], withPackageEnvironment({ allowFailure: true, env: { CI: 'true' } }));

  if (!fs.existsSync(LOCAL_NPM_CLI)) {
    throw new Error('Não foi possível preparar o npm local sem PowerShell.');
  }
  packageTools = detectPackageTools();
  ok('Ferramentas locais preparadas sem usar PowerShell.');
};

const captureGit = gitArgs => {
  const result = git(gitArgs, { capture: true });
  return String(result.stdout || '').trim();
};

const normalizePathInput = value => String(value || '').trim().replace(/^['"]|['"]$/g, '');

const ensureSecretOutsideRepository = secretPath => {
  const resolvedPath = path.resolve(secretPath);
  const relativePath = path.relative(ROOT, resolvedPath);
  if (!relativePath || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    throw new Error('Por segurança, o arquivo de segredo deve ficar fora da pasta do projeto.');
  }
  return resolvedPath;
};

const FIREBASE_WEB_ENV_PATH = path.join(ROOT, '.env.local');

// Campos do app web do Firebase. Os três primeiros saem do próprio projeto; os
// dois últimos só existem no console e precisam ser informados uma vez.
const FIREBASE_WEB_FIELDS = [
  { key: 'VITE_FIREBASE_API_KEY', label: 'Chave da API web', fallback: () => FIREBASE_WEB_API_KEY },
  { key: 'VITE_FIREBASE_AUTH_DOMAIN', label: 'Domínio de autenticação', fallback: () => `${FIREBASE_PROJECT_ID}.firebaseapp.com` },
  { key: 'VITE_FIREBASE_DATABASE_URL', label: 'URL do Realtime Database', fallback: () => FIREBASE_DATABASE_URL },
  { key: 'VITE_FIREBASE_PROJECT_ID', label: 'ID do projeto', fallback: () => FIREBASE_PROJECT_ID },
  { key: 'VITE_FIREBASE_STORAGE_BUCKET', label: 'Bucket do Storage', fallback: () => `${FIREBASE_PROJECT_ID}.firebasestorage.app` },
  { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', label: 'ID do remetente (messagingSenderId)', fallback: () => '' },
  { key: 'VITE_FIREBASE_APP_ID', label: 'ID do app (appId)', fallback: () => '' },
  { key: 'VITE_FIREBASE_MEASUREMENT_ID', label: 'ID de medição (opcional)', fallback: () => '', optional: true },
];

const readFirebaseWebConfig = async prompt => {
  const stored = (localConfig.firebaseWebConfig && typeof localConfig.firebaseWebConfig === 'object')
    ? localConfig.firebaseWebConfig
    : {};
  const resolved = {};
  let asked = false;
  for (const field of FIREBASE_WEB_FIELDS) {
    const known = String(process.env[field.key] || stored[field.key] || '').trim();
    if (known) {
      resolved[field.key] = known;
      continue;
    }
    const suggestion = field.fallback();
    if (suggestion || field.optional) {
      resolved[field.key] = suggestion;
      continue;
    }
    if (!asked) {
      asked = true;
      console.log('\nO navegador precisa saber com qual projeto Firebase falar. Sem estes');
      console.log('valores o sistema abre vazio, conversando com um projeto que não é o da obra.');
      console.log(`Copie de: https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/settings/general`);
      console.log('em "Seus apps" → app da Web → Configuração do SDK.');
    }
    let value = '';
    while (!value) {
      value = String(await prompt.question(`\n${field.label}: `)).trim();
      if (!value) warn('Este valor é obrigatório.');
    }
    resolved[field.key] = value;
  }
  return resolved;
};

// O vite build roda nesta máquina e lê .env.local da raiz. Sem escrever aqui, o
// pacote publicado sai com o projeto embutido, e nenhum dado da obra aparece.
const writeFirebaseWebEnv = webConfig => {
  const lines = FIREBASE_WEB_FIELDS
    .map(field => [field.key, String(webConfig?.[field.key] || '').trim()])
    .filter(([, value]) => value)
    .map(([key, value]) => dotenvLine(key, value));
  if (lines.length === 0) return false;
  fs.writeFileSync(FIREBASE_WEB_ENV_PATH, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  return true;
};

const ensureFirebaseWebEnv = () => {
  const stored = localConfig.firebaseWebConfig;
  if (!stored || typeof stored !== 'object') {
    warn('Configuração do app web do Firebase não registrada; execute PUBLICAR_TUDO.cmd --setup para informá-la.');
    return;
  }
  if (writeFirebaseWebEnv(stored)) ok(`Build apontado para o projeto Firebase ${stored.VITE_FIREBASE_PROJECT_ID}.`);
};

const readServiceAccount = async prompt => {
  const fromJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const fromBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
    : '';
  if (fromJson || fromBase64) return fromJson || fromBase64;

  console.log('\nBaixe uma única vez a chave JSON em:');
  console.log(`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/settings/serviceaccounts/adminsdk`);
  console.log('Use “Gerar nova chave privada”. Depois arraste o arquivo JSON para esta janela.');

  while (true) {
    const rawPath = normalizePathInput(await prompt.question('\nCaminho do JSON da conta de serviço: '));
    if (!rawPath || !fs.existsSync(rawPath)) {
      warn('Arquivo não encontrado. Tente novamente.');
      continue;
    }
    let resolvedPath;
    try {
      resolvedPath = ensureSecretOutsideRepository(rawPath);
    } catch (error) {
      warn(`${error.message} Mova a chave e tente novamente.`);
      continue;
    }
    return fs.readFileSync(resolvedPath, 'utf8');
  }
};

const parseServiceAccount = raw => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`O arquivo da conta de serviço não é um JSON válido: ${error.message}`);
  }
  if (parsed.type !== 'service_account' || !parsed.private_key || !parsed.client_email || !parsed.project_id) {
    throw new Error('O JSON informado não é uma conta de serviço Firebase válida.');
  }
  if (parsed.project_id !== FIREBASE_PROJECT_ID) {
    throw new Error(`A chave pertence ao projeto ${parsed.project_id}, mas este sistema usa ${FIREBASE_PROJECT_ID}.`);
  }
  return parsed;
};

const dotenvLine = (key, value) => `${key}=${JSON.stringify(String(value))}`;

const configureFirstRun = async () => {
  info('Configuração inicial automática');
  console.log('Você fará login no Netlify e no Firebase. Os navegadores serão abertos pelas ferramentas oficiais.');
  console.log('Nenhuma chave privada será adicionada ao Git ou ao ZIP.');

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let serviceAccountRaw;
  let adminEmail;
  let firebaseWebConfig;
  try {
    const defaultEmail = String(process.env.ADMIN_EMAIL || '').split(',')[0].trim();
    const nonInteractive = String(process.env.RENEA_NONINTERACTIVE || '').toLowerCase() === 'true';
    if (nonInteractive && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(defaultEmail)) {
      adminEmail = defaultEmail.toLowerCase();
    }
    while (!adminEmail) {
      const answer = await prompt.question(`\nE-mail do administrador${defaultEmail ? ` [${defaultEmail}]` : ''}: `);
      adminEmail = String(answer || defaultEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        warn('Informe um e-mail válido.');
        adminEmail = '';
      }
    }
    serviceAccountRaw = await readServiceAccount(prompt);
    parseServiceAccount(serviceAccountRaw);
    firebaseWebConfig = await readFirebaseWebConfig(prompt);
  } finally {
    prompt.close();
  }

  info('Autenticando e vinculando o Netlify');
  if (refreshNetlifyLogin) {
    info('Removendo a sessão Netlify antiga para conectar a equipe correta');
    runDlx('netlify-cli', ['logout'], { allowFailure: true });
  }
  runDlx('netlify-cli', ['login']);
  if (!fs.existsSync(path.join(ROOT, '.netlify', 'state.json'))) {
    runDlx('netlify-cli', netlifyLinkArgs());
  } else {
    info('Vínculo local do Netlify já encontrado; mantendo a sessão existente.');
  }

  const environmentLines = [
    dotenvLine('FIREBASE_SERVICE_ACCOUNT_KEY_BASE64', Buffer.from(serviceAccountRaw, 'utf8').toString('base64')),
    dotenvLine('FIREBASE_DATABASE_URL', FIREBASE_DATABASE_URL),
    dotenvLine('MANUTENCAO_SOURCE_URL', MANUTENCAO_SOURCE_URL),
    dotenvLine('FIREBASE_WEB_API_KEY', FIREBASE_WEB_API_KEY),
    dotenvLine('ADMIN_EMAIL', adminEmail),
  ];

  try {
    fs.writeFileSync(TEMP_ENV_PATH, `${environmentLines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
    const importResult = runDlx('netlify-cli', ['env:import', path.basename(TEMP_ENV_PATH)], {
      allowFailure: true,
      capture: true,
    });
    if (importResult.status !== 0) {
      throw new Error('Não foi possível enviar as variáveis ao Netlify. Os valores secretos foram ocultados do terminal.');
    }
    ok('Variáveis enviadas diretamente ao Netlify.');
  } finally {
    if (fs.existsSync(TEMP_ENV_PATH)) fs.rmSync(TEMP_ENV_PATH, { force: true });
  }

  info('Criando ou autorizando a conta administrativa');
  const initialPassword = `Renea!${crypto.randomBytes(12).toString('base64url')}`;
  fs.mkdirSync(LOCAL_SECRET_DIR, { recursive: true });
  commandResult(process.execPath, ['scripts/provision-staff.mjs', adminEmail], {
    env: {
      FIREBASE_SERVICE_ACCOUNT_KEY_BASE64: Buffer.from(serviceAccountRaw, 'utf8').toString('base64'),
      FIREBASE_ADMIN_CREATE_MISSING: 'true',
      FIREBASE_ADMIN_INITIAL_PASSWORD: initialPassword,
      FIREBASE_ADMIN_ENABLE_EMAIL_AUTH: 'true',
      FIREBASE_ADMIN_PASSWORD_OUTPUT_PATH: INITIAL_PASSWORD_PATH,
    },
  });

  const hasApplicationCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (hasApplicationCredentials) {
    info('Usando a credencial local do Firebase para publicar regras, sem abrir login adicional.');
  } else {
    info('Autenticando a ferramenta oficial do Firebase');
    runDlx('firebase-tools', ['login']);
  }

  localConfig.firebaseWebConfig = firebaseWebConfig;
  fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify({
    version: 1,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    adminEmail,
    netlifySiteId: NETLIFY_SITE_ID || readLinkedSiteId() || undefined,
    netlifySiteUrl: NETLIFY_SITE_URL,
    // Valores públicos do app web, guardados para que as próximas publicações
    // não voltem a perguntar. Nenhuma chave privada entra aqui.
    firebaseWebConfig,
    configuredAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
  writeFirebaseWebEnv(firebaseWebConfig);
  ok('Configuração inicial concluída e marcada somente neste computador.');
};

const ensureOneDriveFuelSync = () => {
  if (String(process.env.RENEA_SKIP_ONEDRIVE_SYNC || '').toLowerCase() === 'true') {
    warn('Sincronização automática do OneDrive adiada para este computador.');
    return;
  }
  if (process.platform !== 'win32') {
    warn('O agente automático do OneDrive será instalado somente no computador Windows de produção.');
    return;
  }
  let localSyncConfig = {};
  try {
    localSyncConfig = JSON.parse(fs.readFileSync(ONEDRIVE_SYNC_CONFIG_PATH, 'utf8'));
  } catch {}
  const syncToken = String(localSyncConfig.token || crypto.randomBytes(32).toString('base64url'));
  try {
    fs.writeFileSync(TEMP_ENV_PATH, `${dotenvLine('RENEA_ONEDRIVE_SYNC_TOKEN', syncToken)}\n`, { encoding: 'utf8', mode: 0o600 });
    const importResult = runDlx('netlify-cli', ['env:import', path.basename(TEMP_ENV_PATH)], {
      allowFailure: true,
      capture: true,
    });
    if (importResult.status !== 0) throw new Error('Falha ao configurar o token protegido no Netlify.');
  } finally {
    if (fs.existsSync(TEMP_ENV_PATH)) fs.rmSync(TEMP_ENV_PATH, { force: true });
  }
  const installResult = commandResult(process.execPath, ['scripts/instalar-sync-combustivel-onedrive.mjs'], {
    env: {
      RENEA_ONEDRIVE_SYNC_TOKEN: syncToken,
      RENEA_ONEDRIVE_SYNC_ENDPOINT: `${NETLIFY_SITE_URL}/.netlify/functions/sync-combustivel-onedrive`,
    },
    allowFailure: true,
    capture: true,
  });
  if (installResult.status !== 0) {
    warn('Sincronização automática do OneDrive não instalada neste computador; ela permanece opcional e não bloqueia a publicação.');
    return;
  }
  ok('Sincronização automática do OneDrive instalada neste computador.');
};

const ensurePublicTicketAccess = () => {
  fs.mkdirSync(LOCAL_SECRET_DIR, { recursive: true });
  const ticketAccessToken = fs.existsSync(PUBLIC_TICKET_TOKEN_PATH)
    ? fs.readFileSync(PUBLIC_TICKET_TOKEN_PATH, 'utf8').trim()
    : crypto.randomBytes(32).toString('base64url');
  if (ticketAccessToken.length < 24) throw new Error('O token local do link público de tickets é inválido.');
  if (!fs.existsSync(PUBLIC_TICKET_TOKEN_PATH)) {
    fs.writeFileSync(PUBLIC_TICKET_TOKEN_PATH, `${ticketAccessToken}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  try {
    fs.writeFileSync(
      TEMP_ENV_PATH,
      `${dotenvLine('RENEA_PUBLIC_TICKET_LINK_TOKEN', ticketAccessToken)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    const importResult = runDlx('netlify-cli', ['env:import', path.basename(TEMP_ENV_PATH)], {
      allowFailure: true,
      capture: true,
    });
    if (importResult.status !== 0) throw new Error('Falha ao configurar o token protegido de tickets no Netlify.');
  } finally {
    if (fs.existsSync(TEMP_ENV_PATH)) fs.rmSync(TEMP_ENV_PATH, { force: true });
  }
  ok('Link público de tickets protegido por token rotacionável.');
};

const readLinkedSiteId = () => {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(ROOT, '.netlify', 'state.json'), 'utf8')).siteId || '');
  } catch {
    return '';
  }
};

const netlifyLinkArgs = () => {
  if (NETLIFY_SITE_ID) return ['link', '--id', NETLIFY_SITE_ID];
  if (NETLIFY_SITE_NAME) return ['link', '--name', NETLIFY_SITE_NAME];
  throw new Error('Defina RENEA_NETLIFY_SITE_URL com o endereço .netlify.app do site, ou RENEA_NETLIFY_SITE_ID com o identificador.');
};

const ensureNetlifyLink = () => {
  const linkedSiteId = readLinkedSiteId();
  // Sem identificador configurado, um vínculo já existente é aceito: o id real
  // é lido do próprio vínculo e guardado, e daí em diante a conferência volta a
  // ser exata. Use --setup para forçar um novo vínculo.
  if (linkedSiteId && (NETLIFY_SITE_ID ? linkedSiteId === NETLIFY_SITE_ID : !forceSetup)) {
    rememberNetlifySite(linkedSiteId);
    return;
  }
  info(`Vinculando esta pasta ao site Netlify de produção (${NETLIFY_SITE_URL})`);
  runDlx('netlify-cli', netlifyLinkArgs());
  rememberNetlifySite(readLinkedSiteId());
  ok(`Pasta vinculada ao site ${NETLIFY_SITE_URL}.`);
};

const ensureRepositoryReady = () => {
  const hasRepository = fs.existsSync(path.join(ROOT, '.git'));
  if (!hasRepository) {
    info('Conectando a pasta extraída ao repositório existente');
    git(['init', '--initial-branch=main']);
    git(['remote', 'add', 'origin', EXPECTED_REMOTE_URL]);
  } else {
    const currentRemote = captureGit(['remote', 'get-url', 'origin']);
    if (!currentRemote.toLowerCase().includes(EXPECTED_REMOTE)) {
      if (!currentRemote.toLowerCase().includes(LEGACY_REMOTE)) {
        throw new Error(`O remoto origin não é reconhecido: ${currentRemote}`);
      }
      info('Corrigindo o destino GitHub para o repositório conectado ao Netlify');
      git(['remote', 'set-url', 'origin', EXPECTED_REMOTE_URL]);
    } else {
      return;
    }
  }
  git(['fetch', 'origin', 'main']);
  // Adota o histórico remoto sem tocar nos arquivos extraídos. Assim todo o
  // pacote aparece como uma atualização normal, sem criar históricos paralelos.
  git(['update-ref', 'refs/heads/main', 'refs/remotes/origin/main']);
  git(['read-tree', 'refs/remotes/origin/main']);
  const missingTrackedFiles = captureGit(['ls-files', '--deleted', '-z'])
    .split('\0')
    .filter(Boolean);
  missingTrackedFiles.forEach(file => git(['checkout-index', '--', file]));
  ok('Pasta conectada ao histórico do GitHub sem sobrescrever arquivos.');
};

const ensureRepositorySafety = () => {
  const remote = captureGit(['remote', 'get-url', 'origin']);
  if (!remote.toLowerCase().includes(EXPECTED_REMOTE)) {
    throw new Error(`O remoto origin não é o repositório esperado (${EXPECTED_REMOTE}). Encontrado: ${remote}`);
  }
  const branch = captureGit(['branch', '--show-current']);
  if (!branch) throw new Error('Não foi possível identificar a branch Git atual.');
  if (branch !== 'main') throw new Error(`A branch atual é ${branch}. Mude para main antes de publicar em produção.`);
  return branch;
};

const runProjectValidation = () => {
  ensureFirebaseWebEnv();
  info('Validando TypeScript');
  if (packageTools.kind === 'pnpm') commandResult(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
  else runPackage(['run', 'lint']);
  info('Executando testes automatizados');
  if (packageTools.kind === 'pnpm') commandResult(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'tests/run.ts']);
  else runPackage(['test']);
  info('Gerando o build de produção');
  if (packageTools.kind === 'pnpm') commandResult(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
  else runPackage(['run', 'build']);
  ok('TypeScript, testes e build aprovados.');
};

const runCheck = () => {
  info('Verificação segura, sem commit, push ou deploy');
  commandResult(process.execPath, ['--version']);
  git(['--version']);
  if (fs.existsSync(path.join(ROOT, '.git'))) {
    ensureRepositorySafety();
    console.log(captureGit(['status', '--short', '--branch']));
  } else {
    warn('Pasta extraída ainda não conectada ao Git; isso será feito automaticamente na publicação.');
  }
  ok(`Gerenciador disponível: ${packageTools.kind}.`);

  const required = [
    'netlify.toml',
    'firebase.json',
    'firestore.rules',
    'netlify/functions/public-presenca.js',
    'netlify/functions/public-apontamento.js',
    'netlify/functions/public-tickets.js',
    'netlify/functions/sync-combustivel-onedrive.js',
    'scripts/sync-combustivel-onedrive.mjs',
  ];
  required.forEach(file => {
    if (!fs.existsSync(path.join(ROOT, file))) throw new Error(`Arquivo obrigatório ausente: ${file}`);
  });
  ok('Arquivos de publicação presentes.');
  if (fs.existsSync(TEMP_ENV_PATH)) throw new Error('Arquivo temporário de segredo não foi removido. Exclua .env.publicar-tudo.local.');

  if (!quickCheck) {
    if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
      warn('Dependências ainda não instaladas; a publicação executará a instalação automaticamente.');
    } else {
      runProjectValidation();
    }
  }
  if (fs.existsSync(LOCAL_CONFIG_PATH)) ok('Primeira configuração já registrada neste computador.');
  else warn('Na primeira publicação será aberto o assistente de Netlify e Firebase.');
};

const publish = async () => {
  ensureRepositoryReady();
  const branch = ensureRepositorySafety();
  ensureLocalNpm();
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    info('Instalando dependências do projeto');
    if (packageTools.kind.startsWith('npm')) runPackage(['ci', '--no-audit', '--no-fund']);
    else runPackage(['install', '--lockfile=false'], { env: { CI: 'true' } });
  }

  if (forceSetup || !fs.existsSync(LOCAL_CONFIG_PATH)) await configureFirstRun();
  ensureNetlifyLink();
  ensurePublicTicketAccess();
  ensureOneDriveFuelSync();

  runProjectValidation();

  info('Preparando o commit');
  git(['add', '-A']);
  const hasStagedChanges = git(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0;
  if (hasStagedChanges) {
    const date = new Date().toISOString().slice(0, 10);
    git(['commit', '-m', `Atualização completa RENEA ${date}`]);
    ok('Alterações commitadas.');
  } else {
    ok('Nenhuma alteração nova para commit.');
  }

  info('Sincronizando com o GitHub sem apagar alterações locais');
  git(['pull', '--rebase', 'origin', branch]);
  runProjectValidation();

  info('Enviando para o GitHub');
  git(['push', 'origin', branch]);
  ok('Push concluído.');

  info('Publicando site e funções no Netlify');
  const deploySiteId = NETLIFY_SITE_ID || readLinkedSiteId();
  runDlx('netlify-cli', [
    'deploy',
    '--prod',
    ...(deploySiteId ? ['--site', deploySiteId] : []),
    '--message', `PUBLICAR_TUDO-${new Date().toISOString().slice(0, 10)}`,
    '--json',
  ]);
  ok('Site e funções publicados no Netlify.');

  info('Publicando as regras do Firestore');
  runDlx('firebase-tools', ['deploy', '--only', 'firestore', '--project', FIREBASE_PROJECT_ID]);
  ok('Regras do Firestore publicadas.');
  const storageResult = runDlx('firebase-tools', ['deploy', '--only', 'storage', '--project', FIREBASE_PROJECT_ID], { allowFailure: true, capture: true });
  if (storageResult.status === 0) ok('Regras do Storage publicadas.');
  else warn('Firebase Storage ainda não está ativado; anexos continuam indisponíveis sem bloquear o restante da publicação.');

  console.log('\n============================================================');
  console.log('PUBLICAÇÃO CONCLUÍDA');
  console.log(`Site publicado em ${NETLIFY_SITE_URL}`);
  console.log('Nas próximas vezes, execute somente PUBLICAR_TUDO.cmd.');
  console.log('============================================================');
};

try {
  if (checkOnly) runCheck();
  else await publish();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  if (String(error.message).includes('pull --rebase')) {
    console.error('Há conflito com o GitHub. Nenhum push foi feito; resolva o conflito antes de repetir.');
  }
  process.exitCode = 1;
}
