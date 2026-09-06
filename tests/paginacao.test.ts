import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// O hook usa React, que não roda no node:test sem DOM. O que precisa ficar
// travado aqui é o contrato: fatiar a lista e voltar para a página 1 quando o
// total muda — sem isso o usuário filtra e cai numa página vazia.
const fonte = readFileSync(new URL('../src/shared/hooks/usePaginacao.ts', import.meta.url), 'utf8');

test('a paginação fatia a lista em vez de desenhar tudo', () => {
  assert.match(fonte, /itens\.slice\(\(paginaAtual - 1\) \* porPagina, paginaAtual \* porPagina\)/);
});

test('mudou o total, volta para a primeira página', () => {
  assert.match(fonte, /setPagina\(1\);\n\s*\}, \[itens\.length\]\)/);
});

test('a página nunca passa do total de páginas', () => {
  assert.match(fonte, /Math\.min\(pagina, totalPaginas\)/);
});

// Custo de Firebase é prioridade máxima do sistema: a tela de tickets lia a
// coleção inteira a cada 30 segundos. Isto trava a correção no lugar.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('tickets públicos chegam por listener, não por varredura periódica', () => {
  assert.match(app, /subscribePublicTickets\(db,/);
  assert.equal(/setInterval\([\s\S]{0,120}PublicTickets/.test(app), false);
});

// Atalhos de teclado exigidos no desktop: ESC fecha e CTRL+ENTER salva, sem
// atrapalhar quem está escrevendo num campo de texto longo.
const modal = readFileSync(new URL('../src/shared/ui/Modal.tsx', import.meta.url), 'utf8');

test('o diálogo salva com CTRL+ENTER e respeita textarea', () => {
  assert.match(modal, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(modal, /TEXTAREA/);
  assert.match(modal, /event\.key === 'Escape'/);
});

// Limpeza: formatação de data, número e moeda mora em um lugar só.
test('as telas usam a formatação compartilhada, não cópias locais', () => {
  const copias = ['DiarioObraTab', 'ProducaoTab', 'MedicoesTab', 'CustosTab']
    .map(nome => readFileSync(new URL(`../src/components/${nome}.tsx`, import.meta.url), 'utf8'));
  copias.forEach(fonte => {
    assert.match(fonte, /from '\.\.\/utils\/formato'/);
    assert.equal(/const formatarData = \(valor: string\)/.test(fonte), false);
  });
});
