import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentosDoVinculo,
  documentosParaAlertar,
  painelDocumentos,
  situacaoDocumento,
  validarDocumento,
} from '../src/utils/documentos';
import type { DocumentoArquivo } from '../src/types';

const documento = (extra: Partial<DocumentoArquivo> = {}): DocumentoArquivo => ({
  id: 'd1',
  titulo: 'CNH João',
  tipo: 'CNH',
  vinculo: 'Colaborador',
  vinculoId: 'c1',
  validade: '2026-03-01',
  responsavel: 'Deivid',
  ativo: true,
  criadoEm: '2026-01-01',
  atualizadoEm: '2026-01-01',
  ...extra,
});

test('situação usa a regra única de vencimento', () => {
  assert.equal(situacaoDocumento(documento(), '2026-01-01'), 'Válido');
  assert.equal(situacaoDocumento(documento(), '2026-02-15'), 'Vence em breve');
  assert.equal(situacaoDocumento(documento(), '2026-03-02'), 'Vencido');
  assert.equal(situacaoDocumento(documento({ validade: undefined }), '2026-03-02'), 'Sem vencimento');
});

test('alerta ordena pelo vencimento e ignora inativo', () => {
  const alertas = documentosParaAlertar([
    documento({ id: 'd1', validade: '2026-02-20' }),
    documento({ id: 'd2', validade: '2026-01-10' }),
    documento({ id: 'd3', validade: '2026-01-05', ativo: false }),
    documento({ id: 'd4', validade: '2027-01-01' }),
  ], '2026-02-01');
  assert.deepEqual(alertas.map(item => item.documento.id), ['d2', 'd1']);
  assert.equal(alertas[0].situacao, 'Vencido');
});

test('documentos do vínculo filtram por tipo e id', () => {
  const lista = [documento(), documento({ id: 'd2', vinculoId: 'c2' }), documento({ id: 'd3', vinculo: 'Equipamento', vinculoId: 'c1' })];
  assert.deepEqual(documentosDoVinculo(lista, 'Colaborador', 'c1').map(item => item.id), ['d1']);
});

test('painel conta vencidos, vencendo e sem anexo', () => {
  const painel = painelDocumentos([
    documento({ validade: '2026-01-01' }),
    documento({ id: 'd2', validade: '2026-02-10', anexo: { path: 'p', name: 'n', contentType: 'application/pdf', size: 10 } }),
  ], '2026-02-01');
  assert.deepEqual(painel, { total: 2, vencidos: 1, vencendo: 1, semAnexo: 1 });
});

test('vínculo sem registro e validade antes da emissão são recusados', () => {
  assert.match(String(validarDocumento({ titulo: 'x', vinculo: 'Colaborador', vinculoId: '' })), /Selecione o registro/);
  assert.equal(validarDocumento({ titulo: 'x', vinculo: 'Geral', vinculoId: '' }), null);
  assert.match(String(validarDocumento({ titulo: 'x', vinculo: 'Geral', emissao: '2026-02-01', validade: '2026-01-01' })), /anterior à emissão/);
});
