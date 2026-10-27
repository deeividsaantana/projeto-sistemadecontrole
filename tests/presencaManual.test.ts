import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARCA_LANCAMENTO_MANUAL,
  aplicarPresencaManual,
  montarPresencaManual,
  resumirLancamento,
  veioDoLancamentoManual,
} from '../src/utils/presencaManual';
import type { Funcionario, GrupoEquipe, PresencaApontamento } from '../src/types';

const equipe = { id: 'g-1', nome: 'Equipe do Renilson', responsavel: 'Renilson', frenteServico: 'Ramo 200' } as GrupoEquipe;
const pessoas = [
  { id: 'c-1', nome: 'João Batista', cargo: 'PEDREIRO' },
  { id: 'c-2', nome: 'Maria Aparecida', cargo: 'SERVENTE' },
] as Funcionario[];
// Hora local do aparelho, em qualquer fuso em que o teste rode.
const agora = new Date(2026, 8, 10, 13, 20);

test('o lançamento manual nasce marcado: não se confunde com o que veio do campo', () => {
  const [registro] = montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [{ funcionarioId: 'c-1', status: 'Presente' }],
    responsavel: 'Deivid',
  }, agora);

  assert.equal(veioDoLancamentoManual(registro), true);
  assert.match(registro.tokenUsado, new RegExp(`^${MARCA_LANCAMENTO_MANUAL}-Deivid`));
  assert.equal(registro.funcionarioNome, 'João Batista');
  assert.equal(registro.funcao, 'PEDREIRO');
  assert.equal(registro.grupoNome, 'Equipe do Renilson');
  assert.equal(registro.horaEnvio, '13:20');
});

test('quem veio do link não é confundido com lançamento manual', () => {
  assert.equal(veioDoLancamentoManual({ tokenUsado: 'validado-abc123' }), false);
});

test('quem ficou sem situação não vira registro', () => {
  const registros = montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [
      { funcionarioId: 'c-1', status: 'Presente' },
      { funcionarioId: 'c-2', status: '' as never },
    ],
    responsavel: 'Deivid',
  }, agora);

  assert.equal(registros.length, 1, 'só quem foi conferido entra');
});

test('relançar o dia corrige em vez de duplicar', () => {
  const primeiro = montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [{ funcionarioId: 'c-1', status: 'Presente' }, { funcionarioId: 'c-2', status: 'Ausente' }],
    responsavel: 'Deivid',
  }, agora);
  const base = aplicarPresencaManual([], primeiro);

  const correcao = montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [{ funcionarioId: 'c-2', status: 'Atestado' }],
    responsavel: 'Deivid',
  }, agora);
  const final = aplicarPresencaManual(base, correcao);

  assert.equal(final.length, 2, 'ninguém foi duplicado');
  assert.equal(final.find(item => item.funcionarioId === 'c-2')?.status, 'Atestado');
  assert.equal(final.find(item => item.funcionarioId === 'c-1')?.status, 'Presente', 'quem não foi relançado ficou como estava');
});

test('lançar uma equipe não encosta no dia de outra equipe', () => {
  const deOutraEquipe = {
    id: 'plink-outra', grupoId: 'g-2', data: '2026-09-10', funcionarioId: 'c-9', status: 'Presente',
  } as PresencaApontamento;
  const novos = montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [{ funcionarioId: 'c-1', status: 'Presente' }],
    responsavel: 'Deivid',
  }, agora);

  const final = aplicarPresencaManual([deOutraEquipe], novos);
  assert.ok(final.some(item => item.id === 'plink-outra'), 'a outra equipe continua intacta');
});

test('lançar outro dia não apaga o dia anterior da mesma equipe', () => {
  const ontem = aplicarPresencaManual([], montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-09',
    situacoes: [{ funcionarioId: 'c-1', status: 'Presente' }],
    responsavel: 'Deivid',
  }, agora));

  const hoje = aplicarPresencaManual(ontem, montarPresencaManual({
    grupo: equipe, funcionarios: pessoas, data: '2026-09-10',
    situacoes: [{ funcionarioId: 'c-1', status: 'Ausente' }],
    responsavel: 'Deivid',
  }, agora));

  assert.equal(hoje.length, 2);
  assert.equal(hoje.find(item => item.data === '2026-09-09')?.status, 'Presente');
});

test('o resumo do lançamento soma o total e deixa quem não foi conferido à parte', () => {
  const resumo = resumirLancamento(['a', 'b', 'c', 'd', 'e'], {
    a: { funcionarioId: 'a', status: 'Presente' },
    b: { funcionarioId: 'b', status: 'Ausente' },
    c: { funcionarioId: 'c', status: 'Atestado' },
    d: { funcionarioId: 'd', status: 'Férias' },
  });
  assert.deepEqual(resumo, { total: 5, presentes: 1, ausentes: 1, justificados: 1, outras: 1, semConferencia: 1 });
  assert.equal(resumo.presentes + resumo.ausentes + resumo.justificados + resumo.outras + resumo.semConferencia, resumo.total);
});
