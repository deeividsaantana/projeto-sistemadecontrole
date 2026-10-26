import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Controle de Frotas na tabela padrão (auditoria de front 21/10/2026: C2, M3,
 * A11). Toda lista em grade das subtelas passa pela TabelaPadrao; o relatório
 * impresso só existe no DOM enquanto imprime; os detalhes usam o Modal comum.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const aba = ler('src/components/ControleEquipamentosDiarioTab.tsx');

test('as subtelas do Controle de Frotas usam a TabelaPadrao, sem <table> à mão', () => {
  for (const arquivo of [
    'src/components/fleet/FleetDataTable.tsx',
    'src/components/fleet/FleetDailyReference.tsx',
    'src/components/fleet/FleetDriverReference.tsx',
  ]) {
    const fonte = ler(arquivo);
    assert.match(fonte, /<TabelaPadrao/, arquivo);
    assert.doesNotMatch(fonte, /<table\b/, `${arquivo} não monta tabela à mão`);
  }
  assert.match(aba, /testId="frota-historico"/, 'Histórico na tabela padrão');
  assert.match(aba, /testId="frota-motoristas"/, 'Motoristas na tabela padrão');
  assert.doesNotMatch(aba, /<table\b/);
  assert.equal(existsSync('src/components/fleet/FleetMobileCard.tsx'), false, 'o cartão do celular vem da TabelaPadrao');
});

test('só o Quadro é aba longa: as outras subtelas deixam a tabela rolar por dentro', () => {
  assert.match(aba, /longa=\{activeView === 'quadro'\}/);
});

test('o relatório impresso não soma h1 na tela', () => {
  const relatorio = ler('src/components/fleet/FleetReportLayout.tsx');
  assert.match(relatorio, /beforeprint/);
  assert.match(relatorio, /if \(!imprimindo\) return null;/);
  assert.match(relatorio, /<th key=\{label\} scope="col"/);
});

test('os detalhes do lançamento usam o Modal comum (foco preso e Esc)', () => {
  const detalhe = ler('src/components/fleet/FleetDetailDrawer.tsx');
  assert.match(detalhe, /<Modal/);
  assert.doesNotMatch(detalhe, /createPortal/);
});
