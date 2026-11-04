import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ler = (arquivo: string) => readFileSync(arquivo, 'utf8');
const app = ler('src/App.tsx');

test('Quadro e Manutenção se abrem um no outro pelo prefixo da máquina', () => {
  assert.match(app, /verOrdensDaMaquina = \(prefixo: string\)[^\n]*navigateTo\('manutencao'\)/);
  assert.match(app, /verMaquinaNoQuadro = \(prefixo: string\)[^\n]*navigateTo\('controle-equipamentos'\)/);
  assert.match(app, /buscaInicial=\{pedidoManutencao\.prefixo\}/);
  assert.match(app, /quadroBusca=\{pedidoFrota\.prefixo\}/);
  assert.match(ler('src/components/quadroFrota/PainelEquipamento.tsx'), /quadro-ver-ordens/);
  assert.match(ler('src/components/ManutencaoTab.tsx'), /onVerNoQuadro=\{onVerNoQuadro\}/);
  assert.match(ler('src/components/manutencao/FilaOficina.tsx'), /Ver no quadro/);
});

test('Topo do Quadro: alça de arrastar não passa por cima da faixa de filtros', () => {
  assert.match(ler('src/components/quadroFrota/QuadroFrota.tsx'), /lg:sticky lg:top-0 lg:z-20/);
  assert.doesNotMatch(ler('src/components/quadroFrota/CartaoArrastavel.tsx'), /absolute right-1 top-1 z-10/);
});

test('Manutenção aberta pelo Quadro com prefixo vai direto às ordens, onde fica a busca', () => {
  assert.match(ler('src/components/ManutencaoTab.tsx'), /useState<Subtela>\(buscaInicial \? 'ordens' : 'hoje'\)/);
});
