// Trava do checklist do PR (CONTRIBUTING.md, seção 4). Roda no CI em todo
// pull request: o corpo precisa trazer a seção "## Checklist" com todos os
// itens marcados, e, se o PR cria ou altera tela, a seção "### Se mexeu em
// tela" também toda marcada.
import { execFileSync } from 'node:child_process';

const body = process.env.PR_BODY || '';
const base = process.env.BASE_REF || 'main';

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=AMR', `origin/${base}...HEAD`], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const mexeuEmTela = changed.some(file => /^src\/(components|shared\/ui)\/.+\.(tsx|css)$/.test(file));

const secao = (titulo) => {
  const inicio = body.indexOf(titulo);
  if (inicio < 0) return null;
  const resto = body.slice(inicio + titulo.length);
  const fim = resto.search(/\n#{2,3} /);
  return fim < 0 ? resto : resto.slice(0, fim);
};

const erros = [];
const verificar = (titulo) => {
  const texto = secao(titulo);
  if (texto === null) {
    erros.push(`Falta a seção "${titulo}" do modelo de PR (.github/pull_request_template.md).`);
    return;
  }
  const abertos = texto.split('\n').filter(linha => /^\s*- \[ \]/.test(linha));
  for (const linha of abertos) erros.push(`Item sem marcar em "${titulo}": ${linha.trim()}`);
  if (!/^\s*- \[[xX]\]/m.test(texto)) erros.push(`A seção "${titulo}" está sem itens marcados.`);
};

verificar('## Checklist');
if (mexeuEmTela) verificar('### Se mexeu em tela');

if (erros.length) {
  console.error('Checklist do PR incompleto:\n');
  for (const erro of erros) console.error(`- ${erro}`);
  console.error('\nPreencha o checklist no corpo do PR. Regras em CONTRIBUTING.md, seção 4.');
  process.exit(1);
}
console.log(mexeuEmTela ? 'Checklist geral e de tela completos.' : 'Checklist geral completo.');
