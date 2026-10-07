import assert from 'node:assert/strict';
import test from 'node:test';
import { historicoDaManutencao, historicoDaOrdem } from '../src/utils/manutencaoHistorico';
import type { HistoryLog } from '../src/types';

const log = (overrides: Partial<HistoryLog> = {}): HistoryLog => ({
  id: 'log-1',
  timestamp: '18/09/2026 08:30:00',
  usuario: 'Encarregado da frota',
  acao: 'Criou',
  tela: 'Manutenção',
  descricao: 'Abriu a OS-0001 do CB770.',
  ...overrides,
});

test('histórico traz só o que é de manutenção', () => {
  const logs: HistoryLog[] = [
    log({ id: 'a', tela: 'Manutenção' }),
    log({ id: 'b', tela: 'Empresas', descricao: 'Cadastrou a empresa RENEA.' }),
    log({ id: 'c', tela: 'Abastecimentos', descricao: 'Lançou abastecimento.' }),
  ];

  const resultado = historicoDaManutencao(logs);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'a');
});

test('histórico inclui a OS aberta pelo controle diário de frota', () => {
  // A OS automática é registrada na tela do Controle Diário, mas a oficina
  // precisa vê-la no histórico da Manutenção — é a mesma ordem.
  const logs: HistoryLog[] = [
    log({
      id: 'auto',
      tela: 'Controle Diário de Equipamentos',
      descricao: 'Criou o controle de ES101 em 2026-09-18. Abriu automaticamente a OS-0007.',
    }),
    log({
      id: 'sem-os',
      tela: 'Controle Diário de Equipamentos',
      descricao: 'Criou o controle de CB770 em 2026-09-18.',
    }),
  ];

  const resultado = historicoDaManutencao(logs);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, 'auto');
});

test('histórico preserva a ordem cronológica recebida', () => {
  const logs: HistoryLog[] = [
    log({ id: 'novo', descricao: 'Concluiu a OS-0002.' }),
    log({ id: 'antigo', descricao: 'Abriu a OS-0001.' }),
  ];

  const resultado = historicoDaManutencao(logs);

  assert.deepEqual(resultado.map(item => item.id), ['novo', 'antigo']);
});

test('histórico de uma OS específica casa pelo número', () => {
  const logs: HistoryLog[] = [
    log({ id: 'a', descricao: 'Abriu a OS-0001 do CB770.' }),
    log({ id: 'b', descricao: 'Concluiu a OS-0002 do ES101.' }),
    log({ id: 'c', descricao: 'Editou a OS-0001: trocou a prioridade.' }),
  ];

  const resultado = historicoDaOrdem(logs, 'OS-0001');

  assert.deepEqual(resultado.map(item => item.id), ['a', 'c']);
});

test('histórico de uma OS casa também pelo registroId', () => {
  const logs: HistoryLog[] = [
    log({ id: 'a', registroId: 'os-frota-controle-es-101', descricao: 'Abriu ordem.' }),
    log({ id: 'b', registroId: 'os-outra', descricao: 'Abriu outra ordem.' }),
  ];

  const resultado = historicoDaOrdem(logs, 'OS-0007', 'os-frota-controle-es-101');

  assert.deepEqual(resultado.map(item => item.id), ['a']);
});

test('OS-0001 não puxa o log da OS-00012', () => {
  // Casamento por prefixo simples traria a ordem errada para a tela.
  const logs: HistoryLog[] = [
    log({ id: 'certo', descricao: 'Abriu a OS-0001.' }),
    log({ id: 'errado', descricao: 'Abriu a OS-00012.' }),
  ];

  const resultado = historicoDaOrdem(logs, 'OS-0001');

  assert.deepEqual(resultado.map(item => item.id), ['certo']);
});

test('lista vazia não quebra', () => {
  assert.deepEqual(historicoDaManutencao([]), []);
  assert.deepEqual(historicoDaOrdem([], 'OS-0001'), []);
});
