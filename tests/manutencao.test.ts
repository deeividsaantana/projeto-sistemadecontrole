import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  FLUXO_MANUTENCAO,
  calcularHorasParadas,
  isOrdemEncerrada,
  proximoStatusManutencao,
} from '../src/utils/manutencao';

test('fluxo segue a ordem definida para a manutenção', () => {
  assert.deepEqual(FLUXO_MANUTENCAO, ['Aberta', 'Em Análise', 'Em Andamento', 'Aguardando Peça', 'Concluída']);
  assert.equal(proximoStatusManutencao('Aberta'), 'Em Análise');
  assert.equal(proximoStatusManutencao('Em Análise'), 'Em Andamento');
  assert.equal(proximoStatusManutencao('Em Andamento'), 'Aguardando Peça');
  assert.equal(proximoStatusManutencao('Aguardando Peça'), 'Concluída');
});

test('ordem encerrada não avança mais', () => {
  assert.equal(proximoStatusManutencao('Concluída'), undefined);
  assert.equal(proximoStatusManutencao('Cancelada'), undefined);
  assert.equal(isOrdemEncerrada('Concluída'), true);
  assert.equal(isOrdemEncerrada('Aguardando Peça'), false);
});

test('horas paradas congelam entre abertura e liberação', () => {
  const horas = calcularHorasParadas({
    dataAbertura: '2026-09-01',
    horaAbertura: '08:00',
    dataConclusao: '2026-09-02',
    horaConclusao: '14:30',
  });
  assert.equal(horas, 30.5);
});

test('ordem aberta conta as horas até agora', () => {
  const agora = new Date('2026-09-01T12:00:00');
  const horas = calcularHorasParadas({ dataAbertura: '2026-09-01', horaAbertura: '09:00' }, agora);
  assert.equal(horas, 3);
});

test('sem abertura ou com liberação anterior à abertura não inventa número', () => {
  assert.equal(calcularHorasParadas({ dataAbertura: '', horaAbertura: '08:00' }), undefined);
  assert.equal(
    calcularHorasParadas({ dataAbertura: '2026-09-05', horaAbertura: '08:00', dataConclusao: '2026-09-01' }),
    undefined,
  );
});

test('hora ausente assume início do dia, sem quebrar o cálculo', () => {
  const horas = calcularHorasParadas({ dataAbertura: '2026-09-01', dataConclusao: '2026-09-01', horaConclusao: '06:00' });
  assert.equal(horas, 6);
});

test('a tela de manutenção está ligada aos handlers do App', () => {
  // Os handlers antigos de OS existiam sem nenhuma tela chamando: viraram
  // código morto e ninguém conseguia abrir uma ordem pelo sistema.
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'manutencao'/);
  assert.match(app, /onSave=\{handleSaveOrdemServico\}/);
  assert.match(app, /onDelete=\{handleDeleteOrdemServico\}/);
  assert.match(app, /setOrdensServico\(updated\)/);
});
