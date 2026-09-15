import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardPresenceMetrics } from '../src/utils/dashboardPresenceMetrics';
import type { Funcionario, PresencaApontamento } from '../src/types';

const funcionario = (id: string, status: Funcionario['status'] = 'ATIVO'): Funcionario => ({
  id, matricula: id, nome: id, cargo: 'AUXILIAR', telefone: '', empresaId: 'renea', ativo: status !== 'DESMOBILIZADO', status,
});

const apontamento = (funcionarioId: string, status: PresencaApontamento['status']): PresencaApontamento => ({
  id: `${funcionarioId}-${status}`, data: '2026-09-15', horaEnvio: '07:00', grupoId: 'equipe', grupoNome: 'Equipe', responsavel: 'Lider', frenteServico: 'Ramo 100', funcionarioId, funcionarioNome: funcionarioId, funcao: 'AUXILIAR', status, observacao: '', tokenUsado: '', createdAt: '',
});

test('dashboard usa todo o efetivo oficial, inclusive quem ainda nao tem equipe publica', () => {
  const metrics = dashboardPresenceMetrics(
    [funcionario('vinculado'), funcionario('sem-equipe'), funcionario('desmobilizado', 'DESMOBILIZADO')],
    [apontamento('vinculado', 'Presente')],
    [],
    '2026-09-15',
  );

  assert.equal(metrics.officialActive, 2);
  assert.equal(metrics.confirmed, 1);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.absent, 0);
});

test('dashboard nao duplica presenca nem conta ausencia como pendencia', () => {
  const metrics = dashboardPresenceMetrics(
    [funcionario('a'), funcionario('b'), funcionario('c')],
    [apontamento('a', 'Presente'), apontamento('a', 'Atraso'), apontamento('b', 'Ausente')],
    [],
    '2026-09-15',
  );

  assert.equal(metrics.officialActive, 3);
  assert.equal(metrics.confirmed, 1);
  assert.equal(metrics.absent, 1);
  assert.equal(metrics.pending, 1);
  assert.ok(Math.abs((metrics.percentage || 0) - (100 / 3)) < 0.000_001);
});
