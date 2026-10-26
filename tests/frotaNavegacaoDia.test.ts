import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shiftIsoDate } from '../src/fleet/time';

/**
 * Remodelação do Controle de Frotas (26/10/2026): trocar de dia sem abrir o
 * calendário, indicadores sem rótulo quebrado e tabela de uma linha que cabe
 * em 1366 px sem rolagem lateral.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');

test('dia anterior e seguinte viram mês e ano sem pular dia', () => {
  assert.equal(shiftIsoDate('2026-10-26', -1), '2026-10-25');
  assert.equal(shiftIsoDate('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftIsoDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftIsoDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftIsoDate('2026-11-01', -1), '2026-10-31');
  assert.equal(shiftIsoDate('abc', 1), 'abc');
});

test('o topo da frota tem dia anterior, próximo dia e volta para hoje', () => {
  const aba = ler('src/components/ControleEquipamentosDiarioTab.tsx');
  assert.match(aba, /data-testid="frota-dia-anterior"/);
  assert.match(aba, /data-testid="frota-dia-seguinte"/);
  assert.match(aba, /data-testid="frota-hoje"/);
});

test('os avisos de conferência ficam na faixa de filtros, não num bloco à parte', () => {
  const aba = ler('src/components/ControleEquipamentosDiarioTab.tsx');
  const filtros = ler('src/components/fleet/FleetFilterBar.tsx');
  assert.doesNotMatch(aba, /data-testid="frota-conferencia"/);
  assert.match(filtros, /data-testid="frota-conferencia"/);
});

test('rótulo de indicador do Quadro não quebra no meio da palavra', () => {
  assert.match(ler('src/components/quadroFrota/QuadroFrota.tsx'), /truncate whitespace-nowrap/);
});

test('a Situação do dia abre com o panorama: anel por situação, canteiros e conferência', () => {
  const aba = ler('src/components/ControleEquipamentosDiarioTab.tsx');
  const panorama = ler('src/components/fleet/PanoramaDoDia.tsx');
  assert.match(aba, /<PanoramaDoDia/);
  assert.match(panorama, /frota-fatia-/);
  assert.match(panorama, /frota-canteiro-/);
  assert.match(panorama, /Quem já foi lançado/);
});

test('a tabela do dia tem uma linha por lançamento e aprova na própria coluna', () => {
  const tabela = ler('src/components/fleet/FleetDataTable.tsx');
  assert.doesNotMatch(tabela, /className="block text-xs/, 'sem segunda linha dentro da célula');
  assert.match(tabela, /chave: 'approval'[\s\S]*Aprovar/);
});
