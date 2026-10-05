import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

// Instala o hook local de pre-push. Roda automaticamente via "npm install"
// (script "prepare"), então qualquer checkout novo já sai protegido, sem
// passo manual. Não falha o "npm install"/"npm ci" se não houver um
// diretório .git (ex.: alguns ambientes de build empacotado).
const gitDir = '.git';
if (!existsSync(gitDir)) process.exit(0);

const hooksDir = join(gitDir, 'hooks');
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

const prePushPath = join(hooksDir, 'pre-push');
const prePushScript = `#!/bin/sh
# Instalado automaticamente por "npm install" (scripts/install-git-hooks.mjs).
# Roda a checagem completa (tipos + suite de testes, incluindo os testes do
# link público de presença + build) antes de qualquer push, e bloqueia o
# envio se algo quebrar.
echo "Rodando checagem completa antes do push (tipos + testes + build)..."
npm run verify
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "Push bloqueado: a checagem falhou (veja o erro acima)."
  echo "Corrija antes de enviar. Para pular em um caso excepcional: git push --no-verify"
  exit 1
fi
exit 0
`;

writeFileSync(prePushPath, prePushScript, { mode: 0o755 });
chmodSync(prePushPath, 0o755);
console.log('git hook pre-push instalado: "npm run verify" roda antes de cada push.');
