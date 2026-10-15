import assert from 'node:assert/strict';
import test from 'node:test';
import { protegerContraEncolhimento } from '../src/cloud/protecaoEncolhimento';

const lista = (prefixo: string, total: number) => Array.from({ length: total }, (_, i) => ({ id: `${prefixo}-${i}` }));

test('lista vazia ou muito menor não apaga a nuvem', () => {
  const nuvem = { abastecimentos: lista('ab', 5052), equipamentos: lista('eq', 252), materiaisMovimentos: lista('mm', 30) };
  const publicando = { abastecimentos: [], equipamentos: lista('eq', 67), materiaisMovimentos: lista('mm', 30) };
  const { retrato, protegidas } = protegerContraEncolhimento(nuvem, publicando);
  assert.equal((retrato.abastecimentos as unknown[]).length, 5052);
  assert.equal((retrato.equipamentos as unknown[]).length, 252);
  assert.deepEqual(protegidas, [{ tabela: 'abastecimentos', devolvidos: 5052 }, { tabela: 'equipamentos', devolvidos: 185 }]);
  assert.equal(publicando.equipamentos.length, 67, 'não mexe no retrato original');
});

test('exclusão pequena, marcada ou arquivada passa', () => {
  const nuvem = { abastecimentos: lista('ab', 100), equipamentos: lista('eq', 50), ticketsJazida: lista('tk', 40) };
  const publicando = {
    abastecimentos: lista('ab', 100).slice(19),
    equipamentos: lista('eq', 50).slice(30),
    ticketsJazida: [],
    exclusoes: lista('eq', 30).map(item => ({ id: `exc-${item.id}`, tabela: 'equipamentos', registroId: item.id, excluidoEm: '2026-10-15T10:00:00Z' })),
    periodosArquivados: [{ id: 'p1', dados: { ticketsJazida: lista('tk', 40) } }],
  };
  const { retrato, protegidas } = protegerContraEncolhimento(nuvem, publicando);
  assert.deepEqual(protegidas, []);
  assert.equal(retrato, publicando);
});

test('exclusão desfeita volta a proteger e auditoria fica de fora', () => {
  const nuvem = { equipamentos: lista('eq', 40), historyLogs: lista('h', 500) };
  const publicando = {
    equipamentos: [],
    historyLogs: [],
    exclusoes: [{ id: 'x', tabela: 'equipamentos', registroId: 'eq-0', excluidoEm: '2026-10-15T10:00:00Z', restauradoEm: '2026-10-15T11:00:00Z' }],
  };
  const { protegidas } = protegerContraEncolhimento(nuvem, publicando);
  assert.deepEqual(protegidas, [{ tabela: 'equipamentos', devolvidos: 40 }]);
  assert.deepEqual(protegerContraEncolhimento(null, publicando).protegidas, []);
});
