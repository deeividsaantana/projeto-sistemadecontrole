// Trava de peso do build (CONTRIBUTING.md, seção 4). Roda no fim do
// `npm run verify`, depois do `vite build`, e reprova quando:
// - o carregamento inicial (JS de index.html) passa do limite;
// - uma biblioteca pesada (Excel, PDF, canvas, Storage, cargas de planilha)
//   entra no carregamento inicial em vez de carregar só quando a tela pede;
// - o pedaço de uma aba passa do limite.
// Os limites ficam pouco acima do tamanho de 2026-09-24. Subir um limite
// exige justificar no PR; o normal é dividir a tela ou carregar sob demanda.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const KB = 1024;
const LIMITE_INICIAL = 600 * KB;
const LIMITE_POR_ABA = 300 * KB;
const PESADAS_FORA_DO_INICIO = /vendor-(excel|pdf|canvas|firebase-storage)|seed-/;

const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
const tamanho = arquivo => statSync(path.join(dist, arquivo)).size;
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const iniciais = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(match => match[1]);

const erros = [];
const totalInicial = iniciais.reduce((soma, arquivo) => soma + tamanho(arquivo), 0);
if (totalInicial > LIMITE_INICIAL) {
  erros.push(`Carregamento inicial com ${Math.round(totalInicial / KB)} kB (limite ${LIMITE_INICIAL / KB} kB).`);
}
for (const arquivo of iniciais) {
  if (PESADAS_FORA_DO_INICIO.test(arquivo)) erros.push(`${arquivo} entrou no carregamento inicial; carregue sob demanda.`);
}
for (const arquivo of readdirSync(assets)) {
  if (!/^(\w+Tab|Dashboard)-[\w-]+\.js$/.test(arquivo)) continue;
  const bytes = tamanho(path.join('assets', arquivo));
  if (bytes > LIMITE_POR_ABA) erros.push(`${arquivo} com ${Math.round(bytes / KB)} kB (limite por aba ${LIMITE_POR_ABA / KB} kB).`);
}

if (erros.length) {
  console.error('Build acima do peso permitido:\n');
  for (const erro of erros) console.error(`- ${erro}`);
  process.exit(1);
}
console.log(`Peso do build ok: carregamento inicial ${Math.round(totalInicial / KB)} kB.`);
