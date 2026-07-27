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
const FIREBASE_PROJECT_ID = 'sistemarenea';
const FIREBASE_DATABASE_URL = 'https://sistemarenea-default-rtdb.firebaseio.com';
const FIREBASE_WEB_API_KEY = 'AIzaSyDGN9xLkhgsqDIMXSTU9G03LEeC4Jmjpo4';
const MANUTENCAO_SOURCE_URL = 'https://dynamic-manatee-66561d.netlify.app/';
const EXPECTED_REMOTE = 'deeividsaantana/projeto-sistemadecontrole';
const EXPECTED_REMOTE_URL = `https://github.com/${EXPECTED_REMOTE}.git`;
const LEGACY_REMOTE = 'deeividsaantana/teste-70';
const NETLIFY_SITE_ID = 'a3c3fe0a-be7c-4cf1-8157-af735d8abcc8';
const LOCAL_TOOLS_DIR = path.join(ROOT, '.publicar-tudo-tools');
const LOCAL_NPM_CLI = path.join(LOCAL_TOOLS_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js');
const LOCAL_NPM_VERSION = '11.18.0';
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const quickCheck = args.has('--quick');
const forceSetup = args.has('--setup');

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
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`,
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
    return commandResult(process.execPath, [
      LOCAL_NPM_CLI,
      'exec',
      '--offline=false',
      '--ignore-scripts',
      '--yes',
      `--package=${packageName}`,
      '--',
      executable,
      ...packageArgs,
    ], withPackageEnvironment(options));
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
  let geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  try {
    const defaultEmail = String(process.env.ADMIN_EMAIL || process.env.AI_ALLOWED_EMAILS || '').split(',')[0].trim();
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

    if (!geminiKey) {
      const geminiPath = normalizePathInput(await prompt.question('\nArquivo TXT contendo a chave Gemini (Enter para manter a IA sem chave por enquanto): '));
      if (geminiPath) {
        if (!fs.existsSync(geminiPath)) throw new Error('Arquivo da chave Gemini não encontrado.');
        geminiKey = fs.readFileSync(ensureSecretOutsideRepository(geminiPath), 'utf8').trim();
      }
    }
  } finally {
    prompt.close();
  }

  info('Autenticando e vinculando o Netlify');
  runDlx('netlify-cli', ['login']);
  if (!fs.existsSync(path.join(ROOT, '.netlify', 'state.json'))) {
    runDlx('netlify-cli', ['link', '--id', NETLIFY_SITE_ID]);
  }

  const environmentLines = [
    dotenvLine('FIREBASE_SERVICE_ACCOUNT_KEY_BASE64', Buffer.from(serviceAccountRaw, 'utf8').toString('base64')),
    dotenvLine('FIREBASE_DATABASE_URL', FIREBASE_DATABASE_URL),
    dotenvLine('MANUTENCAO_SOURCE_URL', MANUTENCAO_SOURCE_URL),
    dotenvLine('FIREBASE_WEB_API_KEY', FIREBASE_WEB_API_KEY),
    dotenvLine('AI_ALLOWED_EMAILS', adminEmail),
    dotenvLine('GEMINI_DOCUMENT_MODEL', 'gemini-2.5-flash'),
  ];
  if (geminiKey) environmentLines.push(dotenvLine('GEMINI_API_KEY', geminiKey));

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

  info('Autenticando a ferramenta oficial do Firebase');
  runDlx('firebase-tools', ['login']);

  fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify({
    version: 1,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    adminEmail,
    configuredAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
  ok('Configuração inicial concluída e marcada somente neste computador.');
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
  info('Validando TypeScript');
  if (packageTools.kind === 'pnpm') commandResult(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
  else runPackage(['run', 'lint']);
  info('Gerando o build de produção');
  if (packageTools.kind === 'pnpm') commandResult(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
  else runPackage(['run', 'build']);
  ok('TypeScript e build aprovados.');
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
  ok('Push concluído; o Netlify iniciou o deploy automático.');

  info('Publicando as regras do Firestore');
  runDlx('firebase-tools', ['deploy', '--only', 'firestore', '--project', FIREBASE_PROJECT_ID]);
  ok('Regras do Firebase publicadas.');

  console.log('\n============================================================');
  console.log('PUBLICAÇÃO CONCLUÍDA');
  console.log('O Netlify está construindo a versão enviada para a branch main.');
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
