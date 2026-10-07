import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSupabaseRelationalImportPlan,
  SUPABASE_RELATIONAL_DB_TABLES,
} from '../src/supabase/relationalImport';
import type { SupabaseRelationalExport } from '../src/supabase/relationalExport';

const emptyExport = (): SupabaseRelationalExport => ({
  empresas: [],
  obras: [],
  equipamentos: [],
  funcionarios: [],
  materiais: [],
  movimentos_materiais: [],
  abastecimentos: [],
});

test('plano de importacao usa tabelas relacionais e upsert idempotente por organization_id e legacy_id', () => {
  const exported = emptyExport();
  exported.empresas.push({
    organization_id: 'renea',
    legacy_id: 'empresa-1',
    nome: 'RENEA',
    cnpj: '',
    telefone: '',
    responsavel: '',
    tipos: ['EMPRESA'],
    status: 'ATIVO',
    payload: { id: 'empresa-1' },
  });
  exported.abastecimentos.push({
    organization_id: 'renea',
    legacy_id: 'ab-1',
    data: '2026-10-07',
    hora: '08:00',
    equipamento_legacy_id: 'eq-1',
    quantidade_litros: 30,
    tipo_combustivel_legacy_id: 'diesel',
    comboio_legacy_id: '',
    payload: { id: 'ab-1' },
  });

  const plan = buildSupabaseRelationalImportPlan(exported);

  assert.deepEqual(plan.map(item => item.dbTable), [
    SUPABASE_RELATIONAL_DB_TABLES.empresas,
    SUPABASE_RELATIONAL_DB_TABLES.obras,
    SUPABASE_RELATIONAL_DB_TABLES.equipamentos,
    SUPABASE_RELATIONAL_DB_TABLES.funcionarios,
    SUPABASE_RELATIONAL_DB_TABLES.materiais,
    SUPABASE_RELATIONAL_DB_TABLES.movimentos_materiais,
    SUPABASE_RELATIONAL_DB_TABLES.abastecimentos,
  ]);
  assert.equal(plan.every(item => item.conflictTarget === 'organization_id,legacy_id'), true);
  assert.deepEqual(plan.map(item => [item.sourceTable, item.rowCount]), [
    ['empresas', 1],
    ['obras', 0],
    ['equipamentos', 0],
    ['funcionarios', 0],
    ['materiais', 0],
    ['movimentos_materiais', 0],
    ['abastecimentos', 1],
  ]);
});
