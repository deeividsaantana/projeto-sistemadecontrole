import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSupabaseRelationalExport,
  summarizeSupabaseRelationalExport,
} from '../src/supabase/relationalExport';

test('exporta cadastros e operacao preservando ids legados e organization_id', () => {
  const exported = buildSupabaseRelationalExport({
    organizationId: 'renea',
    snapshot: {
      empresas: [{ id: 'emp-1', nome: 'RENEA', cnpj: '', telefone: '', responsavel: 'Adm', tipos: ['EMPRESA'] }],
      obras: [{ id: 'obra-1', nome: 'Obra A', endereco: 'Rodovia', responsavel: 'Eng', status: 'Ativa' }],
      equipamentos: [{
        id: 'eq-1',
        prefixo: 'CB790',
        nome: 'Caminhao',
        tipo: 'Caminhao',
        marca: 'VW',
        modelo: 'Constellation',
        seriePlaca: 'ABC1D23',
        empresaId: 'emp-1',
        status: 'Mobilizado',
        localAtualId: 'obra-1',
        observacao: '',
      }],
      funcionarios: [{
        id: 'fun-1',
        matricula: '123',
        nome: 'Motorista',
        cargo: 'Motorista',
        telefone: '',
        empresaId: 'emp-1',
        ativo: true,
      }],
      materiaisCadastro: [{
        id: 'mat-1',
        codigo: 'BRITA',
        descricao: 'Brita',
        categoria: 'Agregado',
        unidade: 'm3',
        fornecedorPadraoId: 'emp-1',
        ativo: true,
        criadoEm: '2026-09-01T00:00:00.000Z',
        atualizadoEm: '2026-09-01T00:00:00.000Z',
      }],
      materiaisMovimentos: [{
        id: 'mov-1',
        data: '2026-09-02',
        tipo: 'Entrada',
        materialId: 'mat-1',
        materialDescricao: 'Brita',
        quantidade: 10,
        unidade: 'm3',
        obraId: 'obra-1',
        fornecedorId: 'emp-1',
        responsavel: 'Almox',
        criadoEm: '2026-09-02T00:00:00.000Z',
      }],
      abastecimentos: [{
        id: 'ab-1',
        data: '2026-09-03',
        hora: '07:30',
        equipamentoId: 'eq-1',
        horimetroInicial: 1,
        kmInicial: 0,
        bombaInicial: 100,
        quantidadeLitros: 50,
        bombaFinal: 150,
        tipoCombustivelId: 'diesel',
        comboioId: 'comboio-1',
        responsavel: 'Posto',
        observacao: '',
      }],
    },
  });

  assert.deepEqual(exported.empresas[0], {
    legacy_id: 'emp-1',
    organization_id: 'renea',
    nome: 'RENEA',
    cnpj: '',
    telefone: '',
    responsavel: 'Adm',
    tipos: ['EMPRESA'],
    status: 'ATIVO',
    payload: exported.empresas[0].payload,
  });
  assert.equal(exported.equipamentos[0].legacy_id, 'eq-1');
  assert.equal(exported.equipamentos[0].empresa_legacy_id, 'emp-1');
  assert.equal(exported.equipamentos[0].obra_legacy_id, 'obra-1');
  assert.equal(exported.movimentos_materiais[0].material_legacy_id, 'mat-1');
  assert.equal(exported.abastecimentos[0].equipamento_legacy_id, 'eq-1');
});

test('resume contagens e aponta referencias orfas antes da virada para supabase', () => {
  const exported = buildSupabaseRelationalExport({
    organizationId: 'renea',
    snapshot: {
      empresas: [],
      obras: [],
      equipamentos: [{
        id: 'eq-1',
        prefixo: 'CB790',
        nome: 'Caminhao',
        tipo: 'Caminhao',
        marca: '',
        modelo: '',
        seriePlaca: '',
        empresaId: 'emp-ausente',
        status: 'Mobilizado',
        localAtualId: 'obra-ausente',
        observacao: '',
      }],
      materiaisCadastro: [],
      materiaisMovimentos: [{
        id: 'mov-1',
        data: '2026-09-02',
        tipo: 'Entrada',
        materialId: 'mat-ausente',
        materialDescricao: 'Brita',
        quantidade: 10,
        unidade: 'm3',
        responsavel: 'Almox',
        criadoEm: '2026-09-02T00:00:00.000Z',
      }],
    },
  });

  const summary = summarizeSupabaseRelationalExport(exported);

  assert.equal(summary.totalRows, 2);
  assert.equal(summary.tableCounts.equipamentos, 1);
  assert.deepEqual(summary.orphanReferences, [
    {
      table: 'equipamentos',
      legacyId: 'eq-1',
      field: 'empresa_legacy_id',
      referencedTable: 'empresas',
      referencedLegacyId: 'emp-ausente',
    },
    {
      table: 'equipamentos',
      legacyId: 'eq-1',
      field: 'obra_legacy_id',
      referencedTable: 'obras',
      referencedLegacyId: 'obra-ausente',
    },
    {
      table: 'movimentos_materiais',
      legacyId: 'mov-1',
      field: 'material_legacy_id',
      referencedTable: 'materiais',
      referencedLegacyId: 'mat-ausente',
    },
  ]);
});
