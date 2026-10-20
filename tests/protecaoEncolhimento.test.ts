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

test('abastecimento igual com outro id não volta em dobro', () => {
  const linha = (id: string, i: number) => ({
    id, data: '2026-10-10', hora: `11:${String(i % 60).padStart(2, '0')}`, prefixoInformado: `LO${i}`,
    quantidadeLitros: 46 + i, bombaInicial: 1000 + i, bombaFinal: 1046 + i * 2,
  });
  const antigos = Array.from({ length: 300 }, (_, i) => linha(`antigo-${i}`, i));
  const novos = Array.from({ length: 300 }, (_, i) => linha(`import-novo-${i}`, i));
  const soNoAparelho = Array.from({ length: 100 }, (_, i) => linha(`manual-${i}`, 1000 + i));

  // Download no aparelho que guardou a importação antiga: a nuvem tem a nova.
  const { retrato, protegidas } = protegerContraEncolhimento({ abastecimentos: [...antigos, ...soNoAparelho] }, { abastecimentos: novos });
  assert.equal((retrato.abastecimentos as unknown[]).length, 400);
  assert.deepEqual(protegidas, [{ tabela: 'abastecimentos', devolvidos: 100 }]);

  // Só cópias da mesma planilha: nada volta.
  assert.deepEqual(protegerContraEncolhimento({ abastecimentos: antigos }, { abastecimentos: novos }).protegidas, []);
});

test('marca de exclusão da nuvem nunca some num envio, e o excluído não volta', () => {
  // 16/10/2026: um aparelho sem as marcas publicou por cima e as 23 equipes
  // apagadas voltaram. A marca é o que impede a volta; ela não pode cair.
  const equipes = lista('grp', 40);
  const marcas = equipes.slice(0, 23).map(item => ({ id: `exc-${item.id}`, tabela: 'gruposEquipe', registroId: item.id, excluidoEm: '2026-10-16T11:46:05Z' }));
  const nuvem = { gruposEquipe: equipes.slice(23), exclusoes: marcas };
  const marcaNova = { id: 'exc-grp-30', tabela: 'gruposEquipe', registroId: 'grp-30', excluidoEm: '2026-10-16T21:00:00Z' };
  const publicando = { gruposEquipe: equipes.filter(item => item.id !== 'grp-30'), exclusoes: [marcaNova] };

  const { retrato, protegidas } = protegerContraEncolhimento(nuvem, publicando);
  assert.equal((retrato.exclusoes as unknown[]).length, 24, 'soma as marcas da nuvem às do aparelho');
  assert.deepEqual((retrato.gruposEquipe as Array<{ id: string }>).map(item => item.id), equipes.slice(23).map(item => item.id).filter(id => id !== 'grp-30'));
  assert.deepEqual(protegidas, [{ tabela: 'exclusoes', devolvidos: 23 }]);
  assert.equal(publicando.exclusoes.length, 1, 'não mexe no retrato original');

  // Com todas as marcas no aparelho, nada muda.
  const completo = { gruposEquipe: equipes.slice(23), exclusoes: marcas };
  assert.equal(protegerContraEncolhimento(nuvem, completo).retrato, completo);
});

test('tabela que ficaria vazia segura mesmo com poucos registros, com marca passa (A12)', () => {
  const nuvem = { ordensServico: lista('os', 5), lubrificacoes: lista('lb', 3) };
  const publicando = {
    ordensServico: [],
    lubrificacoes: [],
    exclusoes: lista('lb', 3).map(item => ({ id: `exc-${item.id}`, tabela: 'lubrificacoes', registroId: item.id, excluidoEm: '2026-10-20T10:00:00Z' })),
  };
  const { retrato, protegidas } = protegerContraEncolhimento(nuvem, publicando);
  assert.deepEqual(protegidas, [{ tabela: 'ordensServico', devolvidos: 5 }]);
  assert.equal((retrato.ordensServico as unknown[]).length, 5);
  assert.equal((retrato.lubrificacoes as unknown[]).length, 0);
});
