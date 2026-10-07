import assert from 'node:assert/strict';
import test from 'node:test';
import { montarRelatorios } from '../src/utils/relatorios';
import type { RegistroProducao, ServicoObra } from '../src/types';

const contexto = { hoje: '2026-01-31', inicio: '2026-01-01', fim: '2026-01-31' };

const servico: ServicoObra = {
  id: 's1', descricao: 'Escavação', unidade: 'm³', quantidadePrevista: 200,
  situacao: 'Ativo', ativo: true, criadoEm: '', atualizadoEm: '',
};

const producao = (id: string, data: string, quantidade: number): RegistroProducao => ({
  id, data, servicoId: 's1', servicoDescricao: 'Escavação', unidade: 'm³', quantidade,
  responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
});

test('todo relatório tem título, colunas e linha coerente com as colunas', () => {
  const relatorios = montarRelatorios({ ...contexto, servicos: [servico], producao: [producao('1', '2026-01-10', 50)] });
  assert.equal(relatorios.length, 8);
  relatorios.forEach(relatorio => {
    assert.ok(relatorio.titulo.length > 0);
    assert.ok(relatorio.colunas.length > 0);
    relatorio.linhas.forEach(linha => assert.equal(linha.length, relatorio.colunas.length));
  });
});

test('produção separa o período do acumulado do contrato', () => {
  const [producaoPorServico] = montarRelatorios({
    ...contexto,
    servicos: [servico],
    producao: [producao('1', '2026-01-10', 50), producao('2', '2025-12-10', 30)],
  });
  assert.deepEqual(producaoPorServico.linhas[0], ['Escavação', 'm³', 50, 80, 200, 40]);
});

test('sem dados o relatório vem vazio em vez de inventar linha', () => {
  const relatorios = montarRelatorios(contexto);
  assert.equal(relatorios.find(item => item.id === 'medicoes')?.linhas.length, 0);
  assert.equal(relatorios.find(item => item.id === 'pendencias')?.linhas.length, 0);
  // Indicadores sempre existem: são os mesmos KPIs, com valor zero quando não há base.
  assert.ok((relatorios.find(item => item.id === 'indicadores')?.linhas.length || 0) > 0);
});
