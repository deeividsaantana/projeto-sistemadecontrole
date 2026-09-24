import assert from 'node:assert/strict';
import test from 'node:test';
import { filterEquipesByFrente, sortEquipesByNome, calculatePresencaResumo } from '../src/utils/modoCampoOperacional';
import type { GrupoEquipe, PresencaApontamento } from '../src/types';

test('Modo Campo presença calculations', async (suite) => {
  const mockData = {
    equipes: [
      {
        id: 'eq-1',
        nome: 'Equipe Bravo',
        frenteServico: 'Frente 1',
        responsavel: 'João',
        status: 'ativo' as const,
        token: 't1',
        linkAtivo: true,
        funcionarioIds: ['f1', 'f2'],
        createdAt: '2026-09-24',
        updatedAt: '2026-09-24',
      },
      {
        id: 'eq-2',
        nome: 'Equipe Alfa',
        frenteServico: 'Frente 2',
        responsavel: 'Maria',
        status: 'ativo' as const,
        token: 't2',
        linkAtivo: true,
        funcionarioIds: ['f3', 'f4'],
        createdAt: '2026-09-24',
        updatedAt: '2026-09-24',
      },
    ] as GrupoEquipe[],
    presenca: [
      {
        id: 'p-1',
        data: '2026-09-24',
        grupoId: 'eq-1',
        grupoNome: 'Equipe Bravo',
        responsavel: 'João',
        frenteServico: 'Frente 1',
        funcionarioId: 'f1',
        funcionarioNome: 'João Silva',
        funcao: 'Encarregado',
        observacaoDia: '',
        horaEnvio: '08:00',
      },
      {
        id: 'p-2',
        data: '2026-09-24',
        grupoId: 'eq-1',
        grupoNome: 'Equipe Bravo',
        responsavel: 'João',
        frenteServico: 'Frente 1',
        funcionarioId: 'f2',
        funcionarioNome: 'Pedro Santos',
        funcao: 'Servente',
        observacaoDia: '',
        horaEnvio: '08:15',
      },
    ] as PresencaApontamento[],
  };

  await suite.test('filterEquipesByFrente retorna equipes da frente selecionada', () => {
    const filtered = filterEquipesByFrente(mockData.equipes, 'Frente 1');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].nome, 'Equipe Bravo');
  });

  await suite.test('sortEquipesByNome ordena alfabeticamente', () => {
    const sorted = sortEquipesByNome([...mockData.equipes].reverse());
    assert.strictEqual(sorted[0].nome, 'Equipe Alfa');
    assert.strictEqual(sorted[1].nome, 'Equipe Bravo');
  });

  await suite.test('calculatePresencaResumo conta presentes por equipe', () => {
    const resumo = calculatePresencaResumo(mockData.presenca, 'eq-1');
    assert.strictEqual(resumo.total, 2);
    assert.strictEqual(resumo.presente, 2);
    assert.strictEqual(resumo.ausente, 0);
    assert.strictEqual(resumo.percentual, 100);
  });
});
