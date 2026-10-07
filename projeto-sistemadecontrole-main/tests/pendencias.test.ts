import assert from 'node:assert/strict';
import test from 'node:test';
import { listarPendencias, resumoPendencias } from '../src/utils/pendencias';
import type { DocumentoArquivo, Equipamento, Inspecao, NaoConformidade } from '../src/types';

const contextoBase = { hoje: '2026-01-15', inicio: '2026-01-01', fim: '2026-01-31' };

const equipamento = (id: string): Equipamento => ({
  id,
  prefixo: `EQ-${id}`,
  nome: 'Escavadeira',
  tipo: 'Escavadeira',
  marca: 'X',
  modelo: 'X',
  seriePlaca: '',
  empresaId: 'e1',
  localAtualId: 'o1',
  status: 'Ativo',
  observacao: '',
} as unknown as Equipamento);

test('lista vazia quando nada está pendente', () => {
  assert.deepEqual(listarPendencias(contextoBase), []);
});

test('pendências graves vêm primeiro e apontam para a tela de origem', () => {
  const inspecao: Inspecao = {
    id: 'i1', numero: 'INSP-1', data: '2026-01-02', tipo: 'Segurança', gravidade: 'Alta',
    situacao: 'Aberta', local: 'F1', descricao: 'x', prazo: '2026-01-05', inspetor: 'D',
    ativo: true, criadoEm: '', atualizadoEm: '',
  };
  const pendencias = listarPendencias({
    ...contextoBase,
    equipamentos: [equipamento('1')],
    inspecoes: [inspecao],
  });
  assert.equal(pendencias[0].gravidade, 'alta');
  assert.equal(pendencias[0].tab, 'nao-conformidades');
  assert.equal(pendencias.some(item => item.id === 'inspecoes-atrasadas' && item.tab === 'inspecoes'), true);
  assert.equal(pendencias.some(item => item.id === 'frota-sem-informacao'), true);
});

test('registro resolvido some da lista sem precisar limpar fila', () => {
  const documento: DocumentoArquivo = {
    id: 'd1', titulo: 'CNH', tipo: 'CNH', vinculo: 'Colaborador', vinculoId: 'c1',
    validade: '2026-01-01', responsavel: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
  };
  assert.equal(listarPendencias({ ...contextoBase, documentos: [documento] }).length, 1);
  assert.equal(listarPendencias({ ...contextoBase, documentos: [{ ...documento, validade: '2027-01-01' }] }).length, 0);
  assert.equal(listarPendencias({ ...contextoBase, documentos: [{ ...documento, ativo: false }] }).length, 0);
});

test('resumo conta itens, registros, graves e categorias', () => {
  const nc: NaoConformidade = {
    id: 'n1', numero: 'NC-1', data: '2026-01-02', origem: 'Interna', descricao: 'x',
    situacao: 'Aberta', prazo: '2026-01-05', registradoPor: 'D', ativo: true, criadoEm: '', atualizadoEm: '',
  };
  const pendencias = listarPendencias({ ...contextoBase, naoConformidades: [nc, { ...nc, id: 'n2' }] });
  const resumo = resumoPendencias(pendencias);
  assert.equal(resumo.itens, 1);
  assert.equal(resumo.registros, 2);
  assert.equal(resumo.altas, 1);
  assert.equal(resumo.categorias, 1);
});
